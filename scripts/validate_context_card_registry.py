#!/usr/bin/env python3
"""Validate the context card registry for metadata/claim consistency."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REGISTRY = REPO_ROOT / "data" / "context_card_registry.json"
TIMESTAMP_RE = re.compile(r"^\d{2}:\d{2}:\d{2}(?:\.\d+)?$")


def _load_registry(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Registry not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _timestamp_valid(value: str) -> bool:
    if not value:
        return False
    return value == "unknown_timestamp" or bool(TIMESTAMP_RE.match(value))


def _validate_segment(
    key: str, entry: Dict[str, Any]
) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    required = ["timestamp", "window_id", "claims", "research_queries", "rag_results", "last_processed"]
    for field in required:
        if field not in entry:
            errors.append(f"{key}: missing required field '{field}'.")
        elif field in {"claims", "research_queries", "rag_results"} and not isinstance(entry[field], list):
            errors.append(f"{key}: '{field}' must be a list.")

    timestamp = entry.get("timestamp", "")
    if not _timestamp_valid(timestamp):
        errors.append(f"{key}: malformed timestamp '{timestamp}'.")

    if not entry.get("window_id"):
        errors.append(f"{key}: window_id is empty.")

    if not entry.get("claims"):
        warnings.append(f"{key}: claims list is empty.")

    for idx, result in enumerate(entry.get("rag_results", []) or []):
        if not isinstance(result, dict):
            errors.append(f"{key}: rag_results[{idx}] is not an object.")
            continue
        if not result.get("claim_text"):
            errors.append(f"{key}: rag_results[{idx}] missing claim_text.")
        if not result.get("source_link"):
            warnings.append(f"{key}: rag_results[{idx}] missing source link.")

    return errors, warnings


def validate_registry(path: Path, podcast_filter: str | None = None) -> Tuple[List[str], List[str]]:
    payload = _load_registry(path)
    segments = payload.get("segments", {})
    seen_identities: set[Tuple[str, str]] = set()
    errors: List[str] = []
    warnings: List[str] = []

    for key, entry in segments.items():
        if podcast_filter and not key.startswith(f"{podcast_filter}|"):
            continue

        segment_errors, segment_warnings = _validate_segment(key, entry)
        errors.extend(segment_errors)
        warnings.extend(segment_warnings)

        identity = (entry.get("timestamp", ""), entry.get("window_id", ""))
        if identity in seen_identities:
            errors.append(f"{key}: duplicate timestamp/window_id {identity}.")
        else:
            seen_identities.add(identity)

    return errors, warnings


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate context card registry metadata.")
    parser.add_argument(
        "--registry",
        type=Path,
        default=DEFAULT_REGISTRY,
        help="Path to the context card registry JSON.",
    )
    parser.add_argument(
        "--podcast-id",
        default="",
        help="Only validate entries belonging to this podcast_id.",
    )
    args = parser.parse_args()

    try:
        errors, warnings = validate_registry(args.registry, args.podcast_id or None)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)

    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"- {warning}")
        print()

    if errors:
        print("ERRORS:")
        for error in errors:
            print(f"- {error}")
        print()
        sys.exit(1)

    print("Registry validation passed.")


if __name__ == "__main__":
    main()

