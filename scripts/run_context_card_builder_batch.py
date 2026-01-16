#!/usr/bin/env python3
"""Batch runner that feeds every window segment through context_card_builder.py."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable, Mapping, Sequence

REPO_ROOT = Path(__file__).resolve().parent.parent
WINDOWS_PATH = REPO_ROOT / "data" / "window_segments.json"


def _load_windows(path: Path) -> Sequence[Mapping[str, object]]:
    if not path.exists():
        raise FileNotFoundError(f"{path} does not exist.")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"{path} must contain a JSON array.")
    return payload


def _prepare_segment_payload(window: Mapping[str, object], note: str | None) -> dict:
    payload = {
        "timestamp": window.get("start_timestamp") or window.get("timestamp") or "",
        "heading": str(window.get("window_id") or window.get("heading") or ""),
        "text": window.get("text") or window.get("content") or "",
    }
    if note:
        payload["note"] = note
    # preserve window-specific metadata for builders that may merge it
    metadata: dict[str, object] = {}
    if window.get("window_id"):
        metadata["window_id"] = window["window_id"]
    if window.get("speaker"):
        metadata["speaker"] = window["speaker"]
    if metadata:
        payload["metadata"] = metadata
    return payload


def _run_builder(
    payload: dict,
    use_gemini: bool,
    redo: bool,
    podcast_id: str,
    episode_title: str,
    note: str | None,
) -> int:
    command = [
        sys.executable,
        "scripts/context_card_builder.py",
        "--segment-json",
    ]
    with tempfile.NamedTemporaryFile(mode="w+", delete=False, suffix=".json") as tmp:
        json.dump(payload, tmp, ensure_ascii=False, indent=2)
        tmp.flush()
        command.append(tmp.name)
        command.extend(["--podcast-id", podcast_id, "--episode-title", episode_title])
        if use_gemini:
            command.append("--use-gemini")
        if redo:
            command.append("--redo")
        if note:
            command.extend(["--note", note])
        # Always clean up the temporary file after the subprocess completes
        result = subprocess.run(command)
    Path(tmp.name).unlink(missing_ok=True)
    return result.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description="Run context_card_builder.py on every window segment.")
    parser.add_argument(
        "--window-json",
        type=Path,
        default=WINDOWS_PATH,
        help="Path to window segments JSON.",
    )
    parser.add_argument(
        "--podcast-id",
        required=True,
        help="Podcast identifier to embed in every registry entry.",
    )
    parser.add_argument(
        "--episode-title",
        required=True,
        help="Human-friendly episode title for the registry metadata.",
    )
    parser.add_argument(
        "--note",
        default="",
        help="Optional note to attach to every segment.",
    )
    parser.add_argument(
        "--use-gemini",
        action="store_true",
        help="Call context_card_builder with --use-gemini.",
    )
    parser.add_argument(
        "--redo",
        action="store_true",
        help="Force context_card_builder to reprocess every segment.",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Zero-based index of the window to start processing.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of windows to process.",
    )
    parser.add_argument(
        "--abort-on-error",
        action="store_true",
        help="Stop the batch if any context_card_builder invocation fails.",
    )

    args = parser.parse_args()

    windows = _load_windows(args.window_json)
    total = len(windows)
    print(f"Loaded {total} windows from {args.window_json}")
    processed = 0

    for idx, window in enumerate(windows):
        if idx < args.start_index:
            continue
        if args.limit is not None and processed >= args.limit:
            break
        payload = _prepare_segment_payload(window, args.note or None)
        if not payload["text"]:
            print(f"[{idx+1}/{total}] Window {payload['heading']} has no text; skipping.")
            continue
        print(f"[{idx+1}/{total}] Processing window_id={payload['heading']} timestamp={payload['timestamp']}")
        status = _run_builder(
            payload,
            use_gemini=args.use_gemini,
            redo=args.redo,
            podcast_id=args.podcast_id,
            episode_title=args.episode_title,
            note=args.note or None,
        )
        if status != 0:
            print(f"  context_card_builder.py exited with {status}")
            if args.abort_on_error:
                sys.exit(status)
        processed += 1

    print(f"Done. Processed {processed} window(s).")


if __name__ == "__main__":
    main()






