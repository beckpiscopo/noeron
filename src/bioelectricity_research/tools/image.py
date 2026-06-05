"""Image generation tool."""

import logging
from typing import Any

from ..media_utils import GenerateImageInput, _generate_image_impl
from ..mcp_app import mcp
from ..schemas.media import ImageResponse

logger = logging.getLogger(__name__)


@mcp.tool()
async def generate_image_with_context(params: GenerateImageInput) -> ImageResponse:
    """
    Generate an educational image based on podcast context using Gemini's image generation.

    Uses Gemini 3 Pro Image model to create scientific visualizations (diagrams,
    illustrations) based on the current podcast context. Images are stored in
    Supabase Storage and returned as URLs.

    Supports:
    - Conceptual diagrams explaining mechanisms and pathways
    - Educational illustrations of biological concepts
    - Scientific visualizations based on podcast content

    Returns:
        image_url: URL to the generated image in Supabase Storage
        caption: AI-generated description of the image
        style_used: The visualization style applied
        model: Model used for generation
    """
    return await _generate_image_impl(
        prompt=params.prompt,
        episode_id=params.episode_id,
        claim_id=params.claim_id,
        current_timestamp=params.current_timestamp,
        image_style=params.image_style,
    )
