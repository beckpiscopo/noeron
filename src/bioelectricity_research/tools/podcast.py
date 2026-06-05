"""Mini podcast generation tool."""

import logging
from typing import Any

from ..media_utils import GenerateMiniPodcastInput, _generate_mini_podcast_impl
from ..mcp_app import mcp
from ..schemas.media import PodcastResponse

logger = logging.getLogger(__name__)


@mcp.tool()
async def generate_mini_podcast(params: GenerateMiniPodcastInput) -> PodcastResponse:
    """
    Generate a 3-5 minute conversational podcast discussing a scientific claim.

    Creates a NotebookLM-style two-host dialogue that explores:
    - The claim's core assertion and context from the original podcast
    - Supporting evidence from research papers (via RAG retrieval)
    - Implications and connections to broader bioelectricity research

    Uses Gemini 3 for script generation and Gemini 2.5 TTS for multi-speaker
    audio synthesis. Generated audio is stored in Supabase Storage.

    Returns:
        podcast_url: URL to the audio file in Supabase Storage
        script: The generated conversation script
        duration_seconds: Approximate duration of the audio
        cached: Whether result was from cache
        generated_at: Timestamp of generation
    """
    return await _generate_mini_podcast_impl(
        claim_id=params.claim_id,
        episode_id=params.episode_id,
        force_regenerate=params.force_regenerate,
        style=params.style,
    )
