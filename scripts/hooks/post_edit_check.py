#!/usr/bin/env python3
"""PostToolUse hook — triggers automatic validation after edits.

Non-blocking (exit 0). Output goes to stderr as info for Claude.
Routes tests based on which file was modified.
"""

import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = str(Path(__file__).resolve().parent.parent.parent)


def run_cmd(cmd: list[str], label: str, cwd: str = PROJECT_ROOT) -> str:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, cwd=cwd)
        if result.returncode == 0:
            return f"[{label}] PASSED"
        else:
            return f"[{label}] FAILED:\n{result.stdout[-300:]}\n{result.stderr[-200:]}"
    except subprocess.TimeoutExpired:
        return f"[{label}] TIMED OUT (120s)"
    except FileNotFoundError:
        return f"[{label}] Command not found"


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    file_path = input_data.get("tool_input", {}).get("file_path", "").replace("\\", "/")
    results = []

    backend_dir = f"{PROJECT_ROOT}/apps/backend"

    # C# files → dotnet build + relevant tests
    if file_path.endswith(".cs"):
        results.append(run_cmd(
            ["dotnet", "build", "--no-restore", "-v", "quiet"],
            "Build", cwd=backend_dir))

        if "/Maestro.Domain/" in file_path:
            results.append(run_cmd(
                ["dotnet", "test", "--no-build", "--filter", "FullyQualifiedName~Domain"],
                "Domain Tests", cwd=backend_dir))
        elif "/Maestro.Infrastructure/" in file_path:
            results.append(run_cmd(
                ["dotnet", "test", "--no-build", "--filter", "FullyQualifiedName~Infrastructure"],
                "Infra Tests", cwd=backend_dir))
        elif "/Maestro.Api/" in file_path:
            results.append(run_cmd(
                ["dotnet", "test", "--no-build"],
                "All Tests", cwd=backend_dir))

    # TypeScript files → tsc + vitest
    elif file_path.endswith((".ts", ".tsx")):
        if "/maestro-code/" in file_path:
            results.append(run_cmd(
                ["npx", "tsc", "--noEmit"],
                "TypeScript", cwd=f"{PROJECT_ROOT}/packages/maestro-code"))
        elif "/maestro-cli/" in file_path:
            results.append(run_cmd(
                ["npx", "tsc", "--noEmit"],
                "TypeScript", cwd=f"{PROJECT_ROOT}/packages/maestro-cli"))

    if results:
        print("\n".join(results), file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
