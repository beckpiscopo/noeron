"""Gemini call helper for deep dive summary generation."""

import logging

from .mcp_app import _ensure_gemini_client_ready, _get_genai_client

logger = logging.getLogger(__name__)


def _call_gemini_for_deep_dive(prompt: str, model_name: str) -> str:
    """Call Gemini to generate a deep dive summary."""
    _ensure_gemini_client_ready()
    response = _get_genai_client().models.generate_content(
        model=model_name,
        contents=prompt,
    )
    if hasattr(response, "text"):
        return response.text
    if hasattr(response, "candidates") and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
            return "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))
    raise ValueError("Could not extract text from Gemini response")
