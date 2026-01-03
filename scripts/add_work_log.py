#!/usr/bin/env python3
"""Append a brief entry to docs/WORK_LOG.md."""

from __future__ import annotations

import argparse
import subprocess
from datetime import date
from pathlib import Path


def _prompt(label: str) -> str:
    return input(f"{label}: ").strip()


def _format_list_block(text: str) -> str:
    if not text:
        return "- "
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(f"- {line}" for line in lines)

def _git_output(command: list[str]) -> str:
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except Exception:
        return "unknown"


def main() -> None:
    parser = argparse.ArgumentParser(description="Append to docs/WORK_LOG.md")
    parser.add_argument("--task", help="Short task name")
    parser.add_argument("--summary", help="1-3 bullet summary lines")
    parser.add_argument("--decisions", help="Decisions or gotchas (bulleted)")
    parser.add_argument("--next", dest="next_steps", help="Next steps (bulleted)")
    parser.add_argument("--date", help="Entry date (YYYY-MM-DD)")
    parser.add_argument(
        "--file",
        type=Path,
        default=Path("docs/WORK_LOG.md"),
        help="Work log file path",
    )
    args = parser.parse_args()

    entry_date = args.date or date.today().isoformat()
    branch = _git_output(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    commit = _git_output(["git", "rev-parse", "--short", "HEAD"])
    task = args.task or _prompt("Task")
    summary = args.summary or _prompt("Summary (single line or multiline)")
    decisions = args.decisions or _prompt("Decisions/Gotchas (optional)")
    next_steps = args.next_steps or _prompt("Next Steps (optional)")

    entry = [
        "",
        f"Date: {entry_date}",
        f"Task: {task}",
        f"Branch: {branch}",
        f"Commit: {commit}",
        "Summary:",
        _format_list_block(summary),
        "Decisions/Gotchas:",
        _format_list_block(decisions),
        "Next Steps:",
        _format_list_block(next_steps),
        "",
    ]

    args.file.parent.mkdir(parents=True, exist_ok=True)
    existing = args.file.read_text(encoding="utf-8") if args.file.exists() else ""
    if existing and not existing.endswith("\n"):
        existing += "\n"
    args.file.write_text(existing + "\n".join(entry), encoding="utf-8")


if __name__ == "__main__":
    main()
