import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "serve_local", Path(__file__).resolve().parents[1] / "scripts" / "serve_local.py"
)
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LocalServing(unittest.TestCase):
    def test_private_origin_and_existing_routes(self):
        status = {
            "BackendState": "Running",
            "Self": {"DNSName": "demo.tail123.ts.net."},
        }
        self.assertEqual(
            launcher.share_url(status, {}, 8443), "https://demo.tail123.ts.net:8443"
        )
        own = {
            "TCP": {"443": {"HTTPS": True}},
            "Web": {
                "demo.tail123.ts.net:443": {
                    "Handlers": {"/": {"Proxy": launcher.TARGET}}
                }
            },
        }
        self.assertEqual(
            launcher.share_url(status, own, 443), "https://demo.tail123.ts.net"
        )
        for config in (
            {"TCP": {"8443": {"TCPForward": "localhost:9000"}}},
            {"AllowFunnel": {"demo.tail123.ts.net:8443": True}},
        ):
            with self.assertRaises(ValueError):
                launcher.share_url(status, config, 8443)
        with self.assertRaises(ValueError):
            launcher.share_url({"BackendState": "NeedsLogin"}, {}, 8443)

    def test_env_creation_is_private_and_keeps_existing_credentials(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / ".env"
            launcher.create_env(path)
            content = path.read_text()
            self.assertIn("COALITION_MODE=fixture", content)
            self.assertNotIn("change-this-local-demo-token", content)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            path.write_text("existing configuration\n")
            launcher.create_env(path)
            self.assertEqual(path.read_text(), "existing configuration\n")
