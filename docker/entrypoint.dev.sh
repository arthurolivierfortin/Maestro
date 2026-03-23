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

# ── Skip onboarding + trust workspace ──
if [ ! -f ~/.claude.json ] || ! grep -q "hasCompletedOnboarding" ~/.claude.json 2>/dev/null; then
    echo '{"hasCompletedOnboarding":true}' > ~/.claude.json
    log "Onboarding: skipped"
fi

# Pre-trust the /app directory so Claude doesn't prompt
mkdir -p ~/.claude/projects/-app
log "Workspace trust: /app pre-configured"

# ── Claude settings ──
if [ ! -f ~/.claude/settings.json ]; then
    echo '{"effortLevel":"high","skipDangerousModePermissionPrompt":true,"theme":"dark","autoUpdatesChannel":"stable"}' > ~/.claude/settings.json
    log "Settings: initialized"
fi

# ── Git config ──
git config --global user.name "maestro-dev[bot]"
git config --global user.email "maestro-dev[bot]@users.noreply.github.com"
git config --global --add safe.directory /app

# ── GitHub App auth ──
cd /app
if [ -n "${GH_APP_ID:-}" ]; then
    python3 scripts/gh_app_auth.py --setup --force 2>/dev/null && \
        log "GitHub App: OK" || \
        log "GitHub App: FAILED (will retry via /health)"
else
    log "GitHub App: not configured (set GH_APP_ID in .env)"
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

# First run: accept trust prompt non-interactively, then start interactive
if [ ! -f /app/data/.workspace_trusted ]; then
    log "First run: accepting workspace trust..."
    echo "" | claude --dangerously-skip-permissions -p "echo hello" > /dev/null 2>&1 || true
    touch /app/data/.workspace_trusted
    log "Workspace trusted"
fi

exec claude --dangerously-skip-permissions
