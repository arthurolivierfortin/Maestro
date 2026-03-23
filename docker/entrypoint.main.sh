#!/bin/bash
set -uo pipefail

# ── Fix volume permissions (root phase) ──
if [ "$(id -u)" = "0" ]; then
    chown -R maestro:maestro /app/data /app/logs 2>/dev/null || true
    exec gosu maestro "$0"
fi

# ── Git config ──
git config --global user.name "maestro-deployer[bot]"
git config --global user.email "maestro-deployer[bot]@users.noreply.github.com"
git config --global --add safe.directory /app

# ── GitHub App auth ──
cd /app
if [ -n "${GH_APP_ID:-}" ]; then
    python3 scripts/gh_app_auth.py --setup --force 2>/dev/null && \
        echo "GitHub App: OK" || \
        echo "GitHub App: FAILED"
else
    echo "GitHub App: not configured (set GH_APP_ID in .env)"
fi

# ── Launch deployer ──
exec python3 /app/scripts/deployer.py
