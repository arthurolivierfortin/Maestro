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

# ── GitHub App auth + set git remote URL with token ──
cd /app
if [ -n "${GITHUB_APP_ID:-}" ] && ls ~/.github-apps/*.pem 1>/dev/null 2>&1; then
    TOKEN=$(python3 scripts/gh_app_auth.py 2>/dev/null)
    if [ -n "$TOKEN" ]; then
        REPO="${GITHUB_REPO:-}"
        if [ -z "$REPO" ]; then
            REPO=$(git remote get-url origin 2>/dev/null | sed -E 's|.*github\.com[:/](.+)(\.git)?$|\1|' | sed 's/\.git$//')
        fi
        if [ -n "$REPO" ]; then
            git remote set-url origin "https://x-access-token:${TOKEN}@github.com/${REPO}.git"
        fi
        echo "GitHub App: token applied to git remote"
    else
        echo "GitHub App: FAILED to get token"
    fi
else
    echo "GitHub App: not configured (set GITHUB_APP_ID in .env)"
fi

# ── Launch deployer ──
exec python3 /app/scripts/deployer.py
