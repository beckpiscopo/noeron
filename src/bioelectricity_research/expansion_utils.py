"""Gemini call and validation helpers for grounded concept expansion."""

import json
import logging

from .mcp_app import _ensure_gemini_client_ready, _get_genai_client

logger = logging.getLogger(__name__)


def _call_gemini_for_expansion(prompt: str, model_name: str) -> dict:
    """Call Gemini for grounded concept expansion and parse the JSON response."""
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
            text = "".join(p.text for p in candidate.content.parts if hasattr(p, "text"))

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
        logger.error("Failed to parse expansion JSON: %s — raw: %s", e, text[:500])
        return {
            "related_concepts": [],
            "supporting_evidence": [],
            "counter_arguments": [],
            "cross_domain": [],
            "error": "Failed to parse Gemini response as JSON",
        }


def _validate_expansion_result(result: dict, valid_paper_ids: set) -> dict:
    """Remove any expansion items that reference paper IDs not in valid_paper_ids."""
    validated: dict = {
        "related_concepts": [],
        "supporting_evidence": [],
        "counter_arguments": [],
        "cross_domain": [],
        "analysis_notes": result.get("analysis_notes", ""),
    }

    for key in ("related_concepts", "supporting_evidence", "counter_arguments", "cross_domain"):
        for item in result.get(key, []):
            paper_id = item.get("paper_id", "")
            if paper_id and paper_id in valid_paper_ids:
                validated[key].append(item)
            else:
                logger.debug("Skipping expansion item with invalid paper_id: %s", paper_id)

    return validated
