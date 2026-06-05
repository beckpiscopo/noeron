"""Helpers for evidence thread generation (eligibility, formatting, validation, Gemini call)."""

import json
import logging

from .mcp_app import _ensure_gemini_client_ready, _get_genai_client

logger = logging.getLogger(__name__)


def _should_generate_threads(papers: list[dict]) -> tuple[bool, str]:
    """Return (should_generate, reason) based on paper count and year spread."""
    if len(papers) < 4:
        return False, f"insufficient_papers: need 4+, have {len(papers)}"

    years = []
    for paper in papers:
        year = paper.get("year")
        if year and isinstance(year, (int, str)):
            try:
                years.append(int(year))
            except (ValueError, TypeError):
                pass

    if len(years) < 3:
        return False, f"insufficient_year_data: only {len(years)} papers have years"

    year_span = max(years) - min(years)
    if year_span < 3:
        return False, f"insufficient_year_span: only {year_span} years (need 3+)"

    return True, "eligible"


def _format_papers_for_thread_prompt(papers: list[dict], papers_collection: dict) -> str:
    """Format papers as a JSON string for the thread generation prompt."""
    formatted_papers = []
    for paper in papers:
        paper_id = paper.get("paper_id", "")
        paper_title = paper.get("paper_title", "Unknown")
        year = paper.get("year", "")
        section = paper.get("section", paper.get("section_heading", ""))
        text_excerpt = paper.get("text", "")[:400]

        paper_data = papers_collection.get(paper_id, {})
        metadata = paper_data.get("metadata", {})
        citations = metadata.get("citationCount", 0)
        venue = metadata.get("venue", "")

        authors = metadata.get("authors", [])
        if authors:
            first = authors[0].get("name", "Unknown") if isinstance(authors[0], dict) else str(authors[0])
            author_str = f"{first} et al." if len(authors) > 1 else first
        else:
            author_str = "Unknown"

        formatted_papers.append({
            "paper_id": paper_id,
            "title": paper_title,
            "year": year or metadata.get("year", "unknown"),
            "authors": author_str,
            "venue": venue,
            "citations": citations,
            "section": section,
            "excerpt": text_excerpt,
        })

    return json.dumps(formatted_papers, indent=2)


def _validate_threads(threads: list[dict], papers: list[dict]) -> list[dict]:
    """Remove threads that reference non-existent papers or have fewer than 2 valid milestones."""
    valid_paper_ids = set()
    valid_paper_titles = set()
    for paper in papers:
        if pid := paper.get("paper_id", ""):
            valid_paper_ids.add(pid)
        if ptitle := paper.get("paper_title", ""):
            valid_paper_titles.add(ptitle.lower().strip())

    valid_types = {"experimental_validation", "theoretical_framework", "mechanism_discovery", "cross_domain"}
    valid_strengths = {"foundational", "developing", "speculative"}
    validated = []

    for thread in threads:
        if thread.get("type") not in valid_types:
            logger.debug("Skipping thread with invalid type: %s", thread.get("type"))
            continue
        if thread.get("strength") not in valid_strengths:
            logger.debug("Skipping thread with invalid strength: %s", thread.get("strength"))
            continue

        valid_milestones = []
        seen_paper_ids: set[str] = set()
        for milestone in thread.get("milestones", []):
            paper_id = milestone.get("paper_id", "")
            paper_title = milestone.get("paper_title", "").lower().strip()
            year = milestone.get("year")

            if year and (year < 1990 or year > 2025):
                logger.debug("Skipping milestone with implausible year: %s", year)
                continue
            if paper_id not in valid_paper_ids and paper_title not in valid_paper_titles:
                logger.debug("Skipping milestone — paper not found: %s", milestone.get("paper_title"))
                continue
            if paper_id and paper_id in seen_paper_ids:
                logger.debug("Skipping duplicate paper in thread: %s", paper_id)
                continue
            if paper_id:
                seen_paper_ids.add(paper_id)
            valid_milestones.append(milestone)

        if len(valid_milestones) >= 2:
            thread["milestones"] = valid_milestones
            validated.append(thread)
        else:
            logger.debug("Skipping thread '%s' — only %d valid milestones", thread.get("name"), len(valid_milestones))

    return validated


def _call_gemini_for_threads(prompt: str, model_name: str) -> dict:
    """Call Gemini and parse the JSON response for evidence threads."""
    _ensure_gemini_client_ready()
    response = _get_genai_client().models.generate_content(
        model=model_name,
        contents=prompt,
    )

    text = None
    if hasattr(response, "text"):
        text = response.text
    elif hasattr(response, "candidates") and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
            text = "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))

    if not text:
        raise ValueError("Could not extract text from Gemini response")

    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse threads JSON: %s — raw: %s", e, text[:500])
        return {"threads": [], "error": "Failed to parse Gemini response as JSON"}
