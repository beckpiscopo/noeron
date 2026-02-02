# Slide Deck Generator Design

**Date:** 2026-02-02
**Status:** Ready for implementation

## Overview

Add NotebookLM-style slide generation to the Create tab. Users can generate presentation decks from claim evidence, download as PDF, and optionally share with the community.

## User Flow

1. User navigates to Deep Exploration → Create tab
2. In the new "Slide Deck" section, user selects a style:
   - **Presenter**: Clean visuals with key points for live presenting
   - **Detailed**: Comprehensive deck that stands alone without narration
3. User clicks "Generate Slides" (requires Gemini API key)
4. Progress indicator shows steps: Planning → Rendering slides → Assembling PDF
5. Preview carousel appears with slide thumbnails
6. User can: Download PDF, Share with community, or Regenerate

## Slide Styles

| Style | Purpose | Content Density | Typical Slides |
|-------|---------|-----------------|----------------|
| Presenter | Live presentations | Sparse, visual-heavy | 5-7 |
| Detailed | Shareable explainer | Comprehensive text | 8-12 |

Slide count is content-driven - Gemini decides based on available evidence depth.

## Generation Pipeline

### Step 1: Gather Content
- Claim text + synthesis (from `get_claim_context`)
- Deep dive summary (already cached)
- Top 3-5 papers from evidence threads with key findings

### Step 2: Plan Slides (Gemini Structured Output)
Input: gathered content + style preference

Output JSON schema:
```json
{
  "slides": [
    {
      "type": "title",
      "title": "string",
      "subtitle": "string"
    },
    {
      "type": "content",
      "headline": "string",
      "bullets": ["string"],
      "visual_prompt": "string (description for image generation)"
    },
    {
      "type": "evidence",
      "paper_title": "string",
      "finding": "string",
      "citation": "string",
      "visual_prompt": "string"
    },
    {
      "type": "summary",
      "key_takeaways": ["string"]
    }
  ]
}
```

### Step 3: Render Slides (Nano Banana Pro)
For each slide spec, call `gemini-3-pro-image-preview` with:
- Slide content from the plan
- Noeron design system: dark background (#0a0a0a), golden-chestnut accent (#b5651d), corner bracket decorations
- Output: 1920x1080 PNG

Slides rendered independently for parallelization and error recovery.

### Step 4: Assemble PDF
- Combine PNGs into single PDF using reportlab or pypdf
- Add metadata (claim_id, style, generated_at)
- Compress images to target <5MB total

### Step 5: Store & Return
- Upload PDF to Supabase Storage
- Generate thumbnails for preview
- Create row in `generated_slides` table
- Return: `{ pdf_url, thumbnail_urls, slide_count }`

## Visual Design

Slides match Noeron's design system:
- Background: #0a0a0a (dark)
- Accent: #b5651d (golden-chestnut)
- Corner bracket decorations on content frames
- Clean, scientific aesthetic

## Database Schema

### New table: `generated_slides`

```sql
create table generated_slides (
  id uuid primary key default gen_random_uuid(),

  -- Ownership
  user_id uuid references auth.users(id) on delete cascade,
  claim_id text not null,
  episode_id text not null,

  -- Content
  style text not null check (style in ('presenter', 'detailed')),
  slide_count int not null,
  slide_specs jsonb not null,

  -- Storage
  pdf_url text not null,
  thumbnail_urls text[],

  -- Sharing
  is_public boolean default false,

  -- Metadata
  created_at timestamptz default now(),
  generation_time_ms int,

  constraint unique_user_claim_style unique (user_id, claim_id, style)
);

create index idx_slides_public_claim on generated_slides(claim_id)
  where is_public = true;

-- RLS policies
alter table generated_slides enable row level security;

create policy "Users can view own slides" on generated_slides
  for select using (auth.uid() = user_id);

create policy "Anyone can view public slides" on generated_slides
  for select using (is_public = true);

create policy "Users can create slides" on generated_slides
  for insert with check (auth.uid() = user_id);

create policy "Users can update own slides" on generated_slides
  for update using (auth.uid() = user_id);
```

### New table: `user_profiles`

```sql
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);
```

## Community Tab

New tab in Deep Exploration: `[ Overview | Evidence | Figures | Graph | Create | Community ]`

**Create tab**: Generation tools only (Audio Overview, Slides, future content types)

**Community tab**: Shared assets for this claim
- Filter chips: All | Slides | Audio | Notes | Quiz
- Asset cards showing: type, style, creator, date, action buttons
- Empty state: "No community content yet. Create something in the Create tab and share it!"

Future: Audio Overviews can also be shared using the same pattern.

## Frontend Components

```
frontend/components/deep-exploration/
├── tabs/
│   ├── create-tab.tsx              # Add SlideDeckGenerator section
│   └── community-tab.tsx           # New tab
├── slides/
│   ├── slide-deck-generator.tsx    # Style picker + generate button
│   ├── slide-preview-carousel.tsx  # Thumbnail carousel
│   └── share-slide-modal.tsx       # Share confirmation
├── community/
│   └── community-asset-card.tsx    # Reusable card for any asset type
└── segmented-tab-bar.tsx           # Add "Community" tab
```

## API Key Handling

Uses existing BYOK (Bring Your Own Key) model:
- User provides their own Gemini API key
- Same flow as figure analysis
- If no key, prompt with existing `ApiKeyModal`

## Error Handling

| Error | User Message |
|-------|--------------|
| No Gemini API key | Prompt to add key via ApiKeyModal |
| Invalid/expired key | "Invalid API key. Please check your Gemini key in settings." |
| Rate limited (429) | "Rate limited. Please wait a moment and try again." |
| Quota exceeded | "Image generation quota exceeded. Try again later or check your Gemini billing." |
| Partial render failure | Retry failed slides 2x, then offer partial download |
| Not enough content | "Not enough evidence to generate slides. Try a claim with more supporting research." |
| Not logged in (sharing) | "Sign in to share with the community" |

## Loading States

| State | UI |
|-------|-----|
| Idle | Two style cards unselected, button disabled |
| Style selected | Selected card highlighted, button enabled |
| Generating | Progress bar: "Planning slides..." → "Rendering slide 3/7..." → "Assembling PDF..." |
| Complete | Carousel preview + Download/Share/Regenerate buttons |
| Error | Error message + "Try Again" button |

## Implementation Scope

### Backend
- [ ] `generate_slide_deck` MCP tool
- [ ] Supabase Storage bucket for slides
- [ ] `generated_slides` table migration
- [ ] `user_profiles` table migration
- [ ] API endpoint for community slides

### Frontend
- [ ] `SlideDeckGenerator` component
- [ ] `SlidePreviewCarousel` component
- [ ] `CommunityTab` component
- [ ] `ShareSlideModal` component
- [ ] Update `SegmentedTabBar` with Community tab
- [ ] Update `create-tab.tsx` with slides section

### Out of Scope (Future)
- Shareable Audio Overviews
- Study Notes, Quiz, Flashcards generation
- Global community feed / discovery page
- User profile pages
