#!/usr/bin/env python3
"""Generate a GitHub App installation token for the maestro-dev app.

Usage:
    python scripts/gh_app_auth.py           # prints the token
    python scripts/gh_app_auth.py --setup   # configures gh CLI
    python scripts/gh_app_auth.py --force   # force refresh
    python scripts/gh_app_auth.py --check   # check if valid

Tokens are valid for 1 hour. Caches expiry, skips renewal if >10 min remaining.

IMPORTANT: Update APP_ID, INSTALLATION_ID, and PEM_PATH after creating your GitHub App.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

# Read from environment (.env) — no hardcoded values
APP_ID = int(os.environ.get("GITHUB_APP_ID", "0"))
INSTALLATION_ID = int(os.environ.get("GITHUB_INSTALLATION_ID", "0"))
PEM_FILENAME = os.environ.get("GITHUB_PEM_FILENAME", "maestro-dev.private-key.pem")
PEM_PATH = Path.home() / ".github-apps" / PEM_FILENAME
TOKEN_CACHE = Path(__file__).parent.parent / "data" / ".gh_app_token.json"

RENEW_THRESHOLD_SECONDS = 600


def _load_cache() -> dict:
    if TOKEN_CACHE.exists():
        try:
            return json.loads(TOKEN_CACHE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_cache(expires_at: float) -> None:
    TOKEN_CACHE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_CACHE.write_text(json.dumps({
        "expires_at": expires_at,
        "refreshed_at": time.time(),
    }, indent=2))


def is_token_valid() -> bool:
    cache = _load_cache()
    expires_at = cache.get("expires_at", 0)
    return (expires_at - time.time()) > RENEW_THRESHOLD_SECONDS


def generate_jwt() -> str:
    import jwt
    pem = PEM_PATH.read_bytes()
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + (10 * 60), "iss": str(APP_ID)}
    return jwt.encode(payload, pem, algorithm="RS256")


def get_installation_token() -> str:
    token_jwt = generate_jwt()
    url = f"https://api.github.com/app/installations/{INSTALLATION_ID}/access_tokens"

    proc = subprocess.run(
        ["curl", "-fsSL", "-X", "POST",
         "-H", f"Authorization: Bearer {token_jwt}",
         "-H", "Accept: application/vnd.github+json", url],
        capture_output=True, text=True, timeout=30,
    )
    if proc.returncode == 0:
        try:
            return json.loads(proc.stdout)["token"]
        except (json.JSONDecodeError, KeyError):
            pass

    proc = subprocess.run(
        ["gh", "api", f"app/installations/{INSTALLATION_ID}/access_tokens",
         "--method", "POST", "--header", f"Authorization: Bearer {token_jwt}",
         "--jq", ".token"],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        print(f"Error getting token: {proc.stderr}", file=sys.stderr)
        sys.exit(1)
    return proc.stdout.strip()


def setup_gh_cli(token: str) -> None:
    proc = subprocess.run(
        ["gh", "auth", "login", "--with-token"],
        input=token, capture_output=True, text=True,
    )
    if proc.returncode != 0:
        print(f"Error setting up gh: {proc.stderr}", file=sys.stderr)
        sys.exit(1)
    _save_cache(expires_at=time.time() + 3600)
    print("gh CLI configured with app token (valid for 1 hour)")


def main() -> None:
    if not PEM_PATH.exists():
        print(f"Error: PEM file not found at {PEM_PATH}", file=sys.stderr)
        print("Create a GitHub App and generate a private key first.", file=sys.stderr)
        sys.exit(1)

    force = "--force" in sys.argv
    check = "--check" in sys.argv
    setup = "--setup" in sys.argv

    if check:
        if is_token_valid():
            remaining = int(_load_cache().get("expires_at", 0) - time.time())
            print(f"Token valid ({remaining // 60}m remaining)")
        else:
            print("Token expired or expiring soon")
            sys.exit(1)
        return

    if setup and not force and is_token_valid():
        remaining = int(_load_cache().get("expires_at", 0) - time.time())
        print(f"Token still valid ({remaining // 60}m remaining), skipping refresh")
        return

    token = get_installation_token()
    if setup:
        setup_gh_cli(token)
    else:
        print(token)


if __name__ == "__main__":
    main()
