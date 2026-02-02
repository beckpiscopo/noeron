# Slide Deck Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add NotebookLM-style slide generation to the Create tab with community sharing via a new Community tab.

**Architecture:** Gemini structured output plans slides, Nano Banana Pro renders each slide as an image, images combined into PDF stored in Supabase Storage. Users can opt-in to share slides, which appear in a new Community tab for others exploring the same claim.

**Tech Stack:** Python (server.py MCP tool), Gemini API (structured output + Nano Banana Pro), Supabase (Postgres + Storage), Next.js/React frontend, reportlab (PDF assembly)

---

## Phase 1: Database Setup

### Task 1: Create user_profiles table migration

**Files:**
- Create: `supabase/migrations/018_add_user_profiles.sql`

**Step 1: Write migration SQL**

```sql
-- ============================================================================
-- USER PROFILES TABLE
-- ============================================================================
-- Stores display names and avatars for community attribution.
-- Links to auth.users for authenticated users.

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view any profile (for attribution display)
CREATE POLICY "Anyone can view profiles" ON user_profiles
  FOR SELECT USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can create own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Index for lookup
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);
```

**Step 2: Apply migration locally**

Run: `cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2 && supabase db push`

Or if using remote Supabase, run the SQL in the Supabase SQL Editor.

**Step 3: Commit**

```bash
git add supabase/migrations/018_add_user_profiles.sql
git commit -m "db: add user_profiles table for community attribution"
```

---

### Task 2: Create generated_slides table migration

**Files:**
- Create: `supabase/migrations/019_add_generated_slides.sql`

**Step 1: Write migration SQL**

```sql
-- ============================================================================
-- GENERATED SLIDES TABLE
-- ============================================================================
-- Stores AI-generated slide deck metadata and Supabase Storage references.
-- Supports community sharing with opt-in public visibility.

CREATE TABLE IF NOT EXISTS generated_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id text NOT NULL,
  episode_id text NOT NULL,

  -- Content
  style text NOT NULL CHECK (style IN ('presenter', 'detailed')),
  slide_count int NOT NULL,
  slide_specs jsonb NOT NULL,

  -- Storage
  pdf_url text NOT NULL,
  thumbnail_urls text[],

  -- Sharing
  is_public boolean DEFAULT false,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  generation_time_ms int,

  -- Prevent duplicate style per user per claim
  CONSTRAINT unique_user_claim_style UNIQUE (user_id, claim_id, style)
);

-- Index for finding community slides by claim
CREATE INDEX idx_slides_public_claim ON generated_slides(claim_id)
  WHERE is_public = true;

-- Index for user's own slides
CREATE INDEX idx_slides_user ON generated_slides(user_id);

-- Enable RLS
ALTER TABLE generated_slides ENABLE ROW LEVEL SECURITY;

-- Users can view their own slides
CREATE POLICY "Users can view own slides" ON generated_slides
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can view public slides
CREATE POLICY "Anyone can view public slides" ON generated_slides
  FOR SELECT USING (is_public = true);

-- Users can insert their own slides
CREATE POLICY "Users can create slides" ON generated_slides
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own slides (for sharing toggle)
CREATE POLICY "Users can update own slides" ON generated_slides
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own slides
CREATE POLICY "Users can delete own slides" ON generated_slides
  FOR DELETE USING (auth.uid() = user_id);
```

**Step 2: Apply migration**

Run: `cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2 && supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/019_add_generated_slides.sql
git commit -m "db: add generated_slides table for slide deck storage"
```

---

### Task 3: Create Supabase Storage bucket migration

**Files:**
- Create: `supabase/migrations/020_add_slides_storage.sql`

**Step 1: Write migration SQL**

```sql
-- ============================================================================
-- GENERATED SLIDES STORAGE BUCKET
-- ============================================================================
-- Storage for AI-generated slide deck PDFs and thumbnails.
-- Uses public URLs for easy PDF viewing/downloading.
--
-- NOTE: The bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket named "generated-slides"
-- 3. Enable "Public bucket" (for PDF access)
-- 4. Set file size limit to 20MB
-- 5. Allow MIME types: application/pdf, image/png, image/jpeg
--
-- This migration sets up the RLS policies for the bucket.

-- Allow public read for generated slides (for PDF viewing)
CREATE POLICY "Public read for generated slides"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-slides');

-- Service role can insert slides (backend uploads)
CREATE POLICY "Service role insert for generated slides"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-slides');

-- Service role can update slides
CREATE POLICY "Service role update for generated slides"
ON storage.objects FOR UPDATE
USING (bucket_id = 'generated-slides');

-- Service role can delete slides (cleanup)
CREATE POLICY "Service role delete for generated slides"
ON storage.objects FOR DELETE
USING (bucket_id = 'generated-slides');
```

**Step 2: Create bucket in Supabase Dashboard**

1. Go to Storage in Supabase Dashboard
2. Create bucket named `generated-slides`
3. Enable "Public bucket"
4. Set file size limit to 20MB
5. Allow MIME types: `application/pdf`, `image/png`, `image/jpeg`

**Step 3: Apply migration**

Run: `cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2 && supabase db push`

**Step 4: Commit**

```bash
git add supabase/migrations/020_add_slides_storage.sql
git commit -m "db: add generated-slides storage bucket policies"
```

---

## Phase 2: Backend MCP Tool

### Task 4: Add slide generation constants and input model

**Files:**
- Modify: `src/bioelectricity_research/server.py`

**Step 1: Add constants near top of file (after other constants ~line 50)**

Find the section with `GEMINI_MODEL_DEFAULT` and add:

```python
# Slide Generation
SLIDES_BUCKET = "generated-slides"
NANO_BANANA_MODEL = "gemini-3-pro-image-preview"  # Nano Banana Pro
SLIDE_WIDTH = 1920
SLIDE_HEIGHT = 1080
```

**Step 2: Add Pydantic input model (near other input models ~line 200)**

```python
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
    user_id: str = Field(
        default=None,
        description="User ID for ownership (from auth)"
    )
```

**Step 3: Commit**

```bash
git add src/bioelectricity_research/server.py
git commit -m "feat(slides): add constants and input model for slide generation"
```

---

### Task 5: Implement slide planning function

**Files:**
- Modify: `src/bioelectricity_research/server.py`

**Step 1: Add slide planning function (before the MCP tool, around line 4150)**

```python
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
- "title" or "headline": the slide header
- "subtitle" (for title slides) or "bullets" (array of strings for content)
- "visual_prompt": description of the visual/diagram to generate (be specific about scientific imagery)
- "paper_citation" (for evidence slides): paper title and year

IMPORTANT: visual_prompt should describe scientific diagrams, cellular imagery, or conceptual illustrations relevant to bioelectricity research. Be specific.

Return ONLY valid JSON array, no markdown or explanation."""

    response = await asyncio.to_thread(
        lambda: _get_genai_client().models.generate_content(
            model=GEMINI_MODEL_DEFAULT,
            contents=prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 4096,
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

    import json
    try:
        slides = json.loads(response_text)
        return slides
    except json.JSONDecodeError as e:
        print(f"[SLIDES] Failed to parse slide JSON: {e}")
        print(f"[SLIDES] Raw response: {response_text[:500]}")
        raise ValueError(f"Failed to parse slide plan: {e}")
```

**Step 2: Commit**

```bash
git add src/bioelectricity_research/server.py
git commit -m "feat(slides): add slide planning function with Gemini structured output"
```

---

### Task 6: Implement slide rendering function

**Files:**
- Modify: `src/bioelectricity_research/server.py`

**Step 1: Add slide rendering function**

```python
async def _render_slide(
    slide_spec: dict,
    slide_index: int,
    total_slides: int,
) -> bytes:
    """
    Render a single slide as PNG using Nano Banana Pro.

    Returns PNG image bytes.
    """
    slide_type = slide_spec.get("type", "content")
    visual_prompt = slide_spec.get("visual_prompt", "scientific diagram")

    # Build text content for the slide
    if slide_type == "title":
        title = slide_spec.get("title", "Untitled")
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

    render_prompt = f"""Create a presentation slide image with these specifications:

DESIGN SYSTEM (Noeron brand):
- Background: dark charcoal (#0a0a0a)
- Accent color: golden-chestnut (#b5651d) for highlights and decorative elements
- Text: white (#ffffff) for headlines, light gray (#a0a0a0) for body
- Corner bracket decorations in accent color at content frame corners
- Clean, scientific, modern aesthetic
- Slide dimensions: {SLIDE_WIDTH}x{SLIDE_HEIGHT} pixels (16:9)

SLIDE {slide_index + 1} OF {total_slides}
TYPE: {slide_type}

TEXT CONTENT:
{text_content}

VISUAL ELEMENT:
{visual_prompt}

Create a polished, professional slide with the text content clearly readable and the visual element as a diagram or illustration. The visual should complement the text, not overwhelm it. Use the Noeron color scheme consistently."""

    try:
        response = await asyncio.to_thread(
            lambda: _get_genai_client().models.generate_content(
                model=NANO_BANANA_MODEL,
                contents=render_prompt,
                config={
                    "response_mime_type": "image/png",
                }
            )
        )

        # Extract image data
        if hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                for part in candidate.content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        image_data = part.inline_data.data
                        if isinstance(image_data, str):
                            import base64
                            return base64.b64decode(image_data)
                        return image_data

        raise ValueError("No image data in response")

    except Exception as e:
        print(f"[SLIDES] Failed to render slide {slide_index + 1}: {e}")
        raise
```

**Step 2: Commit**

```bash
git add src/bioelectricity_research/server.py
git commit -m "feat(slides): add slide rendering function with Nano Banana Pro"
```

---

### Task 7: Implement PDF assembly function

**Files:**
- Modify: `src/bioelectricity_research/server.py`

**Step 1: Add PDF assembly function**

```python
async def _assemble_pdf(
    slide_images: list[bytes],
    claim_id: str,
    style: str,
) -> bytes:
    """
    Combine slide PNG images into a single PDF.

    Returns PDF bytes.
    """
    from reportlab.lib.pagesizes import landscape
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
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
        from reportlab.lib.utils import ImageReader
        img_reader = ImageReader(img_buffer)
        c.drawImage(img_reader, 0, 0, width=page_width, height=page_height)

        # Add page (except for last slide)
        if i < len(slide_images) - 1:
            c.showPage()

    c.save()
    return pdf_buffer.getvalue()
```

**Step 2: Add reportlab to dependencies**

Run: `cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2 && uv add reportlab pillow`

**Step 3: Commit**

```bash
git add src/bioelectricity_research/server.py pyproject.toml uv.lock
git commit -m "feat(slides): add PDF assembly function with reportlab"
```

---

### Task 8: Implement main slide generation MCP tool

**Files:**
- Modify: `src/bioelectricity_research/server.py`

**Step 1: Add the main implementation function**

```python
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
    start_time = time.time()

    try:
        # Step 1: Check cache (if not forcing regenerate)
        if not force_regenerate and user_id:
            existing = await asyncio.to_thread(
                lambda: get_supabase_client()
                    .table("generated_slides")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("claim_id", claim_id)
                    .eq("style", style)
                    .maybeSingle()
                    .execute()
            )
            if existing.data:
                print(f"[SLIDES] Returning cached slides for {claim_id}")
                return {
                    "pdf_url": existing.data["pdf_url"],
                    "thumbnail_urls": existing.data.get("thumbnail_urls", []),
                    "slide_count": existing.data["slide_count"],
                    "slide_specs": existing.data["slide_specs"],
                    "cached": True,
                    "generated_at": existing.data["created_at"],
                }

        # Step 2: Get claim context
        print(f"[SLIDES] Fetching claim context for {claim_id}")
        context = await get_claim_context(GetClaimContextInput(
            claim_id=claim_id,
            episode_id=episode_id,
            include_related_concepts=False,
        ))

        if context.get("error"):
            return {"error": context["error"], "error_code": "CONTEXT_FAILED"}

        claim_text = context.get("synthesis", {}).get("claim_text", "")
        rationale = context.get("synthesis", {}).get("rationale", "")

        # Step 3: Get deep dive summary
        print(f"[SLIDES] Fetching deep dive summary")
        deep_dive = await generate_deep_dive_summary(GenerateDeepDiveSummaryInput(
            claim_id=claim_id,
            episode_id=episode_id,
            style="technical",
        ))

        summary_text = deep_dive.get("summary", "")
        papers = deep_dive.get("papers", [])

        if not summary_text:
            return {
                "error": "Not enough content to generate slides. Try a claim with more evidence.",
                "error_code": "INSUFFICIENT_CONTENT",
            }

        # Step 4: Plan slides
        print(f"[SLIDES] Planning slides with style: {style}")
        slide_specs = await _plan_slides(
            claim_text=claim_text,
            synthesis_rationale=rationale,
            deep_dive_summary=summary_text,
            papers=papers,
            style=style,
        )

        print(f"[SLIDES] Planned {len(slide_specs)} slides")

        # Step 5: Render each slide
        print(f"[SLIDES] Rendering slides...")
        slide_images = []
        for i, spec in enumerate(slide_specs):
            print(f"[SLIDES] Rendering slide {i + 1}/{len(slide_specs)}")
            img_bytes = await _render_slide(spec, i, len(slide_specs))
            slide_images.append(img_bytes)

        # Step 6: Assemble PDF
        print(f"[SLIDES] Assembling PDF...")
        pdf_bytes = await _assemble_pdf(slide_images, claim_id, style)

        # Step 7: Upload to Supabase Storage
        print(f"[SLIDES] Uploading to Supabase Storage...")
        import uuid
        from datetime import datetime

        file_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_path = f"{claim_id}/{style}_{timestamp}_{file_id}.pdf"

        storage = get_supabase_client().storage.from_(SLIDES_BUCKET)

        upload_result = await asyncio.to_thread(
            lambda: storage.upload(
                pdf_path,
                pdf_bytes,
                {"content-type": "application/pdf"}
            )
        )

        # Get public URL
        pdf_url = storage.get_public_url(pdf_path)

        # Upload thumbnails (first and last slide)
        thumbnail_urls = []
        for idx in [0, len(slide_images) - 1]:
            thumb_path = f"{claim_id}/thumb_{style}_{idx}_{file_id}.png"
            await asyncio.to_thread(
                lambda p=thumb_path, img=slide_images[idx]: storage.upload(
                    p, img, {"content-type": "image/png"}
                )
            )
            thumbnail_urls.append(storage.get_public_url(thumb_path))

        generation_time_ms = int((time.time() - start_time) * 1000)

        # Step 8: Save to database
        if user_id:
            await asyncio.to_thread(
                lambda: get_supabase_client()
                    .table("generated_slides")
                    .upsert({
                        "user_id": user_id,
                        "claim_id": claim_id,
                        "episode_id": episode_id,
                        "style": style,
                        "slide_count": len(slide_specs),
                        "slide_specs": slide_specs,
                        "pdf_url": pdf_url,
                        "thumbnail_urls": thumbnail_urls,
                        "generation_time_ms": generation_time_ms,
                    }, on_conflict="user_id,claim_id,style")
                    .execute()
            )

        print(f"[SLIDES] Complete! Generated {len(slide_specs)} slides in {generation_time_ms}ms")

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
        print(f"[SLIDES] Error: {e}")
        return {
            "error": f"Failed to generate slides: {str(e)}",
            "traceback": traceback.format_exc(),
            "error_code": "GENERATION_FAILED",
        }


@mcp.tool()
async def generate_slide_deck(params: GenerateSlideDeckInput) -> dict[str, Any]:
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
```

**Step 2: Commit**

```bash
git add src/bioelectricity_research/server.py
git commit -m "feat(slides): implement generate_slide_deck MCP tool"
```

---

### Task 9: Add community slides query tool

**Files:**
- Modify: `src/bioelectricity_research/server.py`

**Step 1: Add input model and tool**

```python
class GetCommunitySlidesInput(BaseModel):
    """Input for fetching community slides."""
    claim_id: str = Field(..., description="The claim ID to get community slides for")


@mcp.tool()
async def get_community_slides(params: GetCommunitySlidesInput) -> dict[str, Any]:
    """
    Get publicly shared slides for a claim from the community.

    Returns slides shared by other users for this claim, with creator attribution.
    """
    try:
        result = await asyncio.to_thread(
            lambda: get_supabase_client()
                .table("generated_slides")
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
            profiles_result = await asyncio.to_thread(
                lambda: get_supabase_client()
                    .table("user_profiles")
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
```

**Step 2: Commit**

```bash
git add src/bioelectricity_research/server.py
git commit -m "feat(slides): add get_community_slides MCP tool"
```

---

### Task 10: Add share/unshare slide tool

**Files:**
- Modify: `src/bioelectricity_research/server.py`

**Step 1: Add input model and tool**

```python
class UpdateSlideShareInput(BaseModel):
    """Input for updating slide sharing status."""
    slide_id: str = Field(..., description="The slide deck ID")
    is_public: bool = Field(..., description="Whether to make the slide public")
    user_id: str = Field(..., description="User ID (must own the slide)")


@mcp.tool()
async def update_slide_sharing(params: UpdateSlideShareInput) -> dict[str, Any]:
    """
    Update the sharing status of a slide deck.

    Users can only update slides they own.
    """
    try:
        result = await asyncio.to_thread(
            lambda: get_supabase_client()
                .table("generated_slides")
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
```

**Step 2: Commit**

```bash
git add src/bioelectricity_research/server.py
git commit -m "feat(slides): add update_slide_sharing MCP tool"
```

---

## Phase 3: Frontend - Create Tab

### Task 11: Add API functions for slides

**Files:**
- Modify: `frontend/lib/api.ts`

**Step 1: Add types and API functions**

```typescript
// Add to existing types section
export interface SlideSpec {
  type: "title" | "content" | "evidence" | "summary"
  title?: string
  headline?: string
  subtitle?: string
  bullets?: string[]
  key_takeaways?: string[]
  visual_prompt?: string
  paper_citation?: string
}

export interface GeneratedSlides {
  pdf_url: string
  thumbnail_urls: string[]
  slide_count: number
  slide_specs: SlideSpec[]
  cached: boolean
  generated_at: string
  generation_time_ms?: number
  error?: string
}

export interface CommunitySlide {
  id: string
  style: "presenter" | "detailed"
  slide_count: number
  pdf_url: string
  thumbnail_urls: string[]
  created_at: string
  creator_name: string
}

// Add API functions
export async function generateSlideDeck(
  claimId: string,
  episodeId: string,
  style: "presenter" | "detailed",
  userId?: string,
  forceRegenerate = false
): Promise<GeneratedSlides> {
  return callMcpTool<GeneratedSlides>("generate_slide_deck", {
    claim_id: claimId,
    episode_id: episodeId,
    style,
    user_id: userId,
    force_regenerate: forceRegenerate,
  })
}

export async function getCommunitySlides(claimId: string): Promise<{ slides: CommunitySlide[]; count: number }> {
  return callMcpTool<{ slides: CommunitySlide[]; count: number }>("get_community_slides", {
    claim_id: claimId,
  })
}

export async function updateSlideSharing(
  slideId: string,
  isPublic: boolean,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  return callMcpTool<{ success: boolean; error?: string }>("update_slide_sharing", {
    slide_id: slideId,
    is_public: isPublic,
    user_id: userId,
  })
}
```

**Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(slides): add frontend API functions for slide generation"
```

---

### Task 12: Create SlideDeckGenerator component

**Files:**
- Create: `frontend/components/deep-exploration/slides/slide-deck-generator.tsx`

**Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"
import { Loader2, Presentation, Download, Share2, RefreshCw } from "lucide-react"
import { generateSlideDeck, type GeneratedSlides } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

interface SlideStyleOption {
  id: "presenter" | "detailed"
  label: string
  description: string
}

const STYLE_OPTIONS: SlideStyleOption[] = [
  {
    id: "presenter",
    label: "Presenter",
    description: "Clean visuals with key points for presenting live.",
  },
  {
    id: "detailed",
    label: "Detailed",
    description: "Comprehensive deck you can share without narration.",
  },
]

interface SlideDeckGeneratorProps {
  claimId: string
  episodeId: string
  onGenerated?: (slides: GeneratedSlides) => void
  onShare?: (slides: GeneratedSlides) => void
}

export function SlideDeckGenerator({
  claimId,
  episodeId,
  onGenerated,
  onShare,
}: SlideDeckGeneratorProps) {
  const { user } = useAuth()
  const [selectedStyle, setSelectedStyle] = useState<"presenter" | "detailed" | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState("")
  const [generatedSlides, setGeneratedSlides] = useState<GeneratedSlides | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!selectedStyle) return

    setIsGenerating(true)
    setError(null)
    setProgress("Planning slides...")

    try {
      const result = await generateSlideDeck(
        claimId,
        episodeId,
        selectedStyle,
        user?.id
      )

      if (result.error) {
        setError(result.error)
      } else {
        setGeneratedSlides(result)
        onGenerated?.(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate slides")
    } finally {
      setIsGenerating(false)
      setProgress("")
    }
  }

  const handleRegenerate = async () => {
    if (!selectedStyle) return

    setIsGenerating(true)
    setError(null)
    setGeneratedSlides(null)

    try {
      const result = await generateSlideDeck(
        claimId,
        episodeId,
        selectedStyle,
        user?.id,
        true // force regenerate
      )

      if (result.error) {
        setError(result.error)
      } else {
        setGeneratedSlides(result)
        onGenerated?.(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate slides")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Presentation className="w-5 h-5 text-[var(--golden-chestnut)]" />
        <h4 className="font-bold text-lg">Slide Deck</h4>
      </div>

      <p className="text-foreground/60 text-sm">
        Generate a presentation explaining this claim and its evidence.
      </p>

      {/* Style Selection */}
      {!generatedSlides && (
        <div className="grid grid-cols-2 gap-3">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedStyle(option.id)}
              disabled={isGenerating}
              className={`
                p-4 text-left border transition-all
                ${selectedStyle === option.id
                  ? "border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10"
                  : "border-border hover:border-foreground/30"
                }
                ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <div className="font-medium mb-1">{option.label}</div>
              <div className="text-xs text-foreground/50">{option.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* Generate Button */}
      {!generatedSlides && (
        <button
          onClick={handleGenerate}
          disabled={!selectedStyle || isGenerating}
          className={`
            w-full py-3 font-medium transition-all flex items-center justify-center gap-2
            ${selectedStyle && !isGenerating
              ? "bg-[var(--golden-chestnut)] text-white hover:bg-[var(--golden-chestnut)]/90"
              : "bg-foreground/10 text-foreground/40 cursor-not-allowed"
            }
          `}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {progress || "Generating..."}
            </>
          ) : (
            "Generate Slides"
          )}
        </button>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Generated Result */}
      {generatedSlides && (
        <div className="space-y-4">
          {/* Thumbnail Preview */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {generatedSlides.thumbnail_urls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Slide ${i + 1}`}
                className="h-24 rounded border border-border"
              />
            ))}
            <div className="flex items-center justify-center h-24 px-4 bg-foreground/5 rounded border border-dashed border-border text-foreground/40 text-sm">
              +{generatedSlides.slide_count - 2} more
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={generatedSlides.pdf_url}
              download
              className="flex-1 py-2 px-4 bg-[var(--golden-chestnut)] text-white font-medium flex items-center justify-center gap-2 hover:bg-[var(--golden-chestnut)]/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
            {user && (
              <button
                onClick={() => onShare?.(generatedSlides)}
                className="py-2 px-4 border border-[var(--golden-chestnut)] text-[var(--golden-chestnut)] font-medium flex items-center gap-2 hover:bg-[var(--golden-chestnut)]/10 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )}
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="py-2 px-4 border border-border text-foreground/60 flex items-center gap-2 hover:bg-foreground/5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground/40">
            {generatedSlides.slide_count} slides · {selectedStyle} style
            {generatedSlides.cached && " · from cache"}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/deep-exploration/slides/slide-deck-generator.tsx
git commit -m "feat(slides): add SlideDeckGenerator component"
```

---

### Task 13: Create ShareSlideModal component

**Files:**
- Create: `frontend/components/deep-exploration/slides/share-slide-modal.tsx`

**Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"
import { X, Share2, Globe, Lock } from "lucide-react"
import { updateSlideSharing } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

interface ShareSlideModalProps {
  open: boolean
  onClose: () => void
  slideId: string
  isCurrentlyPublic: boolean
  onShareUpdated?: (isPublic: boolean) => void
}

export function ShareSlideModal({
  open,
  onClose,
  slideId,
  isCurrentlyPublic,
  onShareUpdated,
}: ShareSlideModalProps) {
  const { user } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleShare = async (makePublic: boolean) => {
    if (!user) return

    setIsUpdating(true)
    setError(null)

    try {
      const result = await updateSlideSharing(slideId, makePublic, user.id)
      if (result.success) {
        onShareUpdated?.(makePublic)
        onClose()
      } else {
        setError(result.error || "Failed to update sharing")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sharing")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[var(--golden-chestnut)]" />
            <h3 className="font-bold text-lg">Share with Community</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-foreground/10 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-foreground/60 text-sm mb-6">
          {isCurrentlyPublic
            ? "This slide deck is currently shared with the community. Others can view and download it."
            : "Share your slide deck with other Noeron users exploring this claim."}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isCurrentlyPublic ? (
            <button
              onClick={() => handleShare(false)}
              disabled={isUpdating}
              className="w-full py-3 border border-border flex items-center justify-center gap-2 hover:bg-foreground/5 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Make Private
            </button>
          ) : (
            <button
              onClick={() => handleShare(true)}
              disabled={isUpdating}
              className="w-full py-3 bg-[var(--golden-chestnut)] text-white flex items-center justify-center gap-2 hover:bg-[var(--golden-chestnut)]/90 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Share with Community
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 border border-border text-foreground/60 hover:bg-foreground/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/deep-exploration/slides/share-slide-modal.tsx
git commit -m "feat(slides): add ShareSlideModal component"
```

---

### Task 14: Create slides index export

**Files:**
- Create: `frontend/components/deep-exploration/slides/index.ts`

**Step 1: Create index file**

```typescript
export { SlideDeckGenerator } from "./slide-deck-generator"
export { ShareSlideModal } from "./share-slide-modal"
```

**Step 2: Commit**

```bash
git add frontend/components/deep-exploration/slides/index.ts
git commit -m "chore(slides): add slides component exports"
```

---

### Task 15: Update CreateTab with slide generator

**Files:**
- Modify: `frontend/components/deep-exploration/tabs/create-tab.tsx`

**Step 1: Add imports and state**

Add to imports:
```tsx
import { useState } from "react"
import { SlideDeckGenerator, ShareSlideModal } from "../slides"
import type { GeneratedSlides } from "@/lib/api"
```

**Step 2: Update props interface**

```tsx
interface CreateTabProps {
  claimId: string        // Add this
  episodeId: string      // Add this
  miniPodcast: GeneratePodcastResponse | null
  isLoadingPodcast: boolean
  podcastError: string | null
  onGeneratePodcast: () => void
  onRegeneratePodcast: () => void
  synthesisMode: "simplified" | "technical"
}
```

**Step 3: Add state and handlers inside component**

```tsx
const [generatedSlides, setGeneratedSlides] = useState<GeneratedSlides | null>(null)
const [showShareModal, setShowShareModal] = useState(false)
const [currentSlideId, setCurrentSlideId] = useState<string | null>(null)

const handleSlideGenerated = (slides: GeneratedSlides) => {
  setGeneratedSlides(slides)
}

const handleShareSlides = (slides: GeneratedSlides) => {
  // For now we use a placeholder ID - in production this would come from the DB
  setCurrentSlideId(slides.pdf_url)
  setShowShareModal(true)
}
```

**Step 4: Replace the Slides placeholder with SlideDeckGenerator**

Replace this block:
```tsx
<CornerBrackets className="bg-card/20 p-6 opacity-50">
  <div className="flex items-center gap-2 mb-2">
    <span className="text-lg">📊</span>
    <h4 className="font-medium">Slides</h4>
  </div>
  <p className="text-foreground/40 text-sm">Coming soon</p>
</CornerBrackets>
```

With:
```tsx
<CornerBrackets className="bg-card/30 p-6">
  <SlideDeckGenerator
    claimId={claimId}
    episodeId={episodeId}
    onGenerated={handleSlideGenerated}
    onShare={handleShareSlides}
  />
</CornerBrackets>
```

**Step 5: Add modal at end of component (before closing div)**

```tsx
<ShareSlideModal
  open={showShareModal}
  onClose={() => setShowShareModal(false)}
  slideId={currentSlideId || ""}
  isCurrentlyPublic={false}
  onShareUpdated={(isPublic) => {
    console.log("Share updated:", isPublic)
  }}
/>
```

**Step 6: Commit**

```bash
git add frontend/components/deep-exploration/tabs/create-tab.tsx
git commit -m "feat(slides): integrate SlideDeckGenerator into CreateTab"
```

---

### Task 16: Update DeepExplorationView to pass claim props

**Files:**
- Modify: `frontend/components/deep-exploration-view.tsx`

**Step 1: Update CreateTab usage**

Find the CreateTab usage (~line 639) and add the missing props:

```tsx
{activeTab === "create" && (
  <CreateTab
    claimId={claim.id}           // Add this
    episodeId={episodeId}        // Add this
    miniPodcast={miniPodcast}
    isLoadingPodcast={isLoadingPodcast}
    podcastError={podcastError}
    onGeneratePodcast={() => fetchMiniPodcast(false)}
    onRegeneratePodcast={() => fetchMiniPodcast(true)}
    synthesisMode={synthesisMode}
  />
)}
```

**Step 2: Commit**

```bash
git add frontend/components/deep-exploration-view.tsx
git commit -m "feat(slides): pass claim props to CreateTab"
```

---

## Phase 4: Frontend - Community Tab

### Task 17: Add Community tab to SegmentedTabBar

**Files:**
- Modify: `frontend/components/deep-exploration/segmented-tab-bar.tsx`

**Step 1: Update TabId type**

```tsx
export type TabId = "overview" | "evidence" | "figures" | "graph" | "create" | "community"
```

**Step 2: Add Community to TABS array**

```tsx
const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "figures", label: "Figures" },
  { id: "graph", label: "Graph" },
  { id: "create", label: "Create" },
  { id: "community", label: "Community" },
]
```

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/segmented-tab-bar.tsx
git commit -m "feat(community): add Community tab to segmented tab bar"
```

---

### Task 18: Create CommunityTab component

**Files:**
- Create: `frontend/components/deep-exploration/tabs/community-tab.tsx`

**Step 1: Create the component**

```tsx
"use client"

import { useState, useEffect } from "react"
import { Users, Presentation, Mic, FileText, HelpCircle, Download, Play, Loader2 } from "lucide-react"
import { getCommunitySlides, type CommunitySlide } from "@/lib/api"

type AssetType = "all" | "slides" | "audio" | "notes" | "quiz"

const FILTERS: { id: AssetType; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: null },
  { id: "slides", label: "Slides", icon: <Presentation className="w-3 h-3" /> },
  { id: "audio", label: "Audio", icon: <Mic className="w-3 h-3" /> },
  { id: "notes", label: "Notes", icon: <FileText className="w-3 h-3" /> },
  { id: "quiz", label: "Quiz", icon: <HelpCircle className="w-3 h-3" /> },
]

interface CommunityTabProps {
  claimId: string
}

export function CommunityTab({ claimId }: CommunityTabProps) {
  const [filter, setFilter] = useState<AssetType>("all")
  const [slides, setSlides] = useState<CommunitySlide[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCommunityContent = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getCommunitySlides(claimId)
        setSlides(result.slides || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load community content")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCommunityContent()
  }, [claimId])

  const filteredSlides = filter === "all" || filter === "slides" ? slides : []
  const hasContent = filteredSlides.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-[var(--golden-chestnut)]" />
        <h3 className="font-bold text-xl">Community</h3>
      </div>

      <p className="text-foreground/60 text-sm">
        See what others have created for this claim.
      </p>

      {/* Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`
              px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors
              ${filter === f.id
                ? "bg-[var(--golden-chestnut)] text-white"
                : "bg-foreground/10 text-foreground/60 hover:bg-foreground/20"
              }
            `}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content List */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {filteredSlides.map((slide) => (
            <div
              key={slide.id}
              className="p-4 border border-border bg-card/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Presentation className="w-5 h-5 text-[var(--golden-chestnut)]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Slide Deck</span>
                    <span className="text-xs px-2 py-0.5 bg-foreground/10 rounded">
                      {slide.style}
                    </span>
                  </div>
                  <div className="text-xs text-foreground/50">
                    by @{slide.creator_name} · {new Date(slide.created_at).toLocaleDateString()} · {slide.slide_count} slides
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={slide.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-sm border border-border hover:bg-foreground/5 transition-colors"
                >
                  View
                </a>
                <a
                  href={slide.pdf_url}
                  download
                  className="px-3 py-1.5 text-sm border border-[var(--golden-chestnut)] text-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/10 transition-colors flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  PDF
                </a>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {!hasContent && (
            <div className="py-12 text-center">
              <Users className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-foreground/40">
                No community content yet.
              </p>
              <p className="text-foreground/30 text-sm mt-1">
                Create something in the Create tab and share it!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/deep-exploration/tabs/community-tab.tsx
git commit -m "feat(community): add CommunityTab component"
```

---

### Task 19: Export CommunityTab and integrate

**Files:**
- Modify: `frontend/components/deep-exploration/tabs/index.ts`
- Modify: `frontend/components/deep-exploration-view.tsx`

**Step 1: Add export to index.ts**

```typescript
export { OverviewTab } from "./overview-tab"
export { EvidenceTab } from "./evidence-tab"
export { FiguresTab } from "./figures-tab"
export { GraphTab } from "./graph-tab"
export { CreateTab } from "./create-tab"
export { CommunityTab } from "./community-tab"
```

**Step 2: Import and use in DeepExplorationView**

Add to imports:
```tsx
import { OverviewTab, EvidenceTab, FiguresTab, GraphTab, CreateTab, CommunityTab } from "./deep-exploration/tabs"
```

Add after CreateTab block (~line 648):
```tsx
{activeTab === "community" && (
  <CommunityTab claimId={claim.id} />
)}
```

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/tabs/index.ts frontend/components/deep-exploration-view.tsx
git commit -m "feat(community): integrate CommunityTab into DeepExplorationView"
```

---

## Phase 5: Testing & Polish

### Task 20: Manual testing checklist

**Test the full flow:**

1. **Database setup**
   - [ ] Run migrations in Supabase
   - [ ] Create `generated-slides` storage bucket
   - [ ] Verify RLS policies work

2. **Backend**
   - [ ] Test `generate_slide_deck` with a real claim
   - [ ] Verify PDF is uploaded to Supabase Storage
   - [ ] Test `get_community_slides` returns empty array
   - [ ] Test `update_slide_sharing` toggles is_public

3. **Frontend - Create Tab**
   - [ ] Style picker highlights selected option
   - [ ] Generate button disabled until style selected
   - [ ] Loading state shows during generation
   - [ ] Thumbnails display after generation
   - [ ] Download PDF link works
   - [ ] Share button opens modal (when logged in)

4. **Frontend - Community Tab**
   - [ ] Tab appears in navigation
   - [ ] Empty state shows when no community content
   - [ ] Filter chips work
   - [ ] Community slides display with correct info
   - [ ] View and Download buttons work

5. **Error handling**
   - [ ] No API key shows appropriate message
   - [ ] Generation failure shows error
   - [ ] Rate limiting handled gracefully

**Step 1: Run through checklist**

Document any issues found.

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat(slides): complete slide deck generator with community sharing"
```

---

## Summary

**Total tasks:** 20

**Phase breakdown:**
- Phase 1 (Database): Tasks 1-3
- Phase 2 (Backend): Tasks 4-10
- Phase 3 (Frontend Create): Tasks 11-16
- Phase 4 (Frontend Community): Tasks 17-19
- Phase 5 (Testing): Task 20

**Dependencies:**
- Tasks 1-3 must complete before Tasks 4-10
- Tasks 4-10 must complete before Tasks 11-16
- Task 17 can run parallel to Tasks 11-16
- Tasks 18-19 depend on Task 17
- Task 20 requires all others complete
