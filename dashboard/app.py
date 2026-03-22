"""Maestro — Development Dashboard.

A Streamlit dashboard for monitoring the autonomous dev pipeline:
- System health (backend, LLM provider, deployer)
- Agent status (active loops, task locks)
- Dev cycle (GitHub Issues, PRs, feature backlog)
- Deploy state (current commit, rollback history)
- Improvement journal

Usage:
    streamlit run dashboard/app.py
"""

from __future__ import annotations

import json
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

import streamlit as st

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
LOGS_DIR = PROJECT_ROOT / "logs"

DEPLOY_STATE = DATA_DIR / ".deploy_state.json"
TASK_LOCKS = DATA_DIR / ".task_locks.json"
SCHEDULED_LOOPS = DATA_DIR / "scheduled_loops.json"
IMPROVEMENTS = DATA_DIR / "improvements.json"
FEATURE_BACKLOG = DATA_DIR / "feature_backlog.json"
THINK_VERDICT = DATA_DIR / "think_verdict.json"
REVIEW_VERDICT = DATA_DIR / "review_verdict.json"
BOT_PAUSE = DATA_DIR / ".bot_pause"

DEPLOY_LOG = LOGS_DIR / "deploy.log"
DEV_LOG = LOGS_DIR / "docker-dev.log"

BACKEND_URL = "http://localhost:5000"
LLM_URL = "http://localhost:5010"

# ---------------------------------------------------------------------------
# Auto-refresh
# ---------------------------------------------------------------------------
if "last_refresh" not in st.session_state:
    st.session_state.last_refresh = time.time()
if time.time() - st.session_state.last_refresh > 30:
    st.session_state.last_refresh = time.time()
    st.rerun()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read_json(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _read_log_tail(path: Path, lines: int = 20) -> str:
    if not path.exists():
        return "(no log file)"
    try:
        all_lines = path.read_text(encoding="utf-8").strip().splitlines()
        return "\n".join(all_lines[-lines:])
    except OSError:
        return "(error reading log)"


def _check_url(url: str) -> tuple[bool, str]:
    try:
        import urllib.request
        r = urllib.request.urlopen(url, timeout=5)
        data = r.read().decode()[:200]
        return True, data
    except Exception as e:
        return False, str(e)


def _age_human(seconds: float) -> str:
    if seconds < 60:
        return f"{int(seconds)}s"
    if seconds < 3600:
        return f"{int(seconds // 60)}m {int(seconds % 60)}s"
    return f"{int(seconds // 3600)}h {int((seconds % 3600) // 60)}m"


# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Maestro Dashboard",
    page_icon="M",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.title("Maestro Dev Pipeline")
st.caption(
    f"Last refresh: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')} "
    "| Auto-refreshes every 30s"
)

# ---------------------------------------------------------------------------
# Sidebar: Agent Controls
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("Agent Controls")

    pause_data = _read_json(BOT_PAUSE) or {}
    is_paused = pause_data.get("agents_paused", False)

    if is_paused:
        st.warning("Agents are PAUSED")
        if st.button("Resume Agents"):
            BOT_PAUSE.write_text(json.dumps({"agents_paused": False}))
            st.rerun()
    else:
        st.success("Agents are ACTIVE")
        if st.button("Pause Agents"):
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            BOT_PAUSE.write_text(json.dumps({"agents_paused": True}))
            st.rerun()

    st.divider()

    # Task lock management
    st.subheader("Task Locks")
    locks = _read_json(TASK_LOCKS) or {}
    if locks:
        now = time.time()
        for name, info in locks.items():
            age = now - info.get("acquired_at", 0)
            st.text(f"{name}: {_age_human(age)}")
        if st.button("Clear All Locks"):
            TASK_LOCKS.write_text("{}")
            st.rerun()
    else:
        st.text("No active locks")

# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------
tab_health, tab_deploy, tab_agents, tab_backlog, tab_logs = st.tabs(
    ["System Health", "Deploy", "Agents", "Feature Backlog", "Logs"]
)

# ===================================================================
# TAB 1: SYSTEM HEALTH
# ===================================================================
with tab_health:
    st.header("System Health")

    col1, col2, col3 = st.columns(3)

    with col1:
        ok, data = _check_url(f"{BACKEND_URL}/")
        if ok:
            st.metric("Backend", "UP", delta="port 5000")
        else:
            st.metric("Backend", "DOWN", delta=data[:50], delta_color="inverse")

    with col2:
        ok, data = _check_url(f"{LLM_URL}/api/v1/health/")
        if ok:
            try:
                health = json.loads(data)
                providers = [k for k, v in health.get("providers", {}).items() if v.get("isAvailable")]
                st.metric("LLM Provider", "UP", delta=", ".join(providers) if providers else "no providers")
            except json.JSONDecodeError:
                st.metric("LLM Provider", "UP", delta="port 5010")
        else:
            st.metric("LLM Provider", "DOWN", delta=data[:50], delta_color="inverse")

    with col3:
        deploy = _read_json(DEPLOY_STATE) or {}
        status = deploy.get("status", "unknown")
        commit = deploy.get("current_commit", "")[:7]
        if status in ("success", "running"):
            st.metric("Deployer", status.upper(), delta=commit)
        else:
            st.metric("Deployer", status.upper(), delta=commit, delta_color="inverse")

    # Git status
    st.subheader("Git")
    try:
        branch = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_ROOT)
        ).stdout.strip()
        log = subprocess.run(
            ["git", "log", "--oneline", "-5"],
            capture_output=True, text=True, timeout=5, cwd=str(PROJECT_ROOT)
        ).stdout.strip()
        st.text(f"Branch: {branch}")
        st.code(log)
    except Exception as e:
        st.error(f"Git error: {e}")

# ===================================================================
# TAB 2: DEPLOY
# ===================================================================
with tab_deploy:
    st.header("Deploy State")

    deploy = _read_json(DEPLOY_STATE)
    if deploy:
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Status", deploy.get("status", "unknown").upper())
        col2.metric("Commit", deploy.get("current_commit", "")[:7])
        col3.metric("Failures", deploy.get("consecutive_failures", 0))
        last = deploy.get("last_deploy", "")
        col4.metric("Last Deploy", last[:19] if last else "never")

        if deploy.get("rollback_reason"):
            st.error(f"Last rollback reason: {deploy['rollback_reason']}")

        prev = deploy.get("previous_good_commit", "")
        if prev:
            st.info(f"Previous good commit: {prev[:7]}")

        st.subheader("Full State")
        st.json(deploy)
    else:
        st.info("No deploy state — deployer not yet started.")

    st.subheader("Deploy Log")
    st.code(_read_log_tail(DEPLOY_LOG, 30))

# ===================================================================
# TAB 3: AGENTS
# ===================================================================
with tab_agents:
    st.header("Agent Status")

    # Scheduled loops
    st.subheader("Scheduled Loops")
    loops = _read_json(SCHEDULED_LOOPS)
    if loops:
        started = loops.get("started_at", "")
        st.caption(f"Started at: {started[:19]}")
        for loop in loops.get("loops", []):
            col1, col2, col3 = st.columns([2, 2, 1])
            col1.text(loop.get("name", ""))
            col2.text(loop.get("interval", ""))
            col3.text(loop.get("skill", ""))
    else:
        st.info("No loops scheduled. Run /startup in the dev container.")

    # Active locks
    st.subheader("Active Tasks")
    locks = _read_json(TASK_LOCKS) or {}
    if locks:
        now = time.time()
        for name, info in locks.items():
            age = now - info.get("acquired_at", 0)
            col1, col2, col3 = st.columns([2, 1, 1])
            col1.text(name)
            col2.text(f"Running: {_age_human(age)}")
            col3.text(f"PID: {info.get('pid', '?')}")
    else:
        st.success("No tasks running")

    # Latest verdicts
    st.subheader("Latest Verdicts")
    col1, col2 = st.columns(2)
    with col1:
        st.text("Think Verdict")
        think = _read_json(THINK_VERDICT)
        if think:
            st.json(think)
        else:
            st.text("(none)")
    with col2:
        st.text("Review Verdict")
        review = _read_json(REVIEW_VERDICT)
        if review:
            st.json(review)
        else:
            st.text("(none)")

# ===================================================================
# TAB 4: FEATURE BACKLOG
# ===================================================================
with tab_backlog:
    st.header("Feature Backlog")

    backlog = _read_json(FEATURE_BACKLOG)
    if backlog and isinstance(backlog, list):
        # Summary metrics
        total = len(backlog)
        done = sum(1 for f in backlog if f.get("status") == "done")
        in_progress = sum(1 for f in backlog if f.get("status") == "in_progress")
        proposed = sum(1 for f in backlog if f.get("status") == "proposed")

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total", total)
        col2.metric("Done", done)
        col3.metric("In Progress", in_progress)
        col4.metric("Proposed", proposed)

        # Table
        st.subheader("Features")
        for f in backlog:
            status_icon = {"done": "✅", "in_progress": "🔨", "proposed": "💡"}.get(f.get("status", ""), "❓")
            priority_color = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(f.get("priority", ""), "⚪")
            st.text(f"{status_icon} {priority_color} {f.get('id', '')} — {f.get('title', '')}")
    else:
        st.info("No features in backlog. Run /think to propose features.")

    # Improvement journal
    st.subheader("Improvement Journal")
    improvements = _read_json(IMPROVEMENTS)
    if improvements and isinstance(improvements, list):
        st.metric("Total Attempts", len(improvements))
        for entry in reversed(improvements[-10:]):
            with st.expander(f"{entry.get('date', '')[:10]} — {entry.get('type', '')} — {entry.get('outcome', 'pending')}"):
                st.text(f"Hypothesis: {entry.get('hypothesis', '')}")
                st.text(f"Action: {entry.get('action', '')}")
                st.text(f"Outcome: {entry.get('outcome', 'pending')}")
                if entry.get("lessons_learned"):
                    st.text(f"Lessons: {entry['lessons_learned']}")
    else:
        st.info("No improvement attempts recorded yet.")

# ===================================================================
# TAB 5: LOGS
# ===================================================================
with tab_logs:
    st.header("Logs")

    log_choice = st.selectbox("Log source", ["Deploy", "Dev Agent", "Backend", "LLM Provider"])

    if log_choice == "Deploy":
        st.code(_read_log_tail(DEPLOY_LOG, 50))
    elif log_choice == "Dev Agent":
        st.code(_read_log_tail(DEV_LOG, 50))
    elif log_choice == "Backend":
        st.code(_read_log_tail(LOGS_DIR / "backend_stdout.log", 50))
    elif log_choice == "LLM Provider":
        st.code(_read_log_tail(LOGS_DIR / "llm-provider_stdout.log", 50))
