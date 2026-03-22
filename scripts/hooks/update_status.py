#!/usr/bin/env python3
"""Stop hook — updates STATUS.md with timestamp when session ends."""

from datetime import UTC, datetime
from pathlib import Path

STATUS_FILE = Path(__file__).parent.parent.parent / "docs" / "STATUS.md"


def main() -> None:
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    line = f"\n**Last agent session**: {now}\n"

    if STATUS_FILE.exists():
        content = STATUS_FILE.read_text()
        # Replace or append
        if "**Last agent session**" in content:
            import re
            content = re.sub(r'\*\*Last agent session\*\*:.*\n', f"**Last agent session**: {now}\n", content)
        else:
            content += line
        STATUS_FILE.write_text(content)
    else:
        STATUS_FILE.write_text(f"# Maestro Status\n{line}")


if __name__ == "__main__":
    main()
