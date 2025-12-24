"""Render cleaned transcript utterances as sentence-bounded lines with timestamps."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Iterable, List


SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> List[str]:
    return [
        sentence.replace("\n", " ").strip()
        for sentence in SENTENCE_SPLIT_RE.split(text.strip())
        if sentence.strip()
    ]


def format_timestamp(ms_value: float | int | None) -> str:
    if ms_value is None:
        return "00:00:00.000"
    total_seconds = float(ms_value) / 1000.0
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = total_seconds % 60
    return f"{hours:02}:{minutes:02}:{seconds:06.3f}"


def render_sentences(
    utterances: Iterable[dict], limit: int | None = None
) -> List[str]:
    lines: List[str] = []
    for utterance in utterances:
        text = utterance.get("text", "").strip()
        if not text:
            continue
        timestamp = format_timestamp(utterance.get("start"))
        speaker = utterance.get("speaker") or "Unknown"
        for sentence in split_sentences(text):
            lines.append(f"[{timestamp}] {speaker}: {sentence}")
            if limit is not None and len(lines) >= limit:
                return lines
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Emit sentences with timestamps and speaker labels."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/cleaned_papers/f46991b7-42f6-4842-a913-68e1877d298a.raw.json"),
        help="Path to the AssemblyAI cleaned transcript JSON.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/transcript_sentences.txt"),
        help="File to write the rendered sentences to.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit the number of sentences emitted (useful for preview).",
    )

    args = parser.parse_args()

    payload = json.loads(args.input.read_text())
    utterances = payload.get("utterances", [])
    lines = render_sentences(utterances, limit=args.limit)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(lines)} sentence lines to {args.output}")


if __name__ == "__main__":
    main()

