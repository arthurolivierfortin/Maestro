#!/bin/bash
set -uo pipefail

LOGFILE="/app/logs/docker-dev.log"

log() {
    echo "[$(date -u '+%H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# ── Phase 1: Run as root — fix permissions ──
if [ "$(id -u)" = "0" ]; then
    mkdir -p /app/data /app/logs /home/node/.claude
    chown -R node:node /app/data /app/logs /home/node/.claude 2>/dev/null || true

    # Apply Docker-specific configs
    cp /app/.mcp.json.docker /app/.mcp.json
    cp /app/.claude/settings.json.docker /app/.claude/settings.json
    chown -R node:node /app/.claude /app/.mcp.json

    # Patch skill files for Linux paths
    find /app/.claude/skills -name "SKILL.md" -exec sed -i 's|C:/Meastro|/app|g' {} + 2>/dev/null || true
    find /app/.claude/skills -name "SKILL.md" -exec sed -i 's|C:\\Meastro|/app|g' {} + 2>/dev/null || true

    # Drop to user node
    exec gosu node "$0" "$@"
fi

# ── Phase 2: Run as node ──
echo "" > "$LOGFILE"
log "=== Maestro Dev Agent ==="

# ── Skip onboarding ──
if [ ! -f ~/.claude.json ] || ! grep -q "hasCompletedOnboarding" ~/.claude.json 2>/dev/null; then
    echo '{"hasCompletedOnboarding":true}' > ~/.claude.json
    log "Onboarding: skipped"
fi

# ── Claude settings ──
if [ ! -f ~/.claude/settings.json ]; then
    echo '{"effortLevel":"high","skipDangerousModePermissionPrompt":true,"theme":"dark","autoUpdatesChannel":"stable"}' > ~/.claude/settings.json
    log "Settings: initialized"
fi

# ── Git config ──
git config --global user.name "maestro-dev[bot]"
git config --global user.email "maestro-dev[bot]@users.noreply.github.com"
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
        python3 scripts/gh_app_auth.py --setup --force 2>/dev/null
        log "GitHub App: OK (token applied to git remote)"
    else
        log "GitHub App: FAILED (will retry via /health)"
    fi
else
    log "GitHub App: not configured (set GITHUB_APP_ID in .env)"
fi

# ── Checkout dev branch ──
git fetch origin dev 2>/dev/null || true
git checkout dev 2>/dev/null || log "Could not checkout dev"
log "Git: on branch $(git branch --show-current)"

# ── Launch Claude Code ──
export TERM=xterm-256color

log "Starting Claude Code (interactive)"
log "Attach: docker attach maestro-dev"
log "Tip: type /startup after attaching"
log "---"

exec claude --dangerously-skip-permissions
