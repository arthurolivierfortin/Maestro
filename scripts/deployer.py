#!/usr/bin/env python3
"""Deployer — watches GitHub main branch, auto-deploys with rollback.

Runs as the main process in the maestro-main container.
Polls GitHub every 5 minutes for new commits on main.
On new commit: pull → dotnet build → dotnet test → restart services (or rollback on failure).

Pure stdlib + subprocess — no project library imports.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Constants ──
APP_DIR = Path(os.environ.get("APP_DIR", "/app"))
DATA_DIR = APP_DIR / "data"
LOGS_DIR = APP_DIR / "logs"
DEPLOY_STATE = DATA_DIR / ".deploy_state.json"
DEPLOY_LOG = LOGS_DIR / "deploy.log"

BACKEND_DIR = APP_DIR / "apps" / "backend"
LLM_PROVIDER_DIR = APP_DIR / "llm-provider" / "dotnet"

POLL_INTERVAL = 300  # 5 minutes
HEALTH_WAIT = 30  # seconds after restart before health check
MAX_CONSECUTIVE_FAILURES = 3
BACKOFF_INTERVAL = 1800  # 30 min after too many failures

# ── Logging ──
logger = logging.getLogger("deployer")


def setup_logging() -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("[%(asctime)s] %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    file_handler = logging.FileHandler(DEPLOY_LOG, encoding="utf-8")
    file_handler.setFormatter(fmt)
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(file_handler)
    logger.addHandler(stdout_handler)
    logger.setLevel(logging.INFO)


# ── Deploy State ──
def load_state() -> dict:
    if DEPLOY_STATE.exists():
        try:
            return json.loads(DEPLOY_STATE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "current_commit": "",
        "previous_good_commit": None,
        "last_deploy": None,
        "status": "initial",
        "consecutive_failures": 0,
    }


def save_state(state: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DEPLOY_STATE.write_text(json.dumps(state, indent=2))


# ── Commands ──
def run_cmd(cmd: list[str], timeout: int = 120, cwd: str | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd or str(APP_DIR))


def git_current_commit() -> str:
    r = run_cmd(["git", "rev-parse", "HEAD"])
    return r.stdout.strip() if r.returncode == 0 else ""


def git_fetch_main() -> bool:
    return run_cmd(["git", "fetch", "origin", "main"], timeout=30).returncode == 0


def git_remote_commit() -> str:
    r = run_cmd(["git", "rev-parse", "origin/main"])
    return r.stdout.strip() if r.returncode == 0 else ""


def git_pull_main() -> bool:
    return run_cmd(["git", "reset", "--hard", "origin/main"]).returncode == 0


def git_rollback(commit: str) -> bool:
    return run_cmd(["git", "reset", "--hard", commit]).returncode == 0


def git_short_hash() -> str:
    r = run_cmd(["git", "log", "--oneline", "-1"])
    return r.stdout.strip() if r.returncode == 0 else "unknown"


# ── GitHub App Auth ──
def refresh_github_token() -> None:
    try:
        r = run_cmd([sys.executable, str(APP_DIR / "scripts" / "gh_app_auth.py")], timeout=30)
        if r.returncode == 0:
            token = r.stdout.strip()
            repo = os.environ.get("GH_REPO", "")
            if not repo:
                # Fallback: parse from git remote
                url_r = run_cmd(["git", "remote", "get-url", "origin"])
                if url_r.returncode == 0:
                    import re
                    repo = re.sub(r'.*github\.com[:/]', '', url_r.stdout.strip()).replace('.git', '')
            if repo:
                run_cmd(["git", "remote", "set-url", "origin",
                         f"https://x-access-token:{token}@github.com/{repo}.git"])
            logger.info("GitHub token refreshed")
        else:
            logger.warning("GitHub token refresh failed: %s", r.stderr.strip())
    except Exception as e:
        logger.warning("GitHub token refresh error: %s", e)


# ── Test Gate ──
def run_tests() -> tuple[bool, str]:
    """Run dotnet build + dotnet test. Returns (passed, output)."""
    output_parts = []

    # Build backend
    r = run_cmd(["dotnet", "build", "--no-restore", "-c", "Release"],
                timeout=120, cwd=str(BACKEND_DIR))
    if r.returncode != 0:
        output_parts.append(f"BUILD FAILED:\n{r.stdout}\n{r.stderr}")
        return False, "\n".join(output_parts)
    output_parts.append("Build: OK")

    # Run tests
    r = run_cmd(["dotnet", "test", "--no-build", "-c", "Release", "--logger", "console;verbosity=quiet"],
                timeout=180, cwd=str(BACKEND_DIR))
    if r.returncode != 0:
        output_parts.append(f"TESTS FAILED:\n{r.stdout}\n{r.stderr}")
        return False, "\n".join(output_parts)
    output_parts.append(f"Tests: OK\n{r.stdout.strip()[-200:]}")

    return True, "\n".join(output_parts)


# ── Service Management ──
class ServiceProcess:
    """Manages a dotnet service subprocess."""

    def __init__(self, name: str, dll_path: Path, port: int) -> None:
        self.name = name
        self.dll_path = dll_path
        self.port = port
        self.process: subprocess.Popen | None = None

    def start(self) -> bool:
        if self.is_alive():
            logger.info("%s already running (PID %d)", self.name, self.process.pid)
            return True
        try:
            env = os.environ.copy()
            env["ASPNETCORE_URLS"] = f"http://0.0.0.0:{self.port}"
            stdout = open(LOGS_DIR / f"{self.name}_stdout.log", "w")
            stderr = open(LOGS_DIR / f"{self.name}_stderr.log", "w")
            self.process = subprocess.Popen(
                ["dotnet", str(self.dll_path)],
                stdout=stdout, stderr=stderr, env=env,
            )
            logger.info("%s started (PID %d, port %d)", self.name, self.process.pid, self.port)
            return True
        except Exception as e:
            logger.error("%s start failed: %s", self.name, e)
            return False

    def stop(self) -> None:
        if not self.process:
            return
        pid = self.process.pid
        logger.info("Stopping %s (PID %d)...", self.name, pid)
        try:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        except Exception as e:
            logger.error("Error stopping %s: %s", self.name, e)
        self.process = None

    def restart(self) -> bool:
        self.stop()
        time.sleep(2)
        return self.start()

    def is_alive(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def is_healthy(self) -> bool:
        if not self.is_alive():
            return False
        try:
            import urllib.request
            r = urllib.request.urlopen(f"http://localhost:{self.port}/", timeout=5)
            return r.status == 200
        except Exception:
            return False


# ── Deployer ──
class Deployer:
    def __init__(self) -> None:
        self.backend = ServiceProcess("backend", APP_DIR / "backend" / "Maestro.Api.dll", 5000)
        self.llm_provider = ServiceProcess("llm-provider", APP_DIR / "llm-provider" / "LLMProvider.Web.dll", 5010)
        self.state = load_state()
        self.running = True
        self._last_token_refresh = 0.0

        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)

    def _handle_shutdown(self, signum: int, frame: object) -> None:
        logger.info("Shutdown signal received (%d)", signum)
        self.running = False
        self.backend.stop()
        self.llm_provider.stop()

    def _maybe_refresh_token(self) -> None:
        if time.time() - self._last_token_refresh > 3000:
            refresh_github_token()
            self._last_token_refresh = time.time()

    def initial_deploy(self) -> None:
        logger.info("=== Maestro Deployer starting ===")
        self._maybe_refresh_token()

        if git_fetch_main():
            git_pull_main()

        commit = git_current_commit()
        logger.info("Current commit: %s", git_short_hash())

        # Start services
        self.llm_provider.start()
        time.sleep(5)
        self.backend.start()

        self.state.update({
            "current_commit": commit,
            "status": "running",
            "last_deploy": datetime.now(timezone.utc).isoformat(),
            "consecutive_failures": 0,
        })
        save_state(self.state)

    def poll_and_deploy(self) -> None:
        self._maybe_refresh_token()

        if not git_fetch_main():
            logger.warning("git fetch failed — skipping this cycle")
            return

        local = git_current_commit()
        remote = git_remote_commit()

        if local == remote:
            # Check service health
            if not self.backend.is_alive():
                logger.warning("Backend not running — restarting")
                self.backend.start()
            if not self.llm_provider.is_alive():
                logger.warning("LLM Provider not running — restarting")
                self.llm_provider.start()
            return

        logger.info("New commit detected: %s -> %s", local[:7], remote[:7])
        rollback_commit = local
        self.state["previous_good_commit"] = rollback_commit

        if not git_pull_main():
            logger.error("git pull failed — skipping deploy")
            return

        logger.info("Pulled: %s", git_short_hash())

        # Test gate
        passed, output = run_tests()
        if not passed:
            logger.error("Tests failed — rolling back\n%s", output)
            self._rollback(rollback_commit, f"Tests failed:\n{output[:500]}")
            return

        logger.info("Tests passed — restarting services")

        self.backend.restart()
        self.llm_provider.restart()

        logger.info("Waiting %ds for health check...", HEALTH_WAIT)
        time.sleep(HEALTH_WAIT)

        if self.backend.is_healthy():
            commit = git_current_commit()
            logger.info("Deploy successful: %s", git_short_hash())
            self.state.update({
                "current_commit": commit,
                "status": "success",
                "last_deploy": datetime.now(timezone.utc).isoformat(),
                "consecutive_failures": 0,
            })
            save_state(self.state)
        else:
            logger.warning("Backend unhealthy after deploy — rolling back")
            self._rollback(rollback_commit, "Backend unhealthy after restart")

    def _rollback(self, commit: str, reason: str) -> None:
        logger.info("Rolling back to %s...", commit[:7])
        git_rollback(commit)
        self.backend.restart()
        self.llm_provider.restart()

        self.state["consecutive_failures"] = self.state.get("consecutive_failures", 0) + 1
        self.state["status"] = "rollback"
        self.state["last_deploy"] = datetime.now(timezone.utc).isoformat()
        self.state["rollback_reason"] = reason
        save_state(self.state)
        logger.info("Rollback complete. Reason: %s", reason)

    def run(self) -> None:
        self.initial_deploy()
        while self.running:
            interval = POLL_INTERVAL
            if self.state.get("consecutive_failures", 0) >= MAX_CONSECUTIVE_FAILURES:
                interval = BACKOFF_INTERVAL
                logger.warning("Too many failures — backing off to %ds", interval)
            for _ in range(interval):
                if not self.running:
                    break
                time.sleep(1)
            if self.running:
                try:
                    self.poll_and_deploy()
                except Exception as e:
                    logger.error("Deploy cycle error: %s", e, exc_info=True)
        logger.info("Deployer stopped")


def main() -> None:
    setup_logging()
    Deployer().run()


if __name__ == "__main__":
    main()
