"""Local verification utilities for the Noeron RAG pipeline."""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Set, TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - only needed for typing
    from src.bioelectricity_research.vector_store import VectorStore

logger = logging.getLogger(__name__)

RECENT_PHRASES = (
    "recent work",
    "recent research",
    "recently",
    "recent studies",
    "new work",
    "new research",
)


class VerificationAgent:
    """Offline verification helper that relies on the local corpus."""

    def __init__(self, cleaned_papers_dir: str = "data/cleaned_papers") -> None:
        self.cleaned_papers_dir = Path(cleaned_papers_dir)
        self.papers = self._load_cleaned_papers(self.cleaned_papers_dir)
        self.paper_map = {pid: data for pid, data in self.papers.items()}
        self.citation_graph = self._build_citation_graph()

    def _load_cleaned_papers(self, directory: Path) -> Dict[str, Dict[str, Any]]:
        papers: Dict[str, Dict[str, Any]] = {}
        if not directory.exists():
            logger.warning("Cleaned papers directory %s does not exist", directory)
            return papers

        for path in sorted(directory.glob("*.json")):
            try:
                payload = json.loads(path.read_text())
            except json.JSONDecodeError as exc:
                logger.warning("Skipping %s: failed to parse json (%s)", path, exc)
                continue

            paper_id = self._extract_paper_id(payload)
            if not paper_id:
                logger.warning("Skipping %s: missing paper_id", path)
                continue

            papers[paper_id] = payload
        return papers

    def _extract_paper_id(self, payload: Mapping[str, Any]) -> Optional[str]:
        for key in ("paper_id", "paperId", "id"):
            candidate = payload.get(key)
            if candidate:
                return str(candidate).lower()
        return None

    def _build_citation_graph(self) -> Dict[str, Dict[str, Set[str]]]:
        graph: Dict[str, Dict[str, Set[str]]] = defaultdict(
            lambda: {"cites": set(), "cited_by": set()}
        )

        for paper_id, payload in self.papers.items():
            graph.setdefault(paper_id, {"cites": set(), "cited_by": set()})
            for relation in ("references", "citations"):
                for target in self._extract_related_ids(payload.get(relation)):
                    graph[paper_id]["cites"].add(target)
                    graph.setdefault(target, {"cites": set(), "cited_by": set()})
                    graph[target]["cited_by"].add(paper_id)
        return graph

    def _extract_related_ids(
        self, entries: Optional[Iterable[Any]]
    ) -> Iterable[str]:
        if not entries:
            return []

        normalized: List[str] = []
        for entry in entries:
            if isinstance(entry, str):
                normalized.append(entry.lower())
                continue
            if isinstance(entry, Mapping):
                for key in ("paper_id", "paperId", "id"):
                    candidate = entry.get(key)
                    if candidate:
                        normalized.append(str(candidate).lower())
                        break
        return normalized

    def _is_recent_claim(self, text: str) -> bool:
        lowered = text.lower()
        return any(phrase in lowered for phrase in RECENT_PHRASES)

    def _extract_claim_text(self, claim_data: Mapping[str, Any]) -> str:
        claim_text = claim_data.get("claim_text") or claim_data.get("claim") or ""
        if not claim_text:
            top_matches = claim_data.get("rag_results", {})
            if isinstance(top_matches, dict):
                claim_text = top_matches.get("claim_text") or ""
        return str(claim_text or "")

    def _normalize_podcast_date(self, context: Mapping[str, Any]) -> datetime:
        raw_date = context.get("podcast_date")
        if isinstance(raw_date, datetime):
            return raw_date
        if isinstance(raw_date, str):
            try:
                return datetime.fromisoformat(raw_date)
            except ValueError:
                pass
        fallback = context.get("episode_date") or context.get("podcast_recorded_at")
        if isinstance(fallback, datetime):
            return fallback
        if isinstance(fallback, str):
            try:
                return datetime.fromisoformat(fallback)
            except ValueError:
                pass
        return datetime.utcnow()

    def _get_paper_record(self, paper_id: str) -> Optional[Dict[str, Any]]:
        normalized = str(paper_id).lower()
        return self.paper_map.get(normalized)

    def _temporal_check(
        self, paper_year: Optional[int], podcast_date: datetime, claim_text: str
    ) -> Dict[str, Any]:
        podcast_year = podcast_date.year
        result = {"podcast_year": podcast_year, "paper_year": paper_year, "valid": True}

        if paper_year is None:
            result["confidence"] = 0.5
            result["reason"] = "Missing publication year in corpus metadata."
            return result

        if paper_year > podcast_year:
            result["valid"] = False
            result["confidence"] = 0.0
            result["reason"] = "Paper appears to be published after the podcast date."
            return result

        year_gap = podcast_year - paper_year
        confidence = max(0.0, min(1.0, 1 - year_gap / 10))
        result["confidence"] = confidence

        if self._is_recent_claim(claim_text) and year_gap > 2:
            result[
                "reason"
            ] = "Claim frames the work as recent but the paper is older than two years."
        else:
            result["reason"] = "Temporal check passed."
        return result

    def _citation_network_check(
        self, paper_id: str
    ) -> Dict[str, Any]:
        citing = sorted(self.citation_graph.get(paper_id, {}).get("cited_by", []))
        count = len(citing)
        confidence = min(1.0, count / 3) if count else 0.0
        return {
            "citing_papers": citing,
            "citation_count": count,
            "confidence": confidence,
        }

    def _cross_reference_check(
        self, claim_text: str, paper_id: str, vector_store: "VectorStore"
    ) -> Dict[str, Any]:
        if not claim_text:
            return {
                "similar_papers": [],
                "citation_overlap": 0.0,
                "confidence": 0.0,
            }

        results = vector_store.search(claim_text, n_results=5)
        metadatas = results.get("metadatas") or []
        similar_ids: List[str] = []
        for bucket in metadatas:
            for metadata in bucket or []:
                pid = metadata.get("paper_id") or metadata.get("paperId")
                if not pid:
                    continue
                normalized = str(pid).lower()
                if normalized not in similar_ids and normalized != paper_id:
                    similar_ids.append(normalized)

        if not similar_ids:
            return {
                "similar_papers": [],
                "citation_overlap": 0.0,
                "confidence": 0.0,
            }

        overlap_count = sum(
            1
            for similar_id in similar_ids
            if paper_id in self.citation_graph.get(similar_id, {}).get("cites", set())
        )
        citation_overlap = overlap_count / len(similar_ids)
        confidence = min(1.0, 0.4 + citation_overlap * 0.6)
        return {
            "similar_papers": similar_ids,
            "citation_overlap": citation_overlap,
            "confidence": confidence,
        }

    def verify_match(
        self,
        claim_data: Mapping[str, Any],
        matched_paper_id: str,
        vector_store: "VectorStore",
        *,
        context: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        ctx = dict(context or {})
        claim_text = self._extract_claim_text(claim_data or {})
        details: Dict[str, Any] = {}

        paper_record = self._get_paper_record(matched_paper_id)
        if not paper_record:
            return {
                "verified": False,
                "confidence": 0.0,
                "flags": [],
                "details": {},
                "verification_details": {},
                "reasoning": "Matched paper not found in the cleaned corpus.",
            }

        podcast_date = self._normalize_podcast_date(ctx)
        paper_year = paper_record.get("year")

        temporal = self._temporal_check(paper_year, podcast_date, claim_text)
        citation = self._citation_network_check(matched_paper_id.lower())
        crossref = self._cross_reference_check(claim_text, matched_paper_id.lower(), vector_store)

        details["temporal"] = temporal
        details["citation_network"] = citation
        details["cross_reference"] = crossref

        confidence = (
            temporal["confidence"] * 0.2
            + citation["confidence"] * 0.4
            + crossref["confidence"] * 0.4
        )

        flags: List[str] = []
        if not temporal["valid"]:
            flags.append("FUTURE_PAPER")
        if temporal.get("reason") and "older than two years" in temporal["reason"].lower():
            flags.append("STALE_REFERENCE")
        if citation["citation_count"] == 0:
            flags.append("NO_CITATION_SUPPORT")
        if crossref["similar_papers"] and crossref["citation_overlap"] < 0.2:
            flags.append("ISOLATED_MATCH")
        if confidence < 0.5:
            flags.append("LOW_CONFIDENCE")

        reasoning = (
            f"Temporal confidence {temporal['confidence']:.2f}; "
            f"{citation['citation_count']} corpus papers cite this match; "
            f"cross-reference overlap {crossref['citation_overlap']:.2f}."
        )

        verified = confidence >= 0.5 and "FUTURE_PAPER" not in flags

        return {
            "verified": verified,
            "confidence": round(confidence, 4),
            "flags": flags,
            "details": details,
            "verification_details": details,
            "reasoning": reasoning,
        }

