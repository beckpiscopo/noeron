"""Find the transcript chunk that most closely matches a given claim."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from textwrap import shorten
from typing import Iterable, List, Optional

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

    args = parser.parse_args()

    if not args.cleaned_dir.exists():
        parser.error(f"{args.cleaned_dir} does not exist.")

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
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        print(f"\nSaved best segment to {args.output_json}")


if __name__ == "__main__":
    main()

