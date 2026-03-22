"""Maestro — Development Pipeline Dashboard.

Streamlit dashboard for monitoring and controlling the autonomous dev pipeline:
- System health (backend, LLM provider, deployer)
- Docker container management (start/stop/rebuild/attach)
- Agent controls (pause/resume, task locks, headless commands)
- Feature pipeline (GitHub Issues → PRs → merge flow)
- Deploy state and logs
- Improvement journal

Usage:
    streamlit run dashboard/app.py --server.port 8503
"""

from __future__ import annotations

import json
import os
import re
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

COMPOSE_FILE = str(PROJECT_ROOT / "docker" / "docker-compose.yml")
COMPOSE_BASE = ["docker", "compose", "-f", COMPOSE_FILE, "--project-directory", str(PROJECT_ROOT)]
GITHUB_REPO_URL = os.environ.get("GH_REPO", "")
if GITHUB_REPO_URL and not GITHUB_REPO_URL.startswith("http"):
    GITHUB_REPO_URL = f"https://github.com/{GITHUB_REPO_URL}"

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


def _open_terminal(command: str, label: str = "terminal") -> None:
    """Open a new terminal window running the given command.

    Tries multiple methods in order. Always shows the command as fallback.
    """
    import shutil
    import subprocess as _sp

    methods = []

    # Method 1: Windows Terminal (most reliable)
    if shutil.which("wt"):
        methods.append(("Windows Terminal", ["wt", "new-tab", "cmd", "/k", command]))

    # Method 2: cmd /c start (opens new window)
    methods.append(("CMD", ["cmd", "/c", "start", "cmd", "/k", command]))

    for method_name, args in methods:
        try:
            _sp.Popen(args)
            st.toast(f"Opening {label} via {method_name}...")
            return
        except Exception:
            continue

    # All methods failed — show command to copy
    st.warning(f"Could not open terminal. Run this manually:")
    st.code(command, language="bash")


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
        return True, r.read().decode()[:500]
    except Exception as e:
        return False, str(e)


def _age_human(seconds: float) -> str:
    if seconds < 60:
        return f"{int(seconds)}s"
    if seconds < 3600:
        return f"{int(seconds // 60)}m {int(seconds % 60)}s"
    return f"{int(seconds // 3600)}h {int((seconds % 3600) // 60)}m"


def _container_status(name: str) -> dict:
    try:
        r = subprocess.run(
            ["docker", "inspect", "-f",
             '{"status":"{{.State.Status}}","started":"{{.State.StartedAt}}"}',
             name],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0:
            return json.loads(r.stdout.strip())
    except Exception:
        pass
    return {"status": "not found", "started": ""}


def _container_stats(name: str) -> dict:
    try:
        r = subprocess.run(
            ["docker", "stats", name, "--no-stream",
             "--format", "{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"],
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode == 0 and r.stdout.strip():
            parts = r.stdout.strip().split("\t")
            if len(parts) >= 3:
                return {"cpu": parts[0], "mem": parts[1], "net": parts[2]}
    except Exception:
        pass
    return {}


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
# Tabs
# ---------------------------------------------------------------------------
tab_health, tab_containers, tab_backlog, tab_deploy, tab_logs = st.tabs(
    ["System Health", "Containers & Agents", "Feature Pipeline", "Deploy", "Logs"]
)

# ===================================================================
# TAB 1: SYSTEM HEALTH
# ===================================================================
with tab_health:
    st.header("System Health")

    col1, col2, col3 = st.columns(3)

    with col1:
        ok, data = _check_url("http://localhost:5000/")
        if ok:
            st.metric("Backend", "UP", delta="port 5000")
        else:
            st.metric("Backend", "DOWN", delta=data[:50], delta_color="inverse")

    with col2:
        ok, data = _check_url("http://localhost:5010/api/v1/health/")
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

    # Git
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

    # Block count
    ok_blocks, blocks_data = _check_url("http://localhost:5000/api/blocks")
    if ok_blocks:
        try:
            blocks = json.loads(blocks_data)
            block_list = blocks if isinstance(blocks, list) else blocks.get("blocks", [])
            st.metric("Blocks Discovered", len(block_list))
        except Exception:
            pass

# ===================================================================
# TAB 2: CONTAINERS & AGENTS
# ===================================================================
with tab_containers:
    st.header("Docker Containers")

    main_state = _container_status("maestro-main")
    dev_state = _container_status("maestro-dev")
    main_running = main_state.get("status") == "running"
    dev_running = dev_state.get("status") == "running"

    # ── maestro-main ──
    st.markdown("#### maestro-main (Backend + LLM Provider + Deployer)")
    if main_running:
        started = main_state.get("started", "")[:19].replace("T", " ")
        st.success(f"RUNNING (since {started})")
        stats = _container_stats("maestro-main")
        if stats:
            mc1, mc2, mc3 = st.columns(3)
            mc1.metric("CPU", stats.get("cpu", "?"))
            mc2.metric("Memory", stats.get("mem", "?"))
            mc3.metric("Network", stats.get("net", "?"))

        mc_a1, mc_a2 = st.columns(2)
        with mc_a1:
            if st.button("Open Main Shell", key="main_shell"):
                _open_terminal("docker exec -it maestro-main bash", "main shell")

        with st.expander("Deploy Logs"):
            try:
                r = subprocess.run(
                    ["docker", "exec", "maestro-main", "bash", "-c",
                     "tail -20 /app/logs/deploy.log 2>/dev/null"],
                    capture_output=True, text=True, timeout=5)
                st.code(r.stdout.strip() if r.stdout.strip() else "No logs yet.")
            except Exception:
                st.info("Could not fetch logs.")
    else:
        st.error("STOPPED" if main_state.get("status") == "exited" else "NOT FOUND")
        if st.button("Start maestro-main", key="start_main", type="primary"):
            subprocess.Popen([*COMPOSE_BASE, "up", "-d", "main"])
            time.sleep(5)
            st.rerun()

    st.markdown("---")

    # ── maestro-dev ──
    st.markdown("#### maestro-dev (Claude Code Agents)")
    if dev_running:
        started = dev_state.get("started", "")[:19].replace("T", " ")
        st.success(f"RUNNING (since {started})")
        stats = _container_stats("maestro-dev")
        if stats:
            dc1, dc2, dc3 = st.columns(3)
            dc1.metric("CPU", stats.get("cpu", "?"))
            dc2.metric("Memory", stats.get("mem", "?"))
            dc3.metric("Network", stats.get("net", "?"))

        ac1, ac2 = st.columns(2)
        with ac1:
            if st.button("Attach Claude Terminal"):
                _open_terminal("docker attach maestro-dev", "Claude terminal")
        with ac2:
            if st.button("Open Dev Shell"):
                _open_terminal("docker exec -it -u node maestro-dev bash", "dev shell")
        st.caption("Detach: Ctrl+P, Ctrl+Q | Type /startup after attaching")

        with st.expander("Dev Container Logs"):
            try:
                r = subprocess.run(
                    ["docker", "exec", "-u", "node", "maestro-dev", "bash", "-c",
                     "cat /app/logs/docker-dev.log 2>/dev/null"],
                    capture_output=True, text=True, timeout=5)
                st.code(r.stdout.strip() if r.stdout.strip() else "No logs yet.")
            except Exception:
                st.info("Could not fetch logs.")
    else:
        st.error("STOPPED" if dev_state.get("status") == "exited" else "NOT FOUND")
        if st.button("Start maestro-dev", key="start_dev", type="primary"):
            subprocess.Popen([*COMPOSE_BASE, "up", "-d", "dev"])
            time.sleep(5)
            st.rerun()

    st.markdown("---")

    # ── Global Controls ──
    gc1, gc2, gc3 = st.columns(3)
    with gc1:
        any_running = main_running or dev_running
        if any_running:
            if st.button("Stop All"):
                subprocess.run([*COMPOSE_BASE, "down"],
                               capture_output=True, timeout=30)
                st.rerun()
        else:
            if st.button("Start All", type="primary"):
                subprocess.Popen([*COMPOSE_BASE, "up", "-d"])
                time.sleep(8)
                st.rerun()
    with gc2:
        if st.button("Rebuild All"):
            with st.spinner("Rebuilding..."):
                subprocess.run([*COMPOSE_BASE, "down"],
                               capture_output=True, timeout=30)
                result = subprocess.run(
                    [*COMPOSE_BASE, "build"],
                    capture_output=True, text=True, timeout=600)
                if result.returncode == 0:
                    subprocess.Popen([*COMPOSE_BASE, "up", "-d"])
                    time.sleep(8)
                    st.success("Rebuilt!")
                else:
                    st.error(f"Build failed: {result.stderr[-300:]}")
            st.rerun()
    with gc3:
        headless_cmd = st.text_input("Run headless", placeholder="/health", key="headless")
        if st.button("Run", key="run_headless"):
            if headless_cmd and dev_running:
                with st.spinner(f"Running: {headless_cmd}"):
                    r = subprocess.run(
                        ["docker", "exec", "-u", "node", "maestro-dev",
                         "claude", "--dangerously-skip-permissions", "-p", headless_cmd],
                        capture_output=True, text=True, timeout=180)
                    st.text(r.stdout[:2000] if r.returncode == 0 else f"Failed: {r.stderr[:500]}")
            elif not dev_running:
                st.error("Dev container not running")

    st.divider()

    # ── Agent Controls ──
    st.subheader("Agent Controls")

    pause_data = _read_json(BOT_PAUSE) or {}
    agents_paused = pause_data.get("agents_paused", False)

    col_agents, col_locks = st.columns(2)
    with col_agents:
        if agents_paused:
            st.error("Agents: PAUSED")
            if st.button("Resume Agents", type="primary"):
                pause_data["agents_paused"] = False
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                BOT_PAUSE.write_text(json.dumps(pause_data))
                st.rerun()
        else:
            st.success("Agents: ACTIVE")
            if st.button("Pause Agents"):
                pause_data["agents_paused"] = True
                pause_data["agents_paused_at"] = datetime.now(UTC).isoformat()
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                BOT_PAUSE.write_text(json.dumps(pause_data))
                st.rerun()

    with col_locks:
        st.text("Task Locks")
        locks = _read_json(TASK_LOCKS) or {}
        if locks:
            now = time.time()
            for name, info in locks.items():
                age = now - info.get("acquired_at", 0)
                if age > 1800:
                    st.error(f"{name}: STALE ({_age_human(age)})")
                else:
                    st.success(f"{name}: {_age_human(age)}")
            if st.button("Clear All Locks"):
                TASK_LOCKS.write_text("{}")
                st.rerun()
        else:
            st.text("No active locks")

    # Scheduled loops
    st.subheader("Scheduled Loops")
    loops = _read_json(SCHEDULED_LOOPS)
    if loops:
        st.caption(f"Started: {loops.get('started_at', '')[:19]}")
        for loop in loops.get("loops", []):
            col1, col2, col3 = st.columns([2, 2, 1])
            col1.text(loop.get("name", ""))
            col2.text(loop.get("interval", ""))
            col3.text(loop.get("skill", ""))
    else:
        st.info("No loops scheduled. Attach to dev container and run /startup")

    # Verdicts
    st.subheader("Latest Verdicts")
    v1, v2 = st.columns(2)
    with v1:
        think = _read_json(THINK_VERDICT)
        st.text("Think:")
        st.json(think if think else {"status": "none"})
    with v2:
        review = _read_json(REVIEW_VERDICT)
        st.text("Review:")
        st.json(review if review else {"status": "none"})

# ===================================================================
# TAB 3: FEATURE PIPELINE
# ===================================================================
with tab_backlog:
    st.header("Feature Pipeline")

    # Fetch PRs (cached per session)
    if "pr_cache" not in st.session_state:
        if GITHUB_REPO_URL:
            try:
                repo_arg = GITHUB_REPO_URL.replace("https://github.com/", "")
                r = subprocess.run(
                    ["gh", "pr", "list", "--repo", repo_arg,
                     "--state", "all", "--limit", "100",
                     "--json", "number,title,state,headRefName,url,mergedAt"],
                    capture_output=True, text=True, timeout=15)
                st.session_state.pr_cache = json.loads(r.stdout) if r.returncode == 0 else []
            except Exception:
                st.session_state.pr_cache = []
        else:
            st.session_state.pr_cache = []

    pr_list = st.session_state.pr_cache

    # PR lookup: issue number → PR info
    pr_by_issue: dict[str, dict] = {}
    for pr in pr_list:
        for m in re.findall(r"#(\d+)", pr.get("title", "")):
            pr_by_issue[m] = pr
        for m in re.findall(r"FEAT-(\d+)", pr.get("headRefName", ""), re.IGNORECASE):
            pr_by_issue[m] = pr

    backlog = _read_json(FEATURE_BACKLOG)
    if backlog and isinstance(backlog, list):
        # Categorize
        stages: dict[str, int] = {"proposed": 0, "building": 0, "pr_open": 0, "merged": 0}
        active_features, queued_features, completed_features = [], [], []

        # Find next up (highest priority proposed)
        proposed = [f for f in backlog if f.get("status") == "proposed"]
        proposed.sort(key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.get("priority", "low"), 99))
        next_up_id = proposed[0].get("id", "") if proposed else None

        for f in backlog:
            issue_num = f.get("id", "").replace("#", "")
            issue_url = f"{GITHUB_REPO_URL}/issues/{issue_num}" if issue_num and GITHUB_REPO_URL else ""
            pr_info = pr_by_issue.get(issue_num)

            if f.get("status") == "done" or (pr_info and pr_info.get("state") == "MERGED"):
                stage = "merged"
            elif pr_info:
                stage = "pr_open"
            elif f.get("status") == "in_progress":
                stage = "building"
            else:
                stage = "proposed"

            stages[stage] = stages.get(stage, 0) + 1
            row = {
                "id": f.get("id", ""),
                "title": f.get("title", ""),
                "priority": f.get("priority", ""),
                "stage": stage,
                "issue_url": issue_url,
                "pr_url": pr_info.get("url", "") if pr_info else "",
                "is_next": f.get("id", "") == next_up_id,
            }

            if stage in ("building", "pr_open"):
                active_features.append(row)
            elif stage == "merged":
                completed_features.append(row)
            else:
                queued_features.append(row)

        # Summary
        sc1, sc2, sc3, sc4 = st.columns(4)
        sc1.metric("Proposed", stages["proposed"])
        sc2.metric("Building", stages["building"])
        sc3.metric("PR Open", stages["pr_open"])
        sc4.metric("Merged", stages["merged"])

        # Active
        if active_features:
            st.markdown("#### In Progress")
            for feat in active_features:
                label = "BUILDING" if feat["stage"] == "building" else "PR OPEN"
                cols = st.columns([1, 6, 2, 1, 1])
                cols[0].markdown(f"**{feat['id']}**")
                cols[1].markdown(feat["title"][:60])
                cols[2].markdown(f"**{label}**")
                if feat["issue_url"]:
                    cols[3].link_button("Issue", feat["issue_url"], use_container_width=True)
                if feat["pr_url"]:
                    cols[4].link_button("PR", feat["pr_url"], use_container_width=True)

        # Queued
        if queued_features:
            st.markdown("#### Queued")
            queue_rows = []
            for feat in queued_features:
                queue_rows.append({
                    "": "NEXT" if feat["is_next"] else "",
                    "ID": feat["id"],
                    "Title": feat["title"][:55],
                    "Priority": feat["priority"],
                    "Issue": feat["issue_url"],
                })
            queue_rows.sort(key=lambda r: (0 if r[""] == "NEXT" else 1,
                                           {"high": 0, "medium": 1, "low": 2}.get(r["Priority"], 99)))
            st.dataframe(queue_rows, use_container_width=True, hide_index=True,
                         column_config={
                             "": st.column_config.TextColumn("", width="small"),
                             "Issue": st.column_config.LinkColumn("Issue", display_text=r"View"),
                         })

        # Completed
        if completed_features:
            with st.expander(f"Completed ({len(completed_features)})"):
                done_rows = [{
                    "ID": f["id"], "Title": f["title"][:55],
                    "Issue": f["issue_url"], "PR": f["pr_url"],
                } for f in completed_features]
                st.dataframe(done_rows, use_container_width=True, hide_index=True,
                             column_config={
                                 "Issue": st.column_config.LinkColumn("Issue", display_text=r"View"),
                                 "PR": st.column_config.LinkColumn("PR", display_text=r"View"),
                             })
    else:
        st.info("Feature backlog empty. Run /think to propose features.")

    # Improvement Journal
    st.divider()
    st.subheader("Improvement Journal")
    improvements = _read_json(IMPROVEMENTS)
    if improvements and isinstance(improvements, list):
        total = len(improvements)
        successes = sum(1 for e in improvements if e.get("outcome") == "success")
        failures = sum(1 for e in improvements if e.get("outcome") == "failure")

        jc1, jc2, jc3 = st.columns(3)
        jc1.metric("Total", total)
        jc2.metric("Success", successes)
        jc3.metric("Failed", failures)

        for entry in reversed(improvements[-10:]):
            with st.expander(
                f"{entry.get('date', '')[:10]} — {entry.get('type', '')} — {entry.get('outcome', 'pending')}"
            ):
                st.text(f"Hypothesis: {entry.get('hypothesis', '')}")
                st.text(f"Action: {entry.get('action', '')}")
                if entry.get("lessons_learned"):
                    st.text(f"Lessons: {entry['lessons_learned']}")
    else:
        st.info("No improvement attempts recorded.")

# ===================================================================
# TAB 4: DEPLOY
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
            st.error(f"Last rollback: {deploy['rollback_reason']}")
        if deploy.get("previous_good_commit"):
            st.info(f"Previous good commit: {deploy['previous_good_commit'][:7]}")

        st.subheader("Full State")
        st.json(deploy)
    else:
        st.info("No deploy state — deployer not started yet.")

    st.subheader("Deploy Log")
    st.code(_read_log_tail(DEPLOY_LOG, 30))

# ===================================================================
# TAB 5: LOGS
# ===================================================================
with tab_logs:
    st.header("Logs")

    log_sources = {
        "Deploy": DEPLOY_LOG,
        "Dev Agent": DEV_LOG,
        "Backend": LOGS_DIR / "backend_stdout.log",
        "LLM Provider": LOGS_DIR / "llm-provider_stdout.log",
    }

    log_choice = st.selectbox("Log source", list(log_sources.keys()))
    lines = st.slider("Lines", 10, 100, 30)
    st.code(_read_log_tail(log_sources[log_choice], lines))
