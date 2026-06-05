"""Figure metadata loading and Gemini vision analysis helpers."""

import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .cache_store import (
    FIGURES_INDEX_PATH,
    ROOT_DIR,
    _load_evidence_threads_cache,
    _load_deep_dive_cache,
    _load_figure_analysis_cache,
    _save_figure_analysis_cache,
)
from .mcp_app import _ensure_gemini_client_ready, _get_genai_client

logger = logging.getLogger(__name__)


def _load_figures_index() -> dict:
    if not FIGURES_INDEX_PATH.exists():
        return {"figures_by_paper": {}}
    return json.loads(FIGURES_INDEX_PATH.read_text())


def _get_figures_for_paper(paper_id: str) -> list[dict]:
    index = _load_figures_index()
    return index.get("figures_by_paper", {}).get(paper_id, [])


async def _get_paper_figures_impl(paper_id: str) -> dict[str, Any]:
    """Return figure metadata for a paper without AI analysis."""
    figures = _get_figures_for_paper(paper_id)
    if not figures:
        return {"paper_id": paper_id, "figures": [], "total_figures": 0}

    result_figures = [
        {
            "figure_id": fig["figure_id"],
            "paper_id": fig["paper_id"],
            "image_path": fig.get("image_path"),
            "image_url": fig.get("image_url"),
            "caption": fig.get("caption"),
            "title": fig.get("title"),
            "label": fig.get("label"),
        }
        for fig in figures
        if fig.get("image_path") or fig.get("image_url")
    ]
    return {"paper_id": paper_id, "figures": result_figures, "total_figures": len(result_figures)}


def _get_papers_with_figures() -> set[str]:
    index = _load_figures_index()
    return {
        paper_id
        for paper_id, figs in index.get("figures_by_paper", {}).items()
        if any(f.get("image_path") or f.get("image_url") for f in figs)
    }


async def _get_claim_figures_impl(
    claim_id: str,
    episode_id: str,
    limit: int = 10,
) -> dict[str, Any]:
    """Collect figures from papers referenced in evidence threads and deep dive summaries."""
    paper_ids: set[str] = set()
    paper_titles: dict[str, str] = {}

    threads_cache = _load_evidence_threads_cache()
    cached_threads = threads_cache.get(f"{episode_id}:{claim_id}")
    if cached_threads:
        for thread in cached_threads.get("threads", []):
            for milestone in thread.get("milestones", []):
                if pid := milestone.get("paper_id"):
                    paper_ids.add(pid)
                    if milestone.get("paper_title"):
                        paper_titles[pid] = milestone["paper_title"]

    for key, data in _load_deep_dive_cache().items():
        if f":{claim_id}:" in key or key.endswith(f":{claim_id}"):
            for paper in data.get("papers", []):
                if pid := paper.get("paper_id"):
                    paper_ids.add(pid)
                    if paper.get("title") and pid not in paper_titles:
                        paper_titles[pid] = paper["title"]

    if not paper_ids:
        return {"claim_id": claim_id, "figures": [], "total_available": 0,
                "message": "No papers found in evidence threads or deep dive summaries."}

    relevant_paper_ids = paper_ids & _get_papers_with_figures()
    if not relevant_paper_ids:
        return {"claim_id": claim_id, "figures": [], "total_available": 0,
                "papers_checked": len(paper_ids),
                "message": f"None of the {len(paper_ids)} evidence papers have extractable figures."}

    all_figures = []
    for paper_id in relevant_paper_ids:
        paper_title = paper_titles.get(paper_id, "Unknown Paper")
        for fig in _get_figures_for_paper(paper_id):
            if fig.get("image_path") or fig.get("image_url"):
                all_figures.append({
                    "figure_id": fig["figure_id"],
                    "paper_id": paper_id,
                    "paper_title": paper_title,
                    "image_path": fig.get("image_path"),
                    "image_url": fig.get("image_url"),
                    "caption": fig.get("caption"),
                    "title": fig.get("title"),
                    "label": fig.get("label"),
                })

    total_available = len(all_figures)
    if limit and len(all_figures) > limit:
        all_figures = all_figures[:limit]

    return {
        "claim_id": claim_id,
        "figures": all_figures,
        "total_available": total_available,
        "papers_with_figures": len(relevant_paper_ids),
        "papers_checked": len(paper_ids),
    }


async def _analyze_paper_figures_impl(
    paper_id: str,
    figure_id: str | None = None,
    claim_context: str | None = None,
    force_regenerate: bool = False,
) -> dict[str, Any]:
    """Analyze figures with Gemini vision (Agentic Vision with code execution)."""
    from google.genai import types  # type: ignore[import]

    cache_key = f"{paper_id}:{figure_id or 'all'}"
    if not force_regenerate:
        cache = _load_figure_analysis_cache()
        if cache_key in cache:
            cached = cache[cache_key]
            cached["cached"] = True
            return cached

    figures = _get_figures_for_paper(paper_id)
    if not figures:
        return {"error": f"No figures found for paper {paper_id}", "figures": []}

    if figure_id:
        figures = [f for f in figures if f["figure_id"] == figure_id]

    figures = [f for f in figures if f.get("image_path") or f.get("image_url")][:5]
    if not figures:
        return {"error": f"No figures with images found for paper {paper_id}", "figures": []}

    _ensure_gemini_client_ready()
    client = _get_genai_client()
    results = []

    for fig in figures:
        image_data = None
        image_path = ROOT_DIR / fig["image_path"] if fig.get("image_path") else None
        if image_path and image_path.exists():
            image_data = base64.standard_b64encode(image_path.read_bytes()).decode("utf-8")
        elif fig.get("image_url"):
            try:
                resp = await asyncio.to_thread(
                    lambda: httpx.get(fig["image_url"], timeout=15, follow_redirects=True)
                )
                if resp.status_code == 200:
                    image_data = base64.standard_b64encode(resp.content).decode("utf-8")
            except Exception:
                logger.warning("Failed to fetch figure image: %s", fig["image_url"])

        if not image_data:
            continue

        context = f"Caption: {fig.get('caption', 'No caption')}\n"
        if claim_context:
            context += f"Related claim from podcast: {claim_context}\n"

        prompt = f"""Analyze this scientific figure from bioelectricity research.

{context}

Provide:
1. A clear description of what the figure shows
2. Key scientific findings or data points
3. How this relates to the claim (if provided)

Keep the analysis concise (2-3 paragraphs) and accessible to non-experts."""

        try:
            config = types.GenerateContentConfig(
                tools=[types.Tool(code_execution=types.ToolCodeExecution())],
                temperature=0.3,
            )
            contents = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(
                            data=base64.standard_b64decode(image_data),
                            mime_type="image/png",
                        ),
                        types.Part.from_text(text=prompt),
                    ],
                )
            ]

            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=contents,
                config=config,
            )

            analysis_text = ""
            code_executed = False
            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    analysis_text += part.text
                if hasattr(part, "executable_code") or hasattr(part, "code_execution_result"):
                    code_executed = True

            results.append({
                "figure_id": fig["figure_id"],
                "paper_id": fig["paper_id"],
                "image_path": fig.get("image_path"),
                "image_url": fig.get("image_url"),
                "caption": fig.get("caption"),
                "title": fig.get("title"),
                "analysis": analysis_text,
                "code_executed": code_executed,
            })

        except Exception:
            logger.warning("Failed to analyze figure %s", fig["figure_id"])

    result: dict[str, Any] = {
        "paper_id": paper_id,
        "figures": results,
        "total_figures": len(results),
        "cached": False,
    }

    if results:
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        cache = _load_figure_analysis_cache()
        cache[cache_key] = result
        _save_figure_analysis_cache(cache)

    return result
