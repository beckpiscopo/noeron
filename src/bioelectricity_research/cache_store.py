"""Centralised file-path constants and cache load/save helpers."""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Root of the repository (three levels up from this file inside src/bioelectricity_research/)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent

EPISODES_FILE_PATH = ROOT_DIR / "data" / "episodes.json"
CLAIMS_CACHE_PATH = ROOT_DIR / "cache" / "podcast_lex_325_claims_with_timing.json"
DEEP_DIVE_CACHE_PATH = ROOT_DIR / "cache" / "deep_dive_summaries.json"
EVIDENCE_THREADS_CACHE_PATH = ROOT_DIR / "cache" / "evidence_threads.json"
KNOWLEDGE_GRAPH_PATH = ROOT_DIR / "data" / "knowledge_graph" / "knowledge_graph.json"
CLAIM_RELEVANCE_CACHE_PATH = ROOT_DIR / "data" / "knowledge_graph" / "claim_entity_relevance.json"
FIGURES_INDEX_PATH = ROOT_DIR / "data" / "figures_metadata.json"
FIGURE_ANALYSIS_CACHE_PATH = ROOT_DIR / "cache" / "figure_analysis.json"
CONTEXT_CARD_REGISTRY_PATH = ROOT_DIR / "data" / "context_card_registry.json"
PAPERS_COLLECTION_PATH = ROOT_DIR / "data" / "papers_collection.json"
CONCEPT_EXPANSION_CACHE_PATH = ROOT_DIR / "cache" / "concept_expansions.json"
PODCAST_CACHE_PATH = ROOT_DIR / "cache" / "generated_podcasts.json"


def _load_deep_dive_cache() -> dict:
    if not DEEP_DIVE_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(DEEP_DIVE_CACHE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _save_deep_dive_cache(cache: dict) -> None:
    DEEP_DIVE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEEP_DIVE_CACHE_PATH.write_text(json.dumps(cache, indent=2))


def _load_figure_analysis_cache() -> dict:
    if not FIGURE_ANALYSIS_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(FIGURE_ANALYSIS_CACHE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _save_figure_analysis_cache(cache: dict) -> None:
    FIGURE_ANALYSIS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIGURE_ANALYSIS_CACHE_PATH.write_text(json.dumps(cache, indent=2))


def _load_evidence_threads_cache() -> dict:
    if not EVIDENCE_THREADS_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(EVIDENCE_THREADS_CACHE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _save_evidence_threads_cache(cache: dict) -> None:
    EVIDENCE_THREADS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_THREADS_CACHE_PATH.write_text(json.dumps(cache, indent=2))


def _load_claims_cache() -> dict[str, Any]:
    if not CLAIMS_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CLAIMS_CACHE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _load_context_card_registry() -> dict[str, Any]:
    if not CONTEXT_CARD_REGISTRY_PATH.exists():
        return {}
    try:
        return json.loads(CONTEXT_CARD_REGISTRY_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _load_papers_collection() -> dict[str, Any]:
    if not PAPERS_COLLECTION_PATH.exists():
        return {}
    try:
        data = json.loads(PAPERS_COLLECTION_PATH.read_text())
        return data.get("papers", {})
    except json.JSONDecodeError:
        return {}


def _load_knowledge_graph() -> dict[str, Any]:
    if not KNOWLEDGE_GRAPH_PATH.exists():
        return {"nodes": [], "edges": [], "metadata": {}}
    try:
        return json.loads(KNOWLEDGE_GRAPH_PATH.read_text())
    except json.JSONDecodeError:
        return {"nodes": [], "edges": [], "metadata": {}}


def _load_claim_relevance_cache() -> dict[str, Any]:
    if not CLAIM_RELEVANCE_CACHE_PATH.exists():
        return {"claims": {}}
    try:
        return json.loads(CLAIM_RELEVANCE_CACHE_PATH.read_text())
    except json.JSONDecodeError:
        return {"claims": {}}


def _load_expansion_cache() -> dict:
    if CONCEPT_EXPANSION_CACHE_PATH.exists():
        try:
            return json.loads(CONCEPT_EXPANSION_CACHE_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_expansion_cache(cache: dict) -> None:
    try:
        CONCEPT_EXPANSION_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONCEPT_EXPANSION_CACHE_PATH.write_text(json.dumps(cache, indent=2))
    except OSError:
        logger.exception("Failed to save expansion cache")


def _load_podcast_cache() -> dict:
    if not PODCAST_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(PODCAST_CACHE_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _save_podcast_cache(cache: dict) -> None:
    PODCAST_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PODCAST_CACHE_PATH.write_text(json.dumps(cache, indent=2))
