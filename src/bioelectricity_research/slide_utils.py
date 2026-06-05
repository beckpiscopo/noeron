"""Slide deck planning, rendering, PDF assembly, and generation implementation."""

import asyncio
import json
import logging
from typing import Any

from .cache_store import _load_claims_cache, _load_deep_dive_cache
from .config import GEMINI_MODEL
from .mcp_app import (
    NANO_BANANA_MODEL,
    SLIDE_WIDTH,
    SLIDES_BUCKET,
    _get_genai_client,
    _get_supabase_client,
)

logger = logging.getLogger(__name__)


async def _plan_slides(
    claim_text: str,
    synthesis_rationale: str,
    deep_dive_summary: str,
    papers: list[dict],
    style: str,
) -> list[dict]:
    """
    Use Gemini structured output to plan slide content.

    Returns a list of slide specs with type, content, and visual prompts.
    """
    style_guidance = {
        "presenter": """
Create 5-7 slides optimized for LIVE PRESENTATION:
- Title slide with claim as headline
- Each content slide: ONE key point, 2-3 bullet max, strong visual prompt
- Evidence slides: paper name + single key finding
- Summary slide: 3 takeaways max
Keep text MINIMAL - visuals carry the message.
""",
        "detailed": """
Create 8-12 slides as a STANDALONE EXPLAINER:
- Title slide with claim and context
- Content slides: full explanations, 4-6 bullets okay
- Evidence slides: paper details, methodology hints, findings
- Summary slide: comprehensive takeaways
Include enough text that someone can understand without narration.
"""
    }

    papers_context = "\n".join([
        f"- {p.get('title', 'Unknown')} ({p.get('year', 'n.d.')}): {p.get('key_finding', p.get('section', ''))}"
        for p in papers[:5]
    ])

    prompt = f"""You are creating a slide deck about a scientific claim.

CLAIM: {claim_text}

RATIONALE: {synthesis_rationale}

DEEP DIVE SUMMARY:
{deep_dive_summary[:2000]}

SUPPORTING PAPERS:
{papers_context}

STYLE: {style}
{style_guidance.get(style, style_guidance['presenter'])}

Generate a JSON array of slides. Each slide must have:
- "type": one of "title", "content", "evidence", "summary"
- For title slides: "title" (main title text) and "subtitle" (supporting context)
- For other slides: "headline" (slide header) and "bullets" (array of strings)
- "visual_prompt": description of the visual/diagram to generate (be specific about scientific imagery)
- "paper_citation" (for evidence slides): paper title and year

IMPORTANT: The first slide MUST be type "title" with a compelling "title" (not "Untitled") derived from the claim.

IMPORTANT: visual_prompt should describe scientific diagrams, cellular imagery, or conceptual illustrations relevant to bioelectricity research. Be specific.

Return ONLY valid JSON array, no markdown or explanation."""

    # Get client before threading to ensure context variable is available
    client = _get_genai_client()

    response = await asyncio.to_thread(
        lambda: client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 8192,  # Increased for detailed slides
                "response_mime_type": "application/json",
            }
        )
    )

    # Extract JSON from response
    response_text = ""
    if hasattr(response, "text"):
        response_text = response.text
    elif hasattr(response, "candidates") and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
            response_text = "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))

    def try_repair_json(text: str) -> list:
        """Attempt to repair truncated or malformed JSON."""
        import re

        # First, try parsing as-is
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find and extract just the array portion
        # Look for the last complete object in the array
        try:
            # Find where the array starts
            start = text.find('[')
            if start == -1:
                raise ValueError("No JSON array found")

            # Try to close any unclosed strings and objects
            repaired = text[start:]

            # Count brackets to find where we need to close
            open_braces = repaired.count('{') - repaired.count('}')
            open_brackets = repaired.count('[') - repaired.count(']')

            # If we have unclosed structures, try to close them
            if open_braces > 0 or open_brackets > 0:
                # Try to find the last complete object
                last_complete = repaired.rfind('},')
                if last_complete > 0:
                    repaired = repaired[:last_complete + 1] + ']'
                else:
                    # Just close everything
                    repaired = repaired.rstrip(',\n\t ')
                    if not repaired.endswith('"'):
                        # Find last quote and close from there
                        last_quote = repaired.rfind('"')
                        if last_quote > 0:
                            repaired = repaired[:last_quote + 1]
                    repaired += '}' * open_braces + ']' * max(1, open_brackets)

            result = json.loads(repaired)
            logger.info("Successfully repaired truncated JSON, got %d slides", len(result))
            return result
        except Exception as repair_error:
            logger.warning("JSON repair failed: %s", repair_error)
            raise

    try:
        slides = try_repair_json(response_text)
        if not isinstance(slides, list) or len(slides) == 0:
            raise ValueError("Empty or invalid slide list")
        return slides
    except Exception as e:
        logger.error("Failed to parse slide JSON: %s", e)
        logger.debug("Raw response (first 1000 chars): %s", response_text[:1000])
        logger.debug("Raw response (last 500 chars): %s", response_text[-500:])
        raise ValueError(f"Failed to parse slide plan: {e}")


async def _render_slide(
    slide_spec: dict,
    slide_index: int,
    total_slides: int,
) -> bytes:
    """
    Render a single slide as PNG using Gemini image generation.

    Returns PNG image bytes.
    """
    import base64

    slide_type = slide_spec.get("type", "content")
    visual_prompt = slide_spec.get("visual_prompt", "scientific diagram")

    # Build text content for the slide
    if slide_type == "title":
        # Check both "title" and "headline" since Gemini may use either
        title = slide_spec.get("title") or slide_spec.get("headline") or "Multi-Scale Competency in Biology"
        subtitle = slide_spec.get("subtitle", "")
        text_content = f"TITLE: {title}\nSUBTITLE: {subtitle}"
    elif slide_type == "summary":
        headline = slide_spec.get("headline", "Key Takeaways")
        takeaways = slide_spec.get("key_takeaways", slide_spec.get("bullets", []))
        bullets_text = "\n".join(f"• {t}" for t in takeaways)
        text_content = f"HEADLINE: {headline}\n{bullets_text}"
    else:
        headline = slide_spec.get("headline", slide_spec.get("title", ""))
        bullets = slide_spec.get("bullets", [])
        bullets_text = "\n".join(f"• {b}" for b in bullets)
        citation = slide_spec.get("paper_citation", "")
        text_content = f"HEADLINE: {headline}\n{bullets_text}"
        if citation:
            text_content += f"\nSOURCE: {citation}"

    # Determine layout based on slide type
    if slide_type == "title":
        layout_instructions = """LAYOUT FOR TITLE SLIDE:
- Center the title text in the upper third
- Subtitle below title in smaller, lighter text
- Visual/illustration fills the lower two-thirds
- Small "Noeron" wordmark in bottom-right corner
- NO slide numbers on title slide"""
    elif slide_type == "summary":
        layout_instructions = """LAYOUT FOR SUMMARY SLIDE:
- "Takeaways" or headline centered at top
- Bullet points on left side (40% width)
- Visual/diagram on right side (50% width)
- Small "Noeron" wordmark in top-left corner
- NO slide numbers or metadata text"""
    else:
        layout_instructions = """LAYOUT FOR CONTENT SLIDE:
- Headline in white at top-left
- Bullet points on left side (45% width)
- Visual/diagram on right side (45% width)
- If there's a SOURCE/citation, place it in small gray text at bottom-left
- Small "Noeron" wordmark in top-left corner
- NO slide numbers or metadata text"""

    render_prompt = f"""Create a presentation slide image.

CRITICAL: Only render the actual slide content below. Do NOT add any text like "Slide X of Y", "TYPE:", or other metadata labels. The slide should look ready for a professional presentation.

DESIGN SYSTEM (Noeron brand):
- Background: dark charcoal (#0a0a0a)
- Accent color: golden-chestnut (#b5651d) for highlights and corner bracket decorations
- Headlines: white (#ffffff), bold
- Body text: light gray (#a0a0a0)
- Corner bracket decorations in accent color framing the content area
- Clean, scientific, modern aesthetic
- Dimensions: {SLIDE_WIDTH}x1080 pixels (16:9 aspect ratio)

{layout_instructions}

CONTENT TO RENDER:
{text_content}

VISUAL ELEMENT (render as diagram/illustration on slide):
{visual_prompt}

Create a polished, professional slide. The text must be clearly readable. The visual should complement the text without overwhelming it. Maintain consistent Noeron branding."""

    try:
        from google.genai import types

        # Get client before threading to ensure context variable is available
        client = _get_genai_client()

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=NANO_BANANA_MODEL,
                contents=render_prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                    image_config=types.ImageConfig(
                        aspect_ratio="16:9",
                        image_size="1K",  # 1024x576 - smaller file size while maintaining quality
                    )
                )
            )
        )

        # Extract image data from response
        if hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                for part in candidate.content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        image_data = part.inline_data.data
                        if isinstance(image_data, str):
                            return base64.b64decode(image_data)
                        return image_data

        raise ValueError("No image data in response")

    except Exception as e:
        logger.error("Failed to render slide %d: %s", slide_index + 1, e)
        raise


def _assemble_pdf(
    slide_images: list[bytes],
    claim_id: str,
    style: str,
) -> bytes:
    """
    Combine slide PNG images into a single PDF.

    Returns PDF bytes.
    """
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    from PIL import Image
    import io

    # PDF page size: 16:9 aspect ratio
    page_width = 16 * inch
    page_height = 9 * inch

    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=(page_width, page_height))

    for i, img_bytes in enumerate(slide_images):
        # Load image
        img = Image.open(io.BytesIO(img_bytes))

        # Save to temp buffer for reportlab
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)

        # Draw image to fill page
        img_reader = ImageReader(img_buffer)
        c.drawImage(img_reader, 0, 0, width=page_width, height=page_height)

        # Add page (except for last slide)
        if i < len(slide_images) - 1:
            c.showPage()

    c.save()
    return pdf_buffer.getvalue()


async def _generate_slide_deck_impl(
    claim_id: str,
    episode_id: str,
    style: str = "presenter",
    force_regenerate: bool = False,
    user_id: str = None,
) -> dict[str, Any]:
    """
    Core implementation for slide deck generation.
    """
    import time
    import uuid
    from datetime import datetime

    start_time = time.time()

    try:
        db = _get_supabase_client()

        # Step 1: Check cache (if not forcing regenerate)
        if not force_regenerate and user_id:
            existing = (
                db.client.table("generated_slides")
                .select("*")
                .eq("user_id", user_id)
                .eq("claim_id", claim_id)
                .eq("style", style)
                .maybe_single()
                .execute()
            )
            if existing.data:
                logger.info("Returning cached slides for %s", claim_id)
                return {
                    "pdf_url": existing.data["pdf_url"],
                    "thumbnail_urls": existing.data.get("thumbnail_urls", []),
                    "slide_count": existing.data["slide_count"],
                    "slide_specs": existing.data["slide_specs"],
                    "cached": True,
                    "generated_at": existing.data["created_at"],
                }

        # Step 2: Get claim data directly from cache
        logger.info("Fetching claim context for %s", claim_id)
        claims_cache = _load_claims_cache()

        # Parse claim_id to get segment_key and claim_index
        parts = claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {"error": f"Invalid claim_id format: {claim_id}", "error_code": "INVALID_CLAIM_ID"}

        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {"error": f"Invalid claim index in claim_id: {claim_id}", "error_code": "INVALID_CLAIM_ID"}

        segments = claims_cache.get("segments", {})
        segment_data = segments.get(segment_key)

        if not segment_data:
            return {"error": f"Segment not found: {segment_key}", "error_code": "SEGMENT_NOT_FOUND"}

        claims_list = segment_data.get("claims", [])
        if claim_index >= len(claims_list):
            return {"error": f"Claim index {claim_index} out of range", "error_code": "CLAIM_NOT_FOUND"}

        claim_data = claims_list[claim_index]
        claim_text = claim_data.get("claim_text", "")
        rationale = claim_data.get("needs_backing", "")

        # Step 3: Get deep dive summary from cache
        logger.info("Fetching deep dive summary")
        deep_dive_cache = _load_deep_dive_cache()

        # Try both cache key formats
        cache_key_technical = f"{episode_id}:{claim_id}:technical"
        cache_key_simplified = f"{episode_id}:{claim_id}:simplified"
        cache_key_no_style = f"{episode_id}:{claim_id}"

        cached_summary = (
            deep_dive_cache.get(cache_key_technical) or
            deep_dive_cache.get(cache_key_simplified) or
            deep_dive_cache.get(cache_key_no_style)
        )

        if cached_summary:
            summary_text = cached_summary.get("summary", "")
            papers = cached_summary.get("papers", [])
        else:
            # No cached summary - we need one to generate slides
            summary_text = ""
            papers = []

        if not summary_text:
            return {
                "error": "Not enough content to generate slides. Try a claim with more evidence.",
                "error_code": "INSUFFICIENT_CONTENT",
            }

        # Step 4: Plan slides
        logger.info("Planning slides with style: %s", style)
        slide_specs = await _plan_slides(
            claim_text=claim_text,
            synthesis_rationale=rationale,
            deep_dive_summary=summary_text,
            papers=papers,
            style=style,
        )

        logger.info("Planned %d slides", len(slide_specs))

        # Step 5: Render each slide
        logger.info("Rendering slides...")
        slide_images = []
        for i, spec in enumerate(slide_specs):
            logger.info("Rendering slide %d/%d", i + 1, len(slide_specs))
            img_bytes = await _render_slide(spec, i, len(slide_specs))
            slide_images.append(img_bytes)

        # Step 6: Assemble PDF
        logger.info("Assembling PDF...")
        pdf_bytes = await asyncio.to_thread(
            _assemble_pdf, slide_images, claim_id, style
        )

        # Step 7: Upload to Supabase Storage
        logger.info("Uploading to Supabase Storage...")

        # Sanitize claim_id for storage path (replace invalid chars)
        safe_claim_id = claim_id.replace("|", "_").replace(":", "-")

        file_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_path = f"{safe_claim_id}/{style}_{timestamp}_{file_id}.pdf"

        storage = db.client.storage.from_(SLIDES_BUCKET)

        storage.upload(
            pdf_path,
            pdf_bytes,
            {"content-type": "application/pdf"}
        )

        # Get public URL
        pdf_url = storage.get_public_url(pdf_path)

        # Upload thumbnails (first and last slide)
        thumbnail_urls = []
        for idx in [0, len(slide_images) - 1]:
            thumb_path = f"{safe_claim_id}/thumb_{style}_{idx}_{file_id}.png"
            storage.upload(
                thumb_path,
                slide_images[idx],
                {"content-type": "image/png"}
            )
            thumbnail_urls.append(storage.get_public_url(thumb_path))

        generation_time_ms = int((time.time() - start_time) * 1000)

        # Step 8: Save to database
        if user_id:
            db.client.table("generated_slides").upsert(
                {
                    "user_id": user_id,
                    "claim_id": claim_id,
                    "episode_id": episode_id,
                    "style": style,
                    "slide_count": len(slide_specs),
                    "slide_specs": slide_specs,
                    "pdf_url": pdf_url,
                    "thumbnail_urls": thumbnail_urls,
                    "generation_time_ms": generation_time_ms,
                },
                on_conflict="user_id,claim_id,style"
            ).execute()

        logger.info("Complete! Generated %d slides in %dms", len(slide_specs), generation_time_ms)

        return {
            "pdf_url": pdf_url,
            "thumbnail_urls": thumbnail_urls,
            "slide_count": len(slide_specs),
            "slide_specs": slide_specs,
            "cached": False,
            "generated_at": datetime.now().isoformat(),
            "generation_time_ms": generation_time_ms,
        }

    except Exception as e:
        import traceback
        logger.exception("Slide generation error for %s", claim_id)
        return {
            "error": f"Failed to generate slides: {str(e)}",
            "traceback": traceback.format_exc(),
            "error_code": "GENERATION_FAILED",
        }
