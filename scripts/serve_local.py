"""Start the existing Compose stack and share it privately using Tailscale Serve."""

import argparse
import json
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
TARGET = "http://127.0.0.1:8000"


def share_url(status, serve, port):
    if status.get("BackendState") != "Running":
        raise ValueError("Tailscale must be logged in and running on this host.")
    name = status.get("Self", {}).get("DNSName", "").rstrip(".")
    if not re.fullmatch(r"[A-Za-z0-9.-]+\.ts\.net", name):
        raise ValueError("Tailscale did not supply this device's HTTPS DNS name.")
    address = f"{name}:{port}"
    handlers = serve.get("Web", {}).get(address, {}).get("Handlers", {})
    if serve.get("AllowFunnel", {}).get(address):
        raise ValueError("This port is public through Funnel. Choose a private --port.")
    if (str(port) in serve.get("TCP", {}) or handlers) and handlers != {
        "/": {"Proxy": TARGET}
    }:
        raise ValueError(
            "This Tailscale port is already in use. Choose another --port."
        )
    return f"https://{name}" + (f":{port}" if port != 443 else "")


def create_env(path):
    if path.exists():
        return
    content = (
        (ROOT / ".env.example")
        .read_text()
        .replace("change-this-local-demo-token", secrets.token_urlsafe(32))
    )
    with os.fdopen(
        os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w"
    ) as file:
        file.write(content)
    print(
        "Created private .env in explicit fixture mode; operator token stays in that file."
    )


def command(args, env=None, timeout=15, capture=True):
    result = subprocess.run(
        args, cwd=ROOT, env=env, text=True, capture_output=capture, timeout=timeout
    )
    if result.returncode:
        raise RuntimeError(
            (result.stderr.strip() if capture else "") or f"{args[0]} command failed."
        )
    return result.stdout


def check_health(url):
    with urlopen(url + "/api/health", timeout=15) as response:
        health = json.load(response)
    if health.get("status") != "ok":
        raise RuntimeError(f"API health check did not pass at {url}.")
    return health


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--port",
        type=int,
        default=8443,
        metavar="PORT",
        help="Tailscale HTTPS port (default: 8443)",
    )
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535.")
    command(["docker", "info", "--format", "{{.ServerVersion}}"])
    status = json.loads(command(["tailscale", "status", "--json"]))
    serve = json.loads(command(["tailscale", "serve", "status", "--json"]))
    url = share_url(status, serve, args.port)
    create_env(ROOT / ".env")
    env = {**os.environ, "PUBLIC_URL": url}
    config = json.loads(
        command(["docker", "compose", "config", "--format", "json"], env)
    )
    values = config["services"]["api"]["environment"]
    mode = values.get("COALITION_MODE", "fixture")
    if mode not in ("fixture", "connected"):
        raise ValueError("COALITION_MODE must be fixture or connected.")
    if (
        not values.get("OPERATOR_TOKEN")
        or values["OPERATOR_TOKEN"] == "change-this-local-demo-token"
    ):
        raise ValueError("Set a private OPERATOR_TOKEN in .env before serving.")
    if mode == "connected":
        required = (
            "PAYPAL_CLIENT_ID",
            "PAYPAL_CLIENT_SECRET",
            "PAYPAL_WEBHOOK_ID",
            "PAYPAL_MERCHANT_ID",
        )
        missing = [key for key in required if not values.get(key)]
        if missing:
            raise ValueError("Connected mode is missing: " + ", ".join(missing))
    print(f"Starting {mode} mode; browser origin: {url}", flush=True)
    command(
        [
            "docker",
            "compose",
            "up",
            "--build",
            "--detach",
            "--wait",
            "--wait-timeout",
            "180",
        ],
        env,
        timeout=900,
        capture=False,
    )
    local = check_health(TARGET)
    if local.get("mode") != mode:
        raise RuntimeError(
            "The localhost API mode differs from the requested Compose mode."
        )
    command(
        ["tailscale", "serve", "--bg", f"--https={args.port}", TARGET],
        timeout=60,
        capture=False,
    )
    if check_health(url) != local:
        raise RuntimeError("The Tailscale URL did not reach the same healthy API.")
    with urlopen(url, timeout=15) as response:
        if b'id="root"' not in response.read():
            raise RuntimeError("The Tailscale URL did not serve the storefront.")
    print(
        f"Verified API and storefront reachability: {url}\nOperator controls: {url}/operator"
    )
    print(
        "Connected payment/AI proof and worker/browser checks are separate acceptance gates."
    )


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.TimeoutExpired) as exc:
        sys.exit(f"Local serving could not complete: {exc}")
