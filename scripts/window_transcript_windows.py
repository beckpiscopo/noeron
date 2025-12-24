"""Generate overlapping windows over transcript utterances for claim testing."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable, List


def format_timestamp(ms_value: float | int | None) -> str:
    if ms_value is None:
        return "00:00:00.000"
    total_seconds = float(ms_value) / 1000.0
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = total_seconds % 60
    return f"{hours:02}:{minutes:02}:{seconds:06.3f}"


def create_overlapping_windows(
    utterances: Iterable[dict],
    window_minutes: int = 3,
    overlap_minutes: int = 1,
) -> List[dict]:
    window_ms = window_minutes * 60 * 1000
    overlap_ms = overlap_minutes * 60 * 1000
    if overlap_ms >= window_ms:
        raise ValueError("overlap_minutes must be less than window_minutes.")

    windows: List[dict] = []
    stride_ms = window_ms - overlap_ms
    current_start = utterances[0].get("start", 0)
    final_end = utterances[-1].get("end", current_start)

    while current_start <= final_end:
        window_end = current_start + window_ms
        window_utterances = [
            u
            for u in utterances
            if u.get("start", 0) < window_end and u.get("end", 0) > current_start
        ]

        if window_utterances:
            windows.append(
                {
                    "window_id": len(windows) + 1,
                    "start_timestamp": format_timestamp(current_start),
                    "end_timestamp": format_timestamp(window_end),
                    "start_ms": current_start,
                    "end_ms": window_end,
                    "text": " ".join(u.get("text", "").strip() for u in window_utterances),
                    "utterances": [
                        {
                            "speaker": u.get("speaker") or "Unknown",
                            "start_ms": u.get("start"),
                            "end_ms": u.get("end"),
                            "text": u.get("text", "").strip(),
                        }
                        for u in window_utterances
                    ],
                }
            )

        current_start += stride_ms

    return windows


def load_utterances(path: Path) -> List[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    utterances = payload.get("utterances", [])
    return sorted(utterances, key=lambda u: u.get("start", 0))


def main() -> None:
    parser = argparse.ArgumentParser(description="Create overlapping transcript windows.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/cleaned_papers/f46991b7-42f6-4842-a913-68e1877d298a.raw.json"),
        help="AssemblyAI JSON with utterances.",
    )
    parser.add_argument(
        "--window-minutes",
        type=int,
        default=3,
        help="Length of each window in minutes.",
    )
    parser.add_argument(
        "--overlap-minutes",
        type=int,
        default=1,
        help="Overlap between windows in minutes.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/window_segments.json"),
        help="File path to write windows JSON.",
    )
    parser.add_argument(
        "--max-windows",
        type=int,
        help="Limit how many windows are emitted (for preview).",
    )

    args = parser.parse_args()

    utterances = load_utterances(args.input)
    if not utterances:
        raise SystemExit("No utterances found in the provided transcript.")

    windows = create_overlapping_windows(
        utterances,
        window_minutes=args.window_minutes,
        overlap_minutes=args.overlap_minutes,
    )

    if args.max_windows:
        windows = windows[: args.max_windows]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(windows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(windows)} windows to {args.output}")


if __name__ == "__main__":
    main()

