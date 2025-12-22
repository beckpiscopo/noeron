#!/usr/bin/env python3
"""Identify under-contextualized podcast claims and back them with RAG hits."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import types
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from textwrap import shorten
from typing import Iterable, List, Optional, Tuple, Dict

# The helper script runs in environments that may not have an `.env` file or
# the `pypdf`/`arxiv` dependencies installed. We register minimal stubs before
# importing the MCP server to keep the `rag_search` tool usable without
# triggering real PDF/ArXiv logic.
os.environ.setdefault("FASTMCP_ENV_FILE", "/dev/null")

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def _register_stub(module_name: str, initializer) -> None:
    if module_name in sys.modules:
        return
    module = types.ModuleType(module_name)
    initializer(module)
    sys.modules[module_name] = module


def _setup_dependency_stubs() -> None:
    def init_pypdf(module: types.ModuleType) -> None:
        class PdfReader:
            def __init__(self, *args, **kwargs):
                raise RuntimeError(
                    "pypdf is unavailable in this helper script."
                    " Install `pypdf` to run the full MCP server."
                )

        module.PdfReader = PdfReader

    def init_arxiv(module: types.ModuleType) -> None:
        class Search:
            def __init__(self, *args, **kwargs):
                pass

            def results(self):
                return []

        class SortCriterion:
            Relevance = "relevance"

        module.Search = Search
        module.SortCriterion = SortCriterion

    _register_stub("pypdf", init_pypdf)
    _register_stub("arxiv", init_arxiv)


_setup_dependency_stubs()

from src.bioelectricity_research.server import rag_search  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)

REGISTRY_PATH = REPO_ROOT / "data" / "context_card_registry.json"
SENTENCE_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+")
NUMERIC_PATTERN = re.compile(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b")
CLAIM_KEYWORDS = {
    "study",
    "data",
    "evidence",
    "observed",
    "shows",
    "demonstrate",
    "suggests",
    "suggest",
    "analysis",
    "model",
    "mechanism",
    "novel",
    "statist",
    "rate",
    "percent",
    "controls",
    "correlat",
    "predict",
    "finding",
    "conclusions",
    "experiment",
    "results",
    "support",
    "impact",
}
MAX_CLAIMS_PER_SEGMENT = 5
MIN_SENTENCE_LENGTH = 40


@dataclass
class ClaimCandidate:
    text: str
    note_matched: bool


@dataclass
class ContextCard:
    timestamp: str
    heading: str
    claim_text: str
    paper_title: str
    section: str
    rationale: str
    source_link: str


def split_sentences(text: str) -> List[str]:
    return [
        sentence.replace("\n", " ").strip()
        for sentence in SENTENCE_SPLIT_REGEX.split(text.strip())
        if sentence.strip()
    ]


def detect_claims(segment_text: str, user_note: Optional[str]) -> List[ClaimCandidate]:
    note_terms = {token for token in re.split(r"\s+", user_note.lower()) if token} if user_note else set()
    seen: set[str] = set()
    candidates: List[ClaimCandidate] = []

    for sentence in split_sentences(segment_text):
        if sentence in seen or len(sentence) < MIN_SENTENCE_LENGTH:
            continue
        seen.add(sentence)
        lower = sentence.lower()
        score = 0

        if NUMERIC_PATTERN.search(lower):
            score += 2

        if any(keyword in lower for keyword in CLAIM_KEYWORDS):
            score += 1

        if "is" in lower.split()[:2] or lower.startswith(("we ", "i ", "this ")):
            score += 1

        if note_terms and any(term in lower for term in note_terms):
            score += 1

        if score >= 2:
            candidates.append(ClaimCandidate(text=sentence, note_matched=bool(note_terms & set(re.split(r"\s+", lower)))))

    candidates.sort(key=lambda candidate: (-int(candidate.note_matched), -len(candidate.text)))
    return candidates[:MAX_CLAIMS_PER_SEGMENT]


def load_registry(path: Path) -> Dict[str, dict]:
    if not path.exists():
        return {"segments": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logging.warning("Registry file corrupted. Recreating a clean one.")
        return {"segments": {}}


def save_registry(path: Path, data: Dict[str, dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def build_segment_key(timestamp: str, heading: str) -> str:
    return f"{timestamp or 'unknown'}|{heading or 'general'}"


def parse_rag_output(raw: str) -> Tuple[Optional[List[dict]], Optional[str]]:
    if not raw:
        return [], "Empty response from rag_search"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        if "No matching chunks" in raw:
            return [], "No matching documents in vector store."
        return None, f"Unexpected rag_search response:\n{raw.strip()}"

    if not isinstance(parsed, dict):
        return None, "rag_search returned an unexpected structure."

    return parsed.get("results", []), None


async def query_rag_for_claim(claim_text: str) -> Tuple[Optional[List[dict]], Optional[str]]:
    try:
        raw = await rag_search(claim_text, n_results=3, response_format="json")
    except Exception as exc:
        return None, f"rag_search raised an exception: {exc}"

    return parse_rag_output(raw)


def format_source_link(paper_id: Optional[str]) -> str:
    if paper_id:
        return f"https://semanticscholar.org/paper/{paper_id}"
    return "Paper ID unavailable"


def build_context_card(
    timestamp: str,
    heading: str,
    claim: ClaimCandidate,
    result: dict,
) -> ContextCard:
    paper_title = result.get("paper_title") or "Untitled paper"
    section = result.get("section") or result.get("section_heading") or "Unknown section"
    snippet = shorten(result.get("text", "").replace("\n", " "), width=220, placeholder="…")
    rationale = f"Matches the paper section by quoting: {snippet or 'No snippet available.'}"
    source_link = format_source_link(result.get("paper_id"))

    return ContextCard(
        timestamp=timestamp or "undefined",
        heading=heading or "General",
        claim_text=claim.text,
        paper_title=paper_title,
        section=section,
        rationale=rationale,
        source_link=source_link,
    )


async def enrich_claims(
    timestamp: str,
    heading: str,
    claims: Iterable[ClaimCandidate],
) -> Tuple[List[ContextCard], List[Tuple[str, str]]]:
    cards: List[ContextCard] = []
    misses: List[Tuple[str, str]] = []

    for claim in claims:
        hits, error = await query_rag_for_claim(claim.text)
        if hits:
            cards.append(build_context_card(timestamp, heading, claim, hits[0]))
        else:
            misses.append((claim.text, error or "No matching literature found."))

    return cards, misses


def print_cards(cards: List[ContextCard], note: Optional[str]) -> None:
    if not cards:
        print("No supporting context cards generated.")
        return

    print("\nGenerated context cards:")
    for card in cards:
        print("-" * 60)
        print(f"Timestamp: {card.timestamp} | Heading: {card.heading}")
        if note:
            print(f"User note: {note}")
        print(f"Claim: {card.claim_text}")
        print(f"Source: {card.paper_title} — {card.section}")
        print(f"Rationale: {card.rationale}")
        print(f"Link: {card.source_link}")
    print("-" * 60)


def print_misses(misses: List[Tuple[str, str]]) -> None:
    if not misses:
        return
    print("\nClaims without RAG matches:")
    for claim_text, reason in misses:
        print(f"- {claim_text}")
        print(f"  {reason}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Turn transcript claims into MCP context cards."
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--text",
        metavar="TEXT",
        help="Transcript excerpt (text). Surround with quotes if needed.",
    )
    input_group.add_argument(
        "--segment-json",
        type=Path,
        help="Path to JSON file with {timestamp, heading, text, note}.",
    )
    parser.add_argument(
        "--timestamp",
        default="",
        help="Timestamp for the segment (e.g., 00:32:15).",
    )
    parser.add_argument("--heading", default="", help="Segment heading if available.")
    parser.add_argument(
        "--note",
        default="",
        help="Optional user note describing where to focus.",
    )
    parser.add_argument(
        "--redo",
        action="store_true",
        help="Re-run even when a card already exists for the same timestamp/heading.",
    )

    args = parser.parse_args()

    if args.segment_json:
        payload = json.loads(args.segment_json.read_text(encoding="utf-8"))
        segment = {
            "timestamp": payload.get("timestamp", args.timestamp),
            "heading": payload.get("heading", args.heading),
            "text": payload.get("text", ""),
        }
        note = args.note or payload.get("note", "")
    else:
        segment = {"timestamp": args.timestamp, "heading": args.heading, "text": args.text}
        note = args.note

    if not segment["text"]:
        parser.error("Transcript text is required via --text or --segment-json.")

    registry = load_registry(REGISTRY_PATH)
    segment_key = build_segment_key(str(segment["timestamp"]), str(segment["heading"]))

    if segment_key in registry["segments"] and not args.redo:
        once = registry["segments"][segment_key]
        print(
            "This segment already produced context cards on "
            f"{once.get('last_processed', 'unknown date')}."
            " Pass --redo to refresh."
        )
        return

    claims = detect_claims(segment["text"], note)
    if not claims:
        print("No under-contextualized claims detected in this segment.")
        registry["segments"][segment_key] = {
            "timestamp": segment["timestamp"],
            "heading": segment["heading"],
            "note": note,
            "claims": [],
            "card_count": 0,
            "last_processed": datetime.utcnow().isoformat(),
        }
        save_registry(REGISTRY_PATH, registry)
        return

    cards, misses = asyncio.run(
        enrich_claims(
            timestamp=str(segment["timestamp"]),
            heading=str(segment["heading"]),
            claims=claims,
        )
    )

    print_cards(cards, note)
    print_misses(misses)

    registry["segments"][segment_key] = {
        "timestamp": segment["timestamp"],
        "heading": segment["heading"],
        "note": note,
        "claims": [claim.text for claim in claims],
        "card_count": len(cards),
        "last_processed": datetime.utcnow().isoformat(),
    }
    save_registry(REGISTRY_PATH, registry)


if __name__ == "__main__":
    main()

