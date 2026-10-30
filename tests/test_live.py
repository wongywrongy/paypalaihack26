"""Live marketplace authority contracts on disposable PostgreSQL; providers doubled."""
import os
from unittest.mock import patch

from rally import db as database
from test_shopping import ShoppingContracts


class LiveContracts(ShoppingContracts):
    # Keep shared setup/helpers without rediscovering the inherited v2 contract cases.
    def setUp(self):
        super().setUp()
        self.env = patch.dict(os.environ, {"RALLY_JUDGE_WRITER_PASSWORD": "writer-test"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def edit(self, **updates):
        row = self.client.get('/api/shops/haneul/products').json()['products'][0]
        body = {"list_usd": row['listed'], "floor_usd": row['lowest'], "stock": row['stock'], "version": row['version'], **updates}
        return self.client.patch('/api/shops/haneul/products/' + row['offer_id'], json=body, headers={'X-CSRF-Token': self.csrf})

    def test_listing_bounds_versions_audit_reset_and_scope(self):
        self.login('shop', 'writer-test', 'haneul')
        for fields in ({'floor_usd': 0}, {'list_usd': 1}, {'stock': 501}, {'stock': True}, {'floor_usd': 999999}):
            self.assertIn(self.edit(**fields).status_code, (400, 422))
        saved = self.edit(stock=3)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(self.edit(version=1).status_code, 409)
        self.assertEqual(self.client.patch('/api/shops/haneul/products/haneul/mul-gel-cleanser', json={'list_usd': 1500, 'floor_usd': 1100, 'stock': 2, 'version': 1}).status_code, 403)
        self.assertEqual(self.post('/shops/bada/reset', {}).status_code, 403)
        self.assertEqual(self.post('/bags', self.payload).status_code, 403)
        self.assertEqual(self.post('/hub/jobs/1/resume', {}).status_code, 403)
        self.assertEqual(self.post('/hub/orders/00000000-0000-0000-0000-000000000000/ship', {'carrier':'Rally','tracking':'BOX'}).status_code, 403)
        self.assertEqual(self.post('/shops/haneul/reset', {}).status_code, 200)
        data = self.client.get('/api/shops/haneul/products').json()
        self.assertEqual(data['products'][0]['stock'], 100)
        self.assertTrue(all(row['action'].startswith('reset') for row in data['changes']))
        with database.connect() as db:
            db.execute("UPDATE shop_write_limits SET attempts=30")
        self.assertEqual(self.edit(stock=2).status_code, 429)

    def test_listing_edits_do_not_rewrite_quotes(self):
        from rally import orders, store
        bag = self.post('/bags', self.payload).json()
        with database.connect() as db:
            before = db.execute("SELECT terms FROM quotes WHERE id=%s", (bag['quote']['id'],)).fetchone()['terms']
        self.login('shop', 'writer-test', 'haneul')
        row = next(r for r in self.client.get('/api/shops/haneul/products').json()['products'] if r['id'] == 'sae-cica-cream')
        self.assertEqual(self.client.patch('/api/shops/haneul/products/' + row['offer_id'], json={'list_usd': row['listed'], 'floor_usd': row['lowest'], 'stock': 4, 'version': row['version']}, headers={'X-CSRF-Token': self.csrf}).status_code, 200)
        with database.connect() as db:
            after = db.execute("SELECT terms FROM quotes WHERE id=%s", (bag['quote']['id'],)).fetchone()['terms']
            new = orders.terms(self.payload['items'], 'US', self.payload['rules'], store.catalog(db))
        self.assertEqual(before, after)
        self.assertNotIn('authority', bag['quote'])
        self.assertNotEqual(before['authority']['offers'], new['authority']['offers'])


# Inheritance reuses the integration harness, not its tests.
for _name in dir(ShoppingContracts):
    if _name.startswith('test_'):
        setattr(LiveContracts, _name, None)
del ShoppingContracts
