#!/usr/bin/env python3
"""Task Coordinator — prevents overlapping autonomous cycles.

Usage:
  python scripts/task_coordinator.py acquire <task_name>   → "acquired" or "busy"
  python scripts/task_coordinator.py release <task_name>   → releases the lock
  python scripts/task_coordinator.py status                → shows all active tasks
  python scripts/task_coordinator.py clear                 → force-clear all locks
"""

import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
LOCK_FILE = PROJECT_ROOT / "data" / ".task_locks.json"
MAX_LOCK_AGE_SECONDS = 1800  # 30 min


def _load_locks() -> dict:
    if LOCK_FILE.exists():
        try:
            return json.loads(LOCK_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_locks(locks: dict) -> None:
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOCK_FILE.write_text(json.dumps(locks, indent=2), encoding="utf-8")


def _clean_stale(locks: dict) -> dict:
    now = time.time()
    return {name: info for name, info in locks.items()
            if now - info.get("acquired_at", 0) < MAX_LOCK_AGE_SECONDS}


def acquire(task_name: str) -> bool:
    locks = _clean_stale(_load_locks())
    if task_name in locks:
        return False
    locks[task_name] = {
        "acquired_at": time.time(),
        "started": datetime.now(UTC).isoformat(),
        "pid": os.getpid(),
    }
    _save_locks(locks)
    return True


def release(task_name: str) -> None:
    locks = _load_locks()
    locks.pop(task_name, None)
    _save_locks(locks)


def status() -> dict:
    locks = _clean_stale(_load_locks())
    _save_locks(locks)
    now = time.time()
    return {name: {
        "started": info.get("started", "?"),
        "age_seconds": int(now - info.get("acquired_at", 0)),
        "age_human": f"{int((now - info.get('acquired_at', 0)) // 60)}m",
        "pid": info.get("pid", "?"),
    } for name, info in locks.items()}


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: task_coordinator.py <acquire|release|status|clear> [task_name]")
        sys.exit(1)

    command = sys.argv[1]
    if command == "acquire":
        task = sys.argv[2] if len(sys.argv) > 2 else "dev_cycle"
        if acquire(task):
            print("acquired")
        else:
            info = status().get(task, {})
            print(f"busy (running for {info.get('age_human', '?')})")
    elif command == "release":
        release(sys.argv[2] if len(sys.argv) > 2 else "dev_cycle")
        print("released")
    elif command == "status":
        active = status()
        print(json.dumps(active, indent=2) if active else "No active tasks")
    elif command == "clear":
        _save_locks({})
        print("All locks cleared")
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
