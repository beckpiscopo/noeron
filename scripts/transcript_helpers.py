"""Helpers for turning transcripts into cleaned paper JSON for chunking."""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional


def _clean_text(text: str) -> str:
    """Normalize whitespace and remove repeated empty lines."""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_vtt_lines(lines: List[str]) -> List[Dict[str, str]]:
    """Collect timestamped captions from a WebVTT file."""
    entries: List[Dict[str, str]] = []
    buffer: List[str] = []
    timestamp = ""
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if buffer and timestamp:
                entries.append({"timestamp": timestamp, "text": _clean_text(" ".join(buffer))})
            buffer = []
            timestamp = ""
            continue

        if "-->" in stripped:
            timestamp = stripped
            continue

        if stripped.isdigit():
            continue

        buffer.append(stripped)

    if buffer and timestamp:
        entries.append({"timestamp": timestamp, "text": _clean_text(" ".join(buffer))})

    return entries


def _parse_plain_lines(lines: List[str]) -> List[Dict[str, str]]:
    """Treat each paragraph as its own transcript segment."""
    entries = []
    buffer = []
    for line in lines:
        if not line.strip():
            if buffer:
                entries.append({"timestamp": "", "text": _clean_text(" ".join(buffer))})
                buffer = []
            continue
        buffer.append(line.strip())

    if buffer:
        entries.append({"timestamp": "", "text": _clean_text(" ".join(buffer))})

    return entries


def transcript_to_paper(
    transcript_path: Path,
    paper_id: str,
    title: str,
    output_dir: Optional[Path] = None,
    speaker_delimiter: str = ":",
) -> Dict:
    """
    Turn a transcript (VTT or text) into the cleaned paper format used downstream.

    Args:
        transcript_path: Path to the transcript file.
        paper_id: Unique identifier that will also be the output filename.
        title: Title/description shown in search results.
        output_dir: Optional directory to save the JSON (defaults to data/cleaned_papers).
        speaker_delimiter: Character that separates speaker names from their text.
    """
    text = transcript_path.read_text(encoding="utf-8")
    lines = text.splitlines()

    if transcript_path.suffix.lower() == ".vtt":
        segments = _parse_vtt_lines(lines)
    else:
        segments = _parse_plain_lines(lines)

    sections: List[Dict[str, Optional[str]]] = []
    for idx, segment in enumerate(segments, start=1):
        heading = segment.get("timestamp") or f"Transcript segment {idx}"
        raw_text = segment.get("text") or ""
        speaker = None
        if speaker_delimiter in raw_text:
            left, right = raw_text.split(speaker_delimiter, 1)
            if len(left.split()) <= 5:  # guard against sentences with colons
                speaker = left.strip()
                raw_text = right.strip()

        body = raw_text if raw_text else segment.get("text", "")
        sections.append(
            {
                "heading": heading if not speaker else f"{heading} — {speaker}",
                "page": None,
                "text": body,
            }
        )

    cleaned = {
        "paper_id": paper_id,
        "title": title,
        "authors": ["Transcript"],
        "year": None,
        "full_text": " ".join([s["text"] for s in sections]),
        "sections": sections,
        "source_path": str(transcript_path.resolve()),
    }

    if not output_dir:
        output_dir = Path("data/cleaned_papers")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{paper_id}.json"
    output_path.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")

    return cleaned

