import asyncio
import tempfile
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Request
from rally import api


class ApiContracts(unittest.TestCase):
    def test_health_and_api_paths_do_not_fall_through_to_html(self):
        self.assertEqual(api.health()["app"], "rally")
        with self.assertRaises(HTTPException) as caught:
            api.frontend("api/retired-path")
        self.assertEqual(caught.exception.status_code, 404)

    def test_webhook_acknowledges_only_after_durable_receipt(self):
        db = object()
        raw = b'{"id":"WH-1","event_type":"PAYMENT.CAPTURE.COMPLETED"}'

        async def incoming():
            return {"type": "http.request", "body": raw, "more_body": False}

        def request():
            return Request(
                {"type": "http", "headers": [(b"paypal-transmission-id", b"TX-1")]},
                incoming,
            )

        with (
            patch.object(api, "connect", return_value=nullcontext(db)),
            patch.object(api, "receive") as receive,
        ):
            self.assertEqual(asyncio.run(api.webhook(request())), {"received": True})
            self.assertIs(receive.call_args.args[0], db)
            self.assertEqual(receive.call_args.args[2], raw)
            receive.side_effect = OSError("test storage outage")
            with self.assertRaises(OSError):
                asyncio.run(api.webhook(request()))
            receive.side_effect = ValueError("test malformed event")
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(api.webhook(request()))
            self.assertEqual(caught.exception.status_code, 400)

    def test_spa_routes_and_static_path_boundary(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(api, "FRONTEND_ROOT", Path(directory)),
        ):
            root = Path(directory)
            (root / "index.html").write_text("<main>Rally</main>")
            (root / "asset.js").write_text("/* asset */")
            self.assertEqual(Path(api.frontend("invite").path), root / "index.html")
            self.assertEqual(Path(api.frontend("asset.js").path), root / "asset.js")
            with self.assertRaises(HTTPException):
                api.frontend("../private.env")
