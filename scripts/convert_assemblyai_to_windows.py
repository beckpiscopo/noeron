#!/usr/bin/env python3
"""Convert raw AssemblyAI transcript JSON to window_segments format."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


def ms_to_timestamp(ms: int) -> str:
    """Convert milliseconds to HH:MM:SS.mmm format."""
    seconds = ms // 1000
    millis = ms % 1000
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def build_windows(
    utterances: List[Dict[str, Any]],
    window_duration_ms: int = 180_000,  # 3 minutes
    overlap_ms: int = 60_000,  # 1 minute overlap
) -> List[Dict[str, Any]]:
    """
    Group utterances into overlapping time windows.

    Each window covers window_duration_ms and overlaps with the next by overlap_ms.
    """
    if not utterances:
        return []

    # Find the total duration
    max_end_ms = max(u.get("end", 0) for u in utterances)

    windows = []
    window_id = 1
    window_start_ms = 0
    step_ms = window_duration_ms - overlap_ms  # How much to advance each window

    while window_start_ms < max_end_ms:
        window_end_ms = window_start_ms + window_duration_ms

        # Collect utterances that overlap with this window
        window_utterances = []
        for u in utterances:
            u_start = u.get("start", 0)
            u_end = u.get("end", 0)
            # Include if utterance overlaps with window
            if u_start < window_end_ms and u_end > window_start_ms:
                window_utterances.append({
                    "speaker": u.get("speaker", ""),
                    "start_ms": u_start,
                    "end_ms": u_end,
                    "text": u.get("text", ""),
                })

        if window_utterances:
            # Combine text from all utterances in this window
            combined_text = " ".join(u["text"] for u in window_utterances)

            # Actual start/end based on utterances in window
            actual_start = min(u["start_ms"] for u in window_utterances)
            actual_end = max(u["end_ms"] for u in window_utterances)

            windows.append({
                "window_id": window_id,
                "start_timestamp": ms_to_timestamp(actual_start),
                "end_timestamp": ms_to_timestamp(actual_end),
                "start_ms": actual_start,
                "end_ms": actual_end,
                "text": combined_text,
                "utterances": window_utterances,
            })
            window_id += 1

        window_start_ms += step_ms

        # Safety: if we've gone past the end with no new utterances, stop
        if window_start_ms >= max_end_ms:
            break

    return windows


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert AssemblyAI raw JSON to window_segments format."
    )
    parser.add_argument(
        "input_file",
        type=Path,
        help="Path to the raw AssemblyAI JSON file.",
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        help="Output path for window_segments JSON. Defaults to data/window_segments_{input_stem}.json",
    )
    parser.add_argument(
        "--window-duration",
        type=int,
        default=180,
        help="Window duration in seconds (default: 180 = 3 minutes).",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=60,
        help="Overlap between windows in seconds (default: 60 = 1 minute).",
    )
    args = parser.parse_args()

    if not args.input_file.exists():
        raise FileNotFoundError(f"{args.input_file} not found.")

    print(f"Loading {args.input_file}...")
    raw = json.loads(args.input_file.read_text(encoding="utf-8"))

    utterances = raw.get("utterances", [])
    if not utterances:
        raise ValueError("No utterances found in the input file.")

    print(f"Found {len(utterances)} utterances.")

    window_duration_ms = args.window_duration * 1000
    overlap_ms = args.overlap * 1000

    windows = build_windows(
        utterances,
        window_duration_ms=window_duration_ms,
        overlap_ms=overlap_ms,
    )

    print(f"Created {len(windows)} windows.")

    # Determine output path
    if args.output:
        output_path = args.output
    else:
        output_path = Path("data") / f"window_segments_{args.input_file.stem}.json"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(windows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Saved to {output_path}")

    # Print summary
    if windows:
        total_duration_ms = windows[-1]["end_ms"]
        total_minutes = total_duration_ms / 60_000
        print(f"\nSummary:")
        print(f"  Total duration: {total_minutes:.1f} minutes")
        print(f"  Windows: {len(windows)}")
        print(f"  Window duration: {args.window_duration}s, overlap: {args.overlap}s")
        print(f"  First window: {windows[0]['start_timestamp']} - {windows[0]['end_timestamp']}")
        print(f"  Last window: {windows[-1]['start_timestamp']} - {windows[-1]['end_timestamp']}")


if __name__ == "__main__":
    main()
