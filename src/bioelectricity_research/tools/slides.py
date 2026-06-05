"""Slide deck generation and community sharing tools."""

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..mcp_app import mcp, _get_supabase_client
from ..slide_utils import _generate_slide_deck_impl
from ..schemas.slides import (
    SlideDeckResponse,
    CommunitySlideListResponse,
    SlideShareUpdateResponse,
    UserSlideListResponse,
)

logger = logging.getLogger(__name__)


class GenerateSlideDeckInput(BaseModel):
    """Input for slide deck generation."""
    claim_id: str = Field(
        ...,
        description="The claim ID (e.g., 'lex_325-seg_42-claim_1')"
    )
    episode_id: str = Field(
        ...,
        description="The episode ID (e.g., 'lex_325')"
    )
    style: str = Field(
        default="presenter",
        description="Slide style: 'presenter' (sparse, visual) or 'detailed' (comprehensive)"
    )
    force_regenerate: bool = Field(
        default=False,
        description="Force regeneration even if cached slides exist"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User ID for ownership (from auth)"
    )


class GetCommunitySlidesInput(BaseModel):
    """Input for fetching community slides."""
    claim_id: str = Field(..., description="The claim ID to get community slides for")


class UpdateSlideShareInput(BaseModel):
    """Input for updating slide sharing status."""
    slide_id: str = Field(..., description="The slide deck ID")
    is_public: bool = Field(..., description="Whether to make the slide public")
    user_id: str = Field(..., description="User ID (must own the slide)")


class GetUserSlidesInput(BaseModel):
    """Input for fetching user's slides."""
    user_id: str = Field(..., description="User ID to fetch slides for")


@mcp.tool()
async def generate_slide_deck(params: GenerateSlideDeckInput) -> SlideDeckResponse:
    """
    Generate a presentation slide deck for a scientific claim.

    Creates NotebookLM-style slides using Gemini for planning and Nano Banana Pro
    for rendering. Outputs a PDF stored in Supabase Storage.

    Styles:
    - "presenter": 5-7 sparse slides optimized for live presentation
    - "detailed": 8-12 comprehensive slides that stand alone

    Returns:
        pdf_url: Public URL to download the PDF
        thumbnail_urls: Preview images (first and last slides)
        slide_count: Number of slides generated
        slide_specs: The JSON slide plan
        cached: Whether result was from cache
        generated_at: Timestamp
    """
    return await _generate_slide_deck_impl(
        claim_id=params.claim_id,
        episode_id=params.episode_id,
        style=params.style,
        force_regenerate=params.force_regenerate,
        user_id=params.user_id,
    )


@mcp.tool()
async def get_community_slides(params: GetCommunitySlidesInput) -> CommunitySlideListResponse:
    """
    Get publicly shared slides for a claim from the community.

    Returns slides shared by other users for this claim, with creator attribution.
    """
    try:
        db = _get_supabase_client()

        result = (
            db.client.table("generated_slides")
            .select("id, style, slide_count, pdf_url, thumbnail_urls, created_at, user_id")
            .eq("claim_id", params.claim_id)
            .eq("is_public", True)
            .order("created_at", desc=True)
            .execute()
        )

        slides = result.data or []

        # Fetch creator profiles
        if slides:
            user_ids = list(set(s["user_id"] for s in slides if s.get("user_id")))
            if user_ids:
                profiles_result = (
                    db.client.table("user_profiles")
                    .select("id, display_name")
                    .in_("id", user_ids)
                    .execute()
                )
                profiles = {p["id"]: p for p in (profiles_result.data or [])}

                # Attach creator info
                for slide in slides:
                    profile = profiles.get(slide.get("user_id"), {})
                    slide["creator_name"] = profile.get("display_name", "Anonymous")
                    del slide["user_id"]  # Don't expose user_id

        return {
            "slides": slides,
            "count": len(slides),
        }

    except Exception as e:
        return {"error": str(e), "slides": [], "count": 0}


@mcp.tool()
async def update_slide_sharing(params: UpdateSlideShareInput) -> SlideShareUpdateResponse:
    """
    Update the sharing status of a slide deck.

    Users can only update slides they own.
    """
    try:
        db = _get_supabase_client()

        result = (
            db.client.table("generated_slides")
            .update({"is_public": params.is_public})
            .eq("id", params.slide_id)
            .eq("user_id", params.user_id)
            .execute()
        )

        if not result.data:
            return {"error": "Slide not found or you don't have permission", "success": False}

        return {
            "success": True,
            "is_public": params.is_public,
            "message": "Slide is now shared with the community" if params.is_public else "Slide is now private",
        }

    except Exception as e:
        return {"error": str(e), "success": False}


@mcp.tool()
async def get_user_slides(params: GetUserSlidesInput) -> UserSlideListResponse:
    """
    Get a user's own slides for a claim (both styles if they exist).

    Returns slides the user has previously generated, allowing the UI to
    restore state after page refresh and show which styles are available.
    """
    try:
        db = _get_supabase_client()

        result = (
            db.client.table("generated_slides")
            .select("id, style, slide_count, pdf_url, thumbnail_urls, slide_specs, is_public, created_at")
            .eq("claim_id", params.claim_id)
            .eq("user_id", params.user_id)
            .order("created_at", desc=True)
            .execute()
        )

        slides = result.data or []

        # Group by style for easy access
        slides_by_style: dict[str, Any] = {}
        for slide in slides:
            style = slide.get("style")
            if style and style not in slides_by_style:
                slides_by_style[style] = {
                    "id": slide["id"],
                    "style": style,
                    "slide_count": slide["slide_count"],
                    "pdf_url": slide["pdf_url"],
                    "thumbnail_urls": slide.get("thumbnail_urls", []),
                    "slide_specs": slide.get("slide_specs", []),
                    "is_public": slide.get("is_public", False),
                    "created_at": slide["created_at"],
                }

        return {
            "slides": slides_by_style,
            "styles_created": list(slides_by_style.keys()),
        }

    except Exception as e:
        return {"error": str(e), "slides": {}, "styles_created": []}
