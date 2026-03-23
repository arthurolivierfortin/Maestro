#!/usr/bin/env python3
"""Generate a GitHub App installation token for the maestro-dev app.

Usage:
    python scripts/gh_app_auth.py           # prints the token
    python scripts/gh_app_auth.py --setup   # configures gh CLI (only if token expired/expiring)
    python scripts/gh_app_auth.py --force   # force refresh even if token is still valid
    python scripts/gh_app_auth.py --check   # check if current token is still valid

Tokens are valid for 1 hour. The script caches the expiry time and skips
renewal if the token has >10 minutes remaining.

Reads GH_APP_ID, GH_APP_INSTALLATION_ID, GH_APP_PEM_PATH from .env or environment.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import jwt

def _load_dotenv() -> None:
    """Load .env file if it exists."""
    env_file = Path(__file__).parent.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


_load_dotenv()

_app_id = os.environ.get("GH_APP_ID")
_installation_id = os.environ.get("GH_APP_INSTALLATION_ID")
_pem_path = os.environ.get("GH_APP_PEM_PATH")

if not _app_id or not _installation_id or not _pem_path:
    _missing = [v for v, val in [
        ("GH_APP_ID", _app_id),
        ("GH_APP_INSTALLATION_ID", _installation_id),
        ("GH_APP_PEM_PATH", _pem_path),
    ] if not val]
    print(f"ERROR: Missing env vars: {', '.join(_missing)}")
    print("Set them in .env or as environment variables. See .env.example.")
    sys.exit(1)

APP_ID = int(_app_id)
INSTALLATION_ID = int(_installation_id)
PEM_PATH = Path(os.path.expanduser(_pem_path))
TOKEN_CACHE = Path(__file__).parent.parent / "data" / ".gh_app_token.json"

# Renew when less than 10 minutes remain
RENEW_THRESHOLD_SECONDS = 600


def _load_cache() -> dict:
    """Load the token cache file."""
    if TOKEN_CACHE.exists():
        try:
            return json.loads(TOKEN_CACHE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_cache(expires_at: float) -> None:
    """Save token expiry to cache."""
    TOKEN_CACHE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_CACHE.write_text(json.dumps({
        "expires_at": expires_at,
        "refreshed_at": time.time(),
    }, indent=2))


def is_token_valid() -> bool:
    """Check if the cached token still has enough time remaining."""
    cache = _load_cache()
    expires_at = cache.get("expires_at", 0)
    remaining = expires_at - time.time()
    return remaining > RENEW_THRESHOLD_SECONDS


def generate_jwt() -> str:
    """Generate a JWT signed with the app's private key."""
    pem = PEM_PATH.read_bytes()
    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + (10 * 60),
        "iss": str(APP_ID),
    }
    return jwt.encode(payload, pem, algorithm="RS256")


def get_installation_token() -> str:
    """Exchange the JWT for an installation access token.

    Tries curl first (works without gh auth — needed for first Docker setup),
    falls back to gh api (works on host where gh is already authenticated).
    """
    token_jwt = generate_jwt()
    url = f"https://api.github.com/app/installations/{INSTALLATION_ID}/access_tokens"

    # Try curl first (no prior auth needed — works in fresh Docker containers)
    proc = subprocess.run(
        [
            "curl", "-fsSL", "-X", "POST",
            "-H", f"Authorization: Bearer {token_jwt}",
            "-H", "Accept: application/vnd.github+json",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode == 0:
        try:
            return json.loads(proc.stdout)["token"]
        except (json.JSONDecodeError, KeyError):
            pass

    # Fallback to gh api (for hosts where curl may have proxy issues but gh works)
    # No leading slash — Git Bash on Windows rewrites /app as a filesystem path
    proc = subprocess.run(
        [
            "gh", "api",
            f"app/installations/{INSTALLATION_ID}/access_tokens",
            "--method", "POST",
            "--header", f"Authorization: Bearer {token_jwt}",
            "--jq", ".token",
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(f"Error getting token: {proc.stderr}", file=sys.stderr)
        sys.exit(1)
    return proc.stdout.strip()


def _update_git_remote(token: str) -> None:
    """Update the git remote URL to embed the access token.

    Windows Credential Manager caches stale tokens and gh auth setup-git
    does not propagate reliably. Embedding the token in the remote URL
    bypasses the credential helper entirely. Tokens are ephemeral (1h).
    """
    proc = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print("Warning: could not read git remote URL", file=sys.stderr)
        return

    url = proc.stdout.strip()

    # Strip any existing embedded credentials
    # https://x-access-token:OLD@github.com/... → https://github.com/...
    clean_url = re.sub(r"https://[^@]+@github\.com/", "https://github.com/", url)

    # Embed the new token
    authed_url = clean_url.replace(
        "https://github.com/",
        f"https://x-access-token:{token}@github.com/",
    )

    if authed_url == url:
        return

    proc = subprocess.run(
        ["git", "remote", "set-url", "origin", authed_url],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(f"Warning: could not update remote URL: {proc.stderr}", file=sys.stderr)
    else:
        print("git remote updated with embedded token")


def setup_gh_cli(token: str) -> None:
    """Configure gh CLI and git credentials with the app token."""
    # 1. Configure gh CLI
    proc = subprocess.run(
        ["gh", "auth", "login", "--with-token"],
        input=token,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(f"Error setting up gh: {proc.stderr}", file=sys.stderr)
        sys.exit(1)

    # 2. Update git remote so git push works without credential helper
    _update_git_remote(token)

    # Token valid for 1 hour from now
    _save_cache(expires_at=time.time() + 3600)
    print("gh CLI configured with app token (valid for 1 hour)")


def main() -> None:
    if not PEM_PATH.exists():
        print(f"Error: PEM file not found at {PEM_PATH}", file=sys.stderr)
        sys.exit(1)

    force = "--force" in sys.argv
    check = "--check" in sys.argv
    setup = "--setup" in sys.argv

    if check:
        if is_token_valid():
            cache = _load_cache()
            remaining = int(cache.get("expires_at", 0) - time.time())
            print(f"Token valid ({remaining // 60}m remaining)")
        else:
            print("Token expired or expiring soon — run with --setup")
            sys.exit(1)
        return

    if setup and not force and is_token_valid():
        cache = _load_cache()
        remaining = int(cache.get("expires_at", 0) - time.time())
        print(f"Token still valid ({remaining // 60}m remaining), skipping refresh")
        return

    token = get_installation_token()

    if setup:
        setup_gh_cli(token)
    else:
        print(token)


if __name__ == "__main__":
    main()
