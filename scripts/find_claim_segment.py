"""Find the transcript chunk that most closely matches a given claim."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from textwrap import shorten
from typing import Iterable, List, Optional, Dict, Any, Mapping, Tuple

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> List[str]:
    return [
        sentence.strip()
        for sentence in SENTENCE_SPLIT_RE.split(text.strip())
        if sentence.strip()
    ]


@dataclass
class SegmentMatch:
    paper_id: str
    paper_title: str
    heading: str
    source_path: str
    chunk: str
    sentence: str
    score: float


def _normalize_context_tags(raw: Optional[Mapping[str, Any]]) -> Dict[str, str]:
    if not raw or not isinstance(raw, Mapping):
        return {}
    normalized: Dict[str, str] = {}
    for key, value in raw.items():
        key_str = str(key).strip()
        if not key_str:
            continue
        value_str = str(value).strip()
        if not value_str:
            continue
        normalized[key_str] = value_str
    return normalized


def _parse_context_tag_argument(arg: str) -> Tuple[str, str]:
    if "=" not in arg:
        raise ValueError("must use KEY=VALUE format")
    key, value = arg.split("=", 1)
    key_str = key.strip()
    value_str = value.strip()
    if not key_str or not value_str:
        raise ValueError("key and value cannot be empty")
    return key_str, value_str


def load_cleaned_segments(cleaned_dir: Path) -> Iterable[dict]:
    for json_path in sorted(cleaned_dir.glob("*.json")):
        try:
            payload = json.loads(json_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        sections = payload.get("sections", [])
        paper_id = payload.get("paper_id", json_path.stem)
        paper_title = payload.get("title", "Transcript")

        for section in sections:
            text = section.get("text", "").strip()
            if not text:
                continue
            yield {
                "paper_id": paper_id,
                "paper_title": paper_title,
                "heading": section.get("heading", ""),
                "text": text,
                "source": str(json_path),
            }


def match_score(claim: str, sentence: str) -> float:
    matcher = SequenceMatcher(None, claim.lower(), sentence.lower())
    ratio = matcher.ratio()
    keywords = set(re.findall(r"\w+", claim.lower()))
    overlap = sum(1 for word in keywords if word and word in sentence.lower())
    return ratio + overlap * 0.01


def find_best_matches(
    claim: str,
    segments: Iterable[dict],
    context_size: int,
    top_n: int,
) -> List[SegmentMatch]:
    claim_clean = claim.strip()
    candidates: List[SegmentMatch] = []

    for segment in segments:
        sentences = split_sentences(segment["text"])
        for index, sentence in enumerate(sentences):
            score = match_score(claim_clean, sentence)
            if score <= 0:
                continue

            start = max(0, index - context_size)
            end = min(len(sentences), index + context_size + 1)
            chunk = " ".join(sentences[start:end]).replace("\n", " ").strip()

            candidates.append(
                SegmentMatch(
                    paper_id=segment["paper_id"],
                    paper_title=segment["paper_title"],
                    heading=segment["heading"],
                    source_path=segment["source"],
                    chunk=chunk,
                    sentence=sentence,
                    score=score,
                )
            )

    candidates.sort(key=lambda match: match.score, reverse=True)
    return candidates[:top_n]


def format_match(match: SegmentMatch, max_width: int = 180) -> str:
    snippet = shorten(match.chunk, width=max_width, placeholder="…")
    return (
        f"Score: {match.score:.3f}\n"
        f"Title: {match.paper_title}\n"
        f"Heading: {match.heading}\n"
        f"Source: {match.source_path}\n"
        f"Matched sentence: {match.sentence}\n"
        f"Chunk: {snippet}\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Locate the transcript segment best aligned with a claim."
    )
    parser.add_argument("--claim", "-c", required=True, help="Claim text to locate.")
    parser.add_argument(
        "--cleaned-dir",
        "-d",
        type=Path,
        default=Path("data/cleaned_papers"),
        help="Directory containing transcript JSON segments.",
    )
    parser.add_argument(
        "--context-size",
        type=int,
        default=2,
        help="Sentences to include before/after the matched sentence.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=3,
        help="Number of candidate segments to return.",
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        help="Write the highest-scoring segment to JSON for `context_card_builder.py`.",
    )
    parser.add_argument(
        "--context-tag",
        action="append",
        help="Attach context metadata as KEY=VALUE when exporting JSON.",
    )
    parser.add_argument(
        "--context-tags-json",
        type=Path,
        help="JSON file that provides a `context_tags` object for the exported segment.",
    )

    args = parser.parse_args()

    if not args.cleaned_dir.exists():
        parser.error(f"{args.cleaned_dir} does not exist.")

    context_tags: Dict[str, str] = {}
    if args.context_tags_json:
        if not args.context_tags_json.exists():
            parser.error(f"{args.context_tags_json} does not exist.")
        try:
            raw_tags = json.loads(args.context_tags_json.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            parser.error(f"Invalid context-tags JSON: {exc}")
        if not isinstance(raw_tags, dict):
            parser.error("Context tags JSON must contain an object.")
        context_tags.update(_normalize_context_tags(raw_tags))

    if args.context_tag:
        for raw_tag in args.context_tag:
            try:
                key, value = _parse_context_tag_argument(raw_tag)
            except ValueError as exc:
                parser.error(f"--context-tag {exc}")
            context_tags[key] = value

    segments = load_cleaned_segments(args.cleaned_dir)
    matches = find_best_matches(args.claim, segments, args.context_size, args.top_k)

    if not matches:
        print("No transcript segments matched the provided claim.")
        return

    print("Top transcript chunks matching your claim:")
    for match in matches:
        print("-" * 80)
        print(format_match(match))

    if args.output_json:
        best = matches[0]
        payload = {
            "timestamp": best.heading or "",
            "heading": best.heading or "",
            "text": best.chunk,
        }
        if context_tags:
            payload["context_tags"] = context_tags
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        print(f"\nSaved best segment to {args.output_json}")


if __name__ == "__main__":
    main()

