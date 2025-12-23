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
from typing import Iterable, List, Optional, Tuple, Dict, Any

try:
    import google.generativeai as genai  # type: ignore[import]
except ImportError:  # pragma: no cover - cleaned up via requirements
    genai = None

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
GEMINI_API_KEY_ENV = "GEMINI_API_KEY"
GEMINI_MODEL_DEFAULT = os.environ.get("GEMINI_MODEL", "gemini-1.5-pro")
GEMINI_MAX_OUTPUT_TOKENS = 1024
_GEMINI_CONFIGURED = False
GEMINI_PROMPT_TEMPLATE = """You are an expert scientific research analyst reviewing podcast transcripts.
You should:
1. Identify up to {max_claims} factual claims that require research evidence to feel trustworthy.
2. Keep `claim_text` as an explicit quote from the transcript.
3. Craft a concise `research_query` that would surface supporting literature via a RAG search.
4. Explain `needs_backing_because` to justify why the claim requires evidence.
5. Assign `confidence_score` between 0 and 1 representing how strongly the claim is unsupported.

Include the transcript segment under "Transcript" and any note or focus area below.
Respond with a strict JSON array containing objects that have the keys `claim_text`, `research_query`, `needs_backing_because`, and `confidence_score`.
Avoid commentary outside of the JSON array.
Transcript:
{segment_text}

User note: {user_note}
"""


@dataclass
class ClaimCandidate:
    text: str
    note_matched: bool
    research_query: Optional[str] = None
    needs_backing_because: Optional[str] = None
    confidence_score: Optional[float] = None


@dataclass
class ContextCard:
    timestamp: str
    heading: str
    claim_text: str
    paper_title: str
    section: str
    rationale: str
    source_link: str
    needs_backing_because: Optional[str] = None
    confidence_score: Optional[float] = None


def _ensure_braces_escaped(value: str) -> str:
    return value.replace("{", "{{").replace("}", "}}")


def _ensure_gemini_client_ready() -> None:
    global _GEMINI_CONFIGURED
    if _GEMINI_CONFIGURED:
        return
    if genai is None:
        raise RuntimeError("google.generativeai is not installed in this environment.")
    api_key = os.environ.get(GEMINI_API_KEY_ENV)
    if not api_key:
        raise RuntimeError(f"{GEMINI_API_KEY_ENV} is required to call Gemini.")
    genai.configure(api_key=api_key)
    _GEMINI_CONFIGURED = True


def _build_gemini_prompt(
    segment_text: str, user_note: Optional[str], max_claims: int
) -> str:
    cleaned_segment = segment_text.strip()
    note_text = user_note.strip() if user_note else "None"
    return GEMINI_PROMPT_TEMPLATE.format(
        max_claims=max_claims,
        segment_text=_ensure_braces_escaped(cleaned_segment),
        user_note=_ensure_braces_escaped(note_text),
    )


def _extract_response_text(response: object) -> str:
    candidate = getattr(response, "text", None)
    if candidate:
        return candidate
    output_text = getattr(response, "output_text", None)
    if output_text:
        return output_text
    fragments: List[str] = []
    for element in getattr(response, "output", []) or []:
        for content in getattr(element, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                fragments.append(text)
    return "\n".join(fragments).strip()


def _extract_json_array(raw: str) -> str:
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Gemini response did not contain a JSON array.")
    return raw[start : end + 1]


def _normalize_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 1.0
    return min(1.0, max(0.0, confidence))


def _normalize_gemini_entry(entry: dict) -> dict:
    if not isinstance(entry, dict):
        raise ValueError("Gemini entry must be an object.")
    claim_text = entry.get("claim_text")
    research_query = entry.get("research_query")
    needs_backing = entry.get("needs_backing_because")
    confidence = entry.get("confidence_score")
    if not claim_text:
        raise ValueError("Gemini entry missing `claim_text`.")
    if not research_query:
        research_query = claim_text
    return {
        "claim_text": str(claim_text).strip(),
        "research_query": str(research_query).strip(),
        "needs_backing_because": str(needs_backing).strip()
        if needs_backing
        else None,
        "confidence_score": _normalize_confidence(confidence),
    }


def _parse_gemini_claims(raw_text: str, max_claims: int) -> List[Dict[str, Any]]:
    payload = _extract_json_array(raw_text)
    data = json.loads(payload)
    if not isinstance(data, list):
        raise ValueError("Gemini response was not a JSON array.")
    normalized: List[Dict[str, Any]] = []
    for entry in data[:max_claims]:
        normalized.append(_normalize_gemini_entry(entry))
    return normalized


def _call_gemini_claim_detector(
    segment_text: str, user_note: Optional[str], max_claims: int
) -> List[Dict[str, Any]]:
    _ensure_gemini_client_ready()
    prompt = _build_gemini_prompt(segment_text, user_note, max_claims)
    response = genai.get_response(
        model=GEMINI_MODEL_DEFAULT,
        prompt=prompt,
        temperature=0.2,
        max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
    )
    text = _extract_response_text(response)
    if not text:
        raise ValueError("Empty response from Gemini.")
    return _parse_gemini_claims(text, max_claims)


async def identify_claims_with_gemini(
    segment_text: str, user_note: Optional[str], max_claims: int = 5
) -> List[Dict[str, Any]]:
    """
    Returns list of dicts with keys `claim_text`, `research_query`,
    `needs_backing_because`, and `confidence_score`.
    """
    return await asyncio.to_thread(
        _call_gemini_claim_detector, segment_text, user_note, max_claims
    )


def split_sentences(text: str) -> List[str]:
    return [
        sentence.replace("\n", " ").strip()
        for sentence in SENTENCE_SPLIT_REGEX.split(text.strip())
        if sentence.strip()
    ]


def _build_note_terms(note: Optional[str]) -> set[str]:
    if not note:
        return set()
    return {token for token in re.split(r"\s+", note.lower()) if token}


def detect_claims(
    segment_text: str, user_note: Optional[str], assume_all_claims: bool = False
) -> List[ClaimCandidate]:
    note_terms = _build_note_terms(user_note)
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

        consider_claim = assume_all_claims or score >= 2
        if consider_claim:
            candidates.append(
                ClaimCandidate(
                    text=sentence,
                    note_matched=bool(note_terms & set(re.split(r"\s+", lower))),
                    research_query=sentence,
                )
            )

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


async def query_rag_for_claim(query_text: str) -> Tuple[Optional[List[dict]], Optional[str]]:
    rag_fn = getattr(rag_search, "fn", rag_search)
    try:
        raw = await rag_fn(query_text, n_results=3, response_format="json")
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
        needs_backing_because=claim.needs_backing_because,
        confidence_score=claim.confidence_score,
    )


async def enrich_claims(
    timestamp: str,
    heading: str,
    claims: Iterable[ClaimCandidate],
) -> Tuple[List[ContextCard], List[Tuple[str, str]]]:
    cards: List[ContextCard] = []
    misses: List[Tuple[str, str]] = []

    for claim in claims:
        query_input = claim.research_query or claim.text
        hits, error = await query_rag_for_claim(query_input)
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
        if card.needs_backing_because:
            print(f"Reason to back: {card.needs_backing_because}")
        if card.confidence_score is not None:
            print(f"Confidence needing support: {card.confidence_score:.2f}")
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
        "--assume-all-claims",
        action="store_true",
        help="Treat every sentence in the segment as a claim regardless of heuristics.",
    )
    parser.add_argument(
        "--redo",
        action="store_true",
        help="Re-run even when a card already exists for the same timestamp/heading.",
    )
    parser.add_argument(
        "--use-gemini",
        action="store_true",
        help="Use Gemini-powered claim identification instead of the heuristic detector.",
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

    note_terms = _build_note_terms(note)
    claims: List[ClaimCandidate] = []

    if args.use_gemini:
        logging.info("Identifying claims via Gemini model %s.", GEMINI_MODEL_DEFAULT)
        try:
            gemini_results = asyncio.run(
                identify_claims_with_gemini(
                    segment["text"], note or None, max_claims=MAX_CLAIMS_PER_SEGMENT
                )
            )
        except Exception:
            logging.exception("Gemini claim detection failed; falling back to heuristics.")
        else:
            if gemini_results:
                claims = [
                    ClaimCandidate(
                        text=entry["claim_text"],
                        note_matched=bool(
                            note_terms
                            & set(re.split(r"\s+", entry["claim_text"].lower()))
                        ),
                        research_query=entry["research_query"],
                        needs_backing_because=entry.get("needs_backing_because"),
                        confidence_score=entry.get("confidence_score"),
                    )
                    for entry in gemini_results
                ]
                logging.info("Gemini returned %d claims.", len(claims))
            else:
                logging.info("Gemini returned no claims; falling back to heuristics.")

    if not claims:
        logging.info("Using heuristic claim detection.")
        claims = detect_claims(
            segment["text"], note, assume_all_claims=args.assume_all_claims
        )
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

