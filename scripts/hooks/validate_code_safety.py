#!/usr/bin/env python3
"""PreToolUse hook — blocks unsafe code before it's written.

Called by Claude Code before every Write/Edit tool use.
Exit codes: 0 = allow, 2 = block (stderr message shown to Claude)
"""

import json
import re
import sys

# Files that MUST NOT be modified autonomously.
PROTECTED_FILES = [
    "apps/backend/src/Maestro.Api/Program.cs",  # DI — if corrupted, nothing starts
    "apps/backend/src/Maestro.Domain/ValueObjects/BlockPermissionLevel.cs",  # Permissions
    "scripts/hooks/validate_code_safety.py",  # This file (self-protection)
]


def check_hardcoded_secrets(content: str) -> str | None:
    """Check for hardcoded API keys or secrets."""
    patterns = [
        (r'(?:api_key|secret_key|password|token|api_secret)\s*=\s*["\'][A-Za-z0-9_-]{10,}["\']', "Hardcoded secret"),
        (r'ANTHROPIC_API_KEY\s*=\s*["\']sk-[A-Za-z0-9_-]+["\']', "Hardcoded Anthropic API key"),
        (r'ConnectionString\s*=\s*"[^"]{20,}"', "Hardcoded connection string"),
    ]
    for pattern, message in patterns:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            return f"BLOCKED: {message}. Use environment variables.\nFound: {match.group(0)[:50]}..."
    return None


def check_protected_files(file_path: str) -> str | None:
    """Check if the file being written is protected."""
    normalized = file_path.replace("\\", "/")
    for protected in PROTECTED_FILES:
        if normalized.endswith(protected):
            return (
                f"BLOCKED: {protected} is a protected file. "
                "Modifying safety-critical files requires human approval."
            )
    return None


def check_ts_nocheck(content: str, file_path: str) -> str | None:
    """Block @ts-nocheck — caused the 2026-03-03 incident."""
    if file_path.endswith((".ts", ".tsx")) and "@ts-nocheck" in content:
        return "BLOCKED: @ts-nocheck is forbidden. Fix type errors instead."
    return None


def check_silent_exceptions(content: str, file_path: str) -> str | None:
    """Block silent exception swallowing in critical C# code."""
    critical = ["Domain", "Infrastructure", "Api"]
    if not any(p in file_path for p in critical):
        return None
    if file_path.endswith(".cs") and re.search(r'catch\s*(?:\(Exception[^)]*\))?\s*\{\s*\}', content):
        return "BLOCKED: Empty catch block in critical module. Log or re-throw exceptions."
    return None


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    content = tool_input.get("content", "") or tool_input.get("new_string", "")
    file_path = tool_input.get("file_path", "")

    # Protected files — block ALL edits regardless of content
    result = check_protected_files(file_path)
    if result:
        print(result, file=sys.stderr)
        sys.exit(2)

    if not content:
        sys.exit(0)

    # Content checks
    checks = [
        check_hardcoded_secrets(content),
        check_ts_nocheck(content, file_path),
        check_silent_exceptions(content, file_path),
    ]

    for result in checks:
        if result:
            print(result, file=sys.stderr)
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
