import { useState } from 'react';
import { Screen } from '../../components/MemberUI';
import { request } from '../../connected';
import { shops, type ShopId } from '../../fixture';
export default function Access({ hub = false }: { hub?: boolean }) {
  const [shop, setShop] = useState<ShopId>('dalbit'), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/login', { method: 'POST', body: { role: hub ? 'hub' : 'shop', ...(hub ? {} : { shop_id: shop }), password } }); location.assign(hub ? '/hub' : '/shops/orders'); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <Screen title={hub ? 'Seoul hub' : 'Rally for shops'} back="/shop"><h1>{hub ? 'Hub sign in' : 'Your shop workspace'}</h1><p>{hub ? 'Sign in to receive parcels, ship a box and update its customs cost.' : 'Sign in to your shop account to see orders, products and agent settings.'}</p><form className="request-form" onSubmit={login}>{!hub && <><label htmlFor="login-shop">Your shop</label><select id="login-shop" value={shop} onChange={event => setShop(event.target.value as ShopId)}>{(Object.keys(shops) as ShopId[]).map(id => <option key={id} value={id}>{shops[id].name}</option>)}</select></>}<label htmlFor="login-password">Password</label><input id="login-password" type="password" value={password} autoComplete="current-password" required onChange={event => setPassword(event.target.value)} /><button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>{error && <p role="alert">{error}</p>}</form><a className="text-link" href={hub ? '/shops/orders' : '/hub'}>{hub ? 'Shop sign in' : 'Hub sign in'}</a></Screen>;
}
