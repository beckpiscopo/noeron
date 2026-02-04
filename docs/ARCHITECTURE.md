# Architecture Overview

This repo is a Python-based MCP server with a data pipeline that ingests papers and transcripts,
builds a vector store, and exposes tools via FastMCP + a small HTTP adapter. A separate Next.js
frontend consumes those tools.

## System map

Backend (Python):
- `src/bioelectricity_research/server.py` is the MCP tool surface and core orchestration.
- `src/bioelectricity_research/context_builder.py` builds layered chat context (episode + temporal window + evidence cards).
- `src/bioelectricity_research/storage.py` handles paper metadata, PDF caching, and text extraction.
- `src/bioelectricity_research/vector_store.py` manages vector embeddings (ChromaDB local or Supabase pgvector with Gemini embeddings).
- `src/bioelectricity_research/http_server.py` exposes MCP tools as REST endpoints.
- `scripts/supabase_client.py` provides Supabase database client with query methods.

Pipeline (Python scripts):
- `scripts/grobid_extract.py` -> `data/grobid_fulltext/`
- `scripts/grobid_quality_check.py` -> `data/grobid_quality_report.json`
- `scripts/prepare_texts.py` -> in-memory or `data/cleaned_papers/`
- `scripts/build_vector_store.py` -> `data/vectorstore/`
- `scripts/fetch_assemblyai_transcript.py` -> `data/cleaned_papers/`
- `scripts/context_card_builder.py` + `scripts/run_context_card_builder_batch.py`
- `scripts/generate_episode_summaries.py` -> `data/episode_summaries.json` + updates `data/episodes.json`

Frontend (Next.js):
- `frontend/app/` is the primary Next app
- `frontend/components/` is the main UI component set
- API proxy routes live in `frontend/app/api/`

## Data flow (high level)

1) Search + save papers via MCP tools (`save_paper`, `save_author_papers`)
2) PDFs cached in `data/pdfs/`
3) GROBID extracts -> `data/grobid_fulltext/`
4) Cleaned docs (in memory or `data/cleaned_papers/`)
5) Chunk + embed -> `data/vectorstore/` (local) or Supabase `paper_chunks` table (cloud)
6) MCP tools query the vector store (`rag_search`, claim context, etc.)

## Data Storage Backends

The system supports two storage backends, controlled by `USE_SUPABASE` environment variable:

| Backend | Vector Store | Context Data | When to Use |
|---------|-------------|--------------|-------------|
| Local (USE_SUPABASE=false) | ChromaDB in `data/vectorstore/` | JSON files in `data/` | Development, offline |
| Supabase (default) | pgvector in `paper_chunks` table | Supabase tables | Production, deployed |

**Supabase Tables:**
- `episodes` - Episode metadata with summaries
- `temporal_windows` - 3-minute transcript windows
- `evidence_cards` - Paper-backed claims with RAG results
- `papers` - Paper metadata (title, abstract, year, citations)
- `paper_chunks` - Text chunks with 768-dim pgvector embeddings (Gemini text-embedding-004)
- `chat_sessions` / `chat_messages` - Chat persistence
- `user_interests` - User interest tracking
- `taxonomy_clusters` - Research territory definitions with labels, descriptions, 2D positions
- `paper_cluster_assignments` - Soft cluster assignments for papers (GMM probabilities)
- `claim_cluster_assignments` - Inherited cluster assignments for claims
- `bookmarks` - User-saved items (claims, papers, snippets, AI insights, images)
- `notebook_synthesis` - Cached AI-generated notebook overviews
- `user_profiles` - User display names and profile metadata

**Key Supabase Functions:**
- `match_papers(query_embedding, threshold, count)` - Vector similarity search via pgvector
- `compare_episode_to_notebook(podcast_id, user_id)` - Compare episode clusters to user's notebook
- `get_episode_cluster_coverage(podcast_id)` - Get cluster distribution for an episode
- `get_notebook_cluster_distribution(user_id, episode_id)` - Get cluster distribution for notebook
- `get_episode_claims_by_cluster(podcast_id, cluster_id)` - Drill down into cluster claims

## Key runtime entrypoints

- MCP server: `uv run bioelectricity-research` -> `src/bioelectricity_research/__main__.py`
- HTTP adapter: `src/bioelectricity_research/http_server.py`
- Frontend dev: `cd frontend && pnpm dev`

## Configuration and secrets

- Environment variables are required for Gemini, AssemblyAI, and Supabase.
- The MCP server reads `os.environ` directly; it does not load `.env`.
- `scripts/context_card_builder.py` loads `.env` for local runs.

## LLM Models

- **Primary model**: `gemini-3-pro-preview` for chat, context building, and complex tasks
- **Fast model**: `gemini-3-flash-preview` for simpler tasks where speed matters
- Always use Gemini 3 family models for this project

## AI Chat Feature Architecture

The AI Chat is a RAG-powered research assistant that lets users ask questions about podcast episodes and claims. It uses a **layered context system** that provides temporal awareness, evidence card integration, and RAG retrieval.

**Backend Toggle:** Set `USE_SUPABASE=true` to use Supabase for all context data and vector search. Falls back to local JSON/ChromaDB on error.

### Layered Context System (NEW)

The chat now uses `src/bioelectricity_research/context_builder.py` to build rich, timestamp-aware context:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Episode Context                                     │
│ - Title, podcast, guest, host, duration                     │
│ - Description and key topics                                │
│ - Episode summary (if available)                            │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Temporal Window                                     │
│ - Current playback position (e.g., "48:00")                 │
│ - 3-minute transcript excerpt centered on current time      │
│ - Speaker identification                                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Evidence Cards                                      │
│ - Papers that appeared in the last 5 minutes                │
│ - Claim text, paper titles, confidence scores               │
│ - Direct citation links                                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: RAG Retrieval (query-triggered)                    │
│ - Vector search results from ChromaDB                       │
│ - Enhanced with temporal boosting                           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User question + current_timestamp (e.g., "48:00")
    ↓
useAIChat hook (manages state, conversation history)
    ↓
callMcpTool("chat_with_context", {
  message, episode_id, current_timestamp, claim_id,
  conversation_history, use_layered_context: true
})
    ↓
frontend/app/api/mcp/[tool]/route.ts (proxy)
    ↓
http_server.py → /tools/chat_with_context/execute
    ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Build layered context via context_builder.py             │
│    - Load episode metadata from episodes.json               │
│    - Find temporal window from window_segments.json         │
│    - Get active evidence cards from context_card_registry   │
│ 2. Load claim context (if claim_id set)                     │
│ 3. RAG search via ChromaDB                                  │
│ 4. Build system prompt with all context layers              │
│ 5. Call Gemini for response                                 │
│ 6. Return response + sources (RAG + evidence cards)         │
└─────────────────────────────────────────────────────────────┘
    ↓
ChatMessage renders response with ChatSources
```

### Context Builder Module

`src/bioelectricity_research/context_builder.py` provides:

**Data Classes:**
- `EpisodeContext`: Episode metadata (title, podcast, guest, topics, summary)
- `TemporalWindow`: Current position with transcript excerpt
- `EvidenceCard`: Paper-backed claims with timestamps
- `ActiveEvidenceCards`: Cards in the current time range
- `ChatContextLayers`: Complete layered context

**Key Functions:**
- `build_episode_context(episode_id)` → Layer 1
- `build_temporal_window(episode_id, timestamp_ms)` → Layer 2
- `build_active_evidence_cards(episode_id, timestamp_ms)` → Layer 3
- `build_chat_context(episode_id, timestamp)` → All layers combined
- `build_system_prompt(context)` → Formatted Gemini prompt

**Data Sources (JSON mode):**
- `data/episodes.json` - Episode metadata (includes compact `summary` field)
- `data/episode_summaries.json` - Full structured summaries (narrative arc, themes, key moments)
- `data/window_segments.json` - Temporal windows with transcript excerpts
- `data/context_card_registry.json` - Evidence cards with paper matches

**Data Sources (Supabase mode):**
- `episodes` table - Episode metadata with summaries
- `temporal_windows` table - Transcript windows queryable by timestamp
- `evidence_cards` table - Evidence cards with `get_evidence_cards_in_range()` function
- `paper_chunks` table - Vector embeddings with `match_papers()` function

### Component Structure

```
src/bioelectricity_research/
├── context_builder.py    # Layered context system (supports JSON + Supabase)
├── server.py             # MCP tools (chat_with_context updated)
├── http_server.py        # REST adapter
├── vector_store.py       # Vector store (ChromaDB local / Supabase pgvector)
└── storage.py            # Paper metadata

scripts/
├── supabase_client.py        # Supabase database client
└── migrate_to_supabase_full.py  # Data migration script

frontend/components/ai-chat/
├── index.ts              # Barrel exports
├── ai-chat-sidebar.tsx   # Main container (shows timestamp in context badge)
├── chat-message.tsx      # Individual message bubble
├── chat-input.tsx        # Auto-resizing textarea + send button
└── chat-sources.tsx      # Collapsible source citations

frontend/hooks/
└── use-ai-chat.ts        # State management (passes current_timestamp)

frontend/lib/
└── chat-types.ts         # TypeScript interfaces (includes current_timestamp)
```

### Key Types (chat-types.ts)

- `ChatMessage`: User/assistant message with optional sources, loading state, errors
- `ChatContext`: Episode + optional claim + **current_timestamp** passed to backend
- `ChatSource`: Paper reference returned by RAG (paper_id, title, year, snippet)
- `ChatWithContextRequest`: API request shape (includes `current_timestamp`, `use_layered_context`)
- `ChatWithContextResponse`: API response with response text + sources

### Integration Points

The `AIChatSidebar` component is mounted in:
- `listening-view.tsx` - Podcast player view (passes `formatTime(episode.currentTime)` as timestamp)
- `deep-exploration-view.tsx` - Claim deep-dive view

Both views pass a `ChatContext` object with episode info, optionally the selected claim, and the **current playback timestamp**.

### Backend Endpoints

**Standard endpoint:** `POST /tools/chat_with_context/execute`
**Streaming endpoint:** `POST /tools/chat_with_context/stream` (SSE)

The streaming endpoint provides real-time thinking traces via Server-Sent Events:

**With `use_layered_context: true` (default):**
1. Imports and uses `context_builder.py`
2. Builds layered context for episode + timestamp
3. Generates rich system prompt with all context layers
4. If `claim_id` provided, adds focused claim context
5. RAG search via ChromaDB
6. Calls Gemini with layered system prompt
7. Returns response + sources (includes evidence cards)
8. Returns `context_metadata` with temporal window info

**With `use_layered_context: false` (legacy):**
1. Loads episode metadata from `_load_episodes()`
2. If `claim_id` provided, loads claim text
3. Queries ChromaDB with user message
4. Builds prompt using `CHAT_CONTEXT_PROMPT_TEMPLATE`
5. Calls Gemini via `server._GENAI_CLIENT`
6. Returns `{ response, sources, query_used, model }`

### Testing the Context Builder

```bash
# Test standalone context builder (JSON mode)
cd /path/to/bioelectricity-research-mcp-v2
python3 -m src.bioelectricity_research.context_builder lex_325 48:00

# Test with Supabase backend
USE_SUPABASE=true python3 -m src.bioelectricity_research.context_builder lex_325 48:00

# Output shows:
# - Episode metadata
# - Temporal window (46:00 - 49:00)
# - Active evidence cards (10 cards from past 5 minutes)
# - Generated system prompt
```

### UI Component: Sheet-based Sidebar

Currently uses shadcn's `<Sheet>` component positioned on the right. Opens/closes via a `MessageSquare` icon button in the header.

**New UI features:**
- Context badge now shows current timestamp (e.g., "Episode Title @ 48:00")
- Sources include both RAG results and evidence cards
- Evidence card sources show timestamp when they appeared

## Real-Time Thinking Traces

The AI chat displays Gemini 3's reasoning process in real-time using SSE streaming.

### How It Works

```
User sends message
    ↓
Frontend: fetch("/tools/chat_with_context/stream", {method: "POST"})
    ↓
Backend spawns thread for Gemini streaming
    ↓
Gemini returns chunks with thought=True (reasoning) or thought=None (response)
    ↓
Chunks put in queue.Queue, async generator yields SSE events
    ↓
Frontend ReadableStream parses events progressively
    ↓
UI updates: "Reasoning..." section auto-expands with live text
    ↓
When thinking done, response content streams below
```

### SSE Event Types

| Event | Data | Description |
|-------|------|-------------|
| `thinking` | `{"text": "..."}` | Reasoning chunk from Gemini |
| `content` | `{"text": "..."}` | Response content chunk |
| `sources` | `{"sources": [...]}` | RAG sources array |
| `done` | `{"thinking_complete": "...", "response_complete": "..."}` | Final complete texts |
| `error` | `{"error": "..."}` | Error message |

### Key Implementation Details

**Backend (http_server.py):**
- Uses `threading.Thread` to run synchronous Gemini streaming
- `queue.Queue` bridges sync iterator with async SSE generator
- `run_in_executor` with timeout allows event loop to flush SSE events
- Gemini 3 requires streaming mode (`generate_content_stream()`) to return thought summaries

**Frontend (use-ai-chat.ts):**
- Uses `fetch()` with `response.body.getReader()` for streaming
- Parses `event:` and `data:` lines from chunked buffer
- Updates message state progressively (`isThinking`, `isStreaming` flags)

**Frontend (chat-message.tsx):**
- Auto-expands reasoning section while `isThinking=true`
- Shows animated spinner with "Reasoning..." label
- Pulsing cursor at end of streaming text

### ChatMessage Type Extensions

```typescript
interface ChatMessage {
  // ... existing fields
  thinking?: string        // Accumulated reasoning text
  isThinking?: boolean     // True while receiving thinking chunks
  isStreaming?: boolean    // True while receiving content chunks
}
```

## AI Image Generation

Users can generate scientific visualizations directly in the chat using Gemini 3 Pro Image.

### Trigger Methods
- **Explicit commands:** `/visualize <prompt>` or `/image <prompt>`
- **Natural language:** "Generate an image of...", "Show me a diagram of...", "Create a visualization..."

### Data Flow

```
User types "/visualize cell membrane voltage"
    ↓
Frontend detects image intent (detectImageIntent in use-ai-chat.ts)
    ↓
callMcpTool("generate_image_with_context", {prompt, episode_id, ...})
    ↓
Backend (_generate_image_impl in server.py):
  1. Build context from episode/timestamp
  2. Determine visualization style (diagram vs illustration)
  3. Call Gemini 3 Pro Image with response_modalities=["TEXT", "IMAGE"]
  4. Upload base64 image to Supabase Storage
  5. Generate signed URL (24h expiry)
  6. Return image_url + caption
    ↓
Frontend renders image in ChatMessage with hover actions
```

### Storage
- **Bucket:** `generated-images` (private, in Supabase Storage)
- **Access:** Signed URLs with 24-hour expiry
- **Path format:** `{episode_id}/{timestamp}_{uuid}.png`

### Key Files

| File | Purpose |
|------|---------|
| `src/bioelectricity_research/server.py` | `_generate_image_impl()` and `generate_image_with_context` MCP tool |
| `src/bioelectricity_research/http_server.py` | `/tools/generate_image_with_context/execute` endpoint |
| `frontend/hooks/use-ai-chat.ts` | `detectImageIntent()` and image generation flow |
| `frontend/components/ai-chat/chat-message.tsx` | Image rendering with download/bookmark actions |
| `frontend/lib/chat-types.ts` | `GeneratedImage` and `GenerateImageResponse` types |
| `supabase/migrations/010_add_generated_images_storage.sql` | Storage bucket policies |
| `supabase/migrations/011_add_image_to_chat_messages.sql` | `image_url`, `image_caption` columns |

### Configuration
- **Model:** `gemini-3-pro-image-preview` (4K output, advanced text rendering for diagrams)
- **Requires:** `SUPABASE_SERVICE_KEY` env var on backend for storage uploads

## AI Mini Podcast Generation

Users can generate NotebookLM-style mini podcasts on deep dive pages. Two AI hosts discuss the claim and its supporting research in a 3-5 minute conversational format.

### Architecture

```
User clicks "Generate Mini Podcast" on deep dive page
    ↓
Frontend: callMcpTool("generate_mini_podcast", {claim_id, episode_id, style})
    ↓
Backend (_generate_mini_podcast_impl in server.py):
  1. Check cache for existing podcast
  2. Load claim context from claims cache
  3. RAG search for supporting papers (7 results)
  4. Generate two-host script via Gemini 3 (gemini-3-pro-preview)
  5. Synthesize multi-speaker audio via Gemini 2.5 TTS (gemini-2.5-flash-preview-tts)
  6. Convert PCM to WAV format
  7. Upload to Supabase Storage (generated-podcasts bucket)
  8. Cache result in generated_podcasts.json
  9. Return podcast_url, script, duration_seconds
    ↓
Frontend: MiniPodcastPlayer renders audio player with script toggle
```

### Two-Host Format

- **ALEX** (Puck voice): Curious interviewer who asks engaging questions
- **SAM** (Charon voice): Knowledgeable expert who explains concepts clearly

The script prompt instructs Gemini to create natural dialogue that:
1. Opens with an engaging hook
2. Explains the core scientific concept
3. Discusses supporting research and experiments
4. Connects to broader implications
5. Ends with a thoughtful summary

### Key Files

| File | Purpose |
|------|---------|
| `src/bioelectricity_research/server.py` | `_generate_mini_podcast_impl()`, `generate_mini_podcast` MCP tool, prompt template |
| `src/bioelectricity_research/http_server.py` | `/tools/generate_mini_podcast/execute` endpoint |
| `frontend/components/mini-podcast-player.tsx` | Audio player with play/pause, progress, script expansion |
| `frontend/components/deep-exploration-view.tsx` | Integration point (right column, above evidence threads) |
| `frontend/lib/chat-types.ts` | `GeneratedPodcast`, `GeneratePodcastResponse` types |
| `supabase/migrations/012_add_generated_podcasts_storage.sql` | Storage bucket policies |
| `cache/generated_podcasts.json` | Local cache for generated podcasts |

### Storage
- **Bucket:** `generated-podcasts` (public, in Supabase Storage)
- **Access:** Public URLs for audio playback
- **Path format:** `{episode_id}/{safe_claim_id}_{timestamp}_{uuid}.wav`
- **File format:** WAV (PCM 24kHz, 16-bit mono converted from Gemini TTS output)

### Caching Strategy
- **Cache key:** `{episode_id}:{claim_id}:{style}`
- **Storage:** `cache/generated_podcasts.json`
- **Invalidation:** Manual via `force_regenerate=true` parameter

### Configuration
- **Script model:** `gemini-3-pro-preview` (reasoning for high-quality dialogue)
- **TTS model:** `gemini-2.5-flash-preview-tts` (multi-speaker audio synthesis)
- **Voices:** Puck (ALEX), Charon (SAM)
- **Target duration:** 3-5 minutes (~900-1100 words)
- **Requires:** `SUPABASE_SERVICE_KEY` env var for storage uploads

### Setup Required
1. Create `generated-podcasts` bucket in Supabase Dashboard (enable "Public bucket")
2. Set file size limit to 50MB
3. Allow MIME types: `audio/wav`, `audio/mpeg`
4. Run SQL migration `012_add_generated_podcasts_storage.sql`

## AI Slide Deck Generation

Users can generate presentation slide decks on deep dive pages. The system creates visually rich slides with AI-generated content and images, downloadable as PDF.

### Architecture

```
User selects style (presenter/detailed) and clicks "Generate Slides"
    ↓
Frontend: callMcpTool("generate_slide_deck", {claim_id, episode_id, style, user_id})
    ↓
Backend (_generate_slide_deck_impl in server.py):
  1. Check database cache for existing slides (by user_id, claim_id, style)
  2. Load claim context from claims cache
  3. Load deep dive summary from cache
  4. Generate slide specifications via Gemini 3
  5. Generate slide images via Gemini Imagen
  6. Assemble PDF using ReportLab
  7. Upload PDF + thumbnails to Supabase Storage
  8. Save to generated_slides table
  9. Return pdf_url, thumbnail_urls, slide_count
    ↓
Frontend: SlideDeckGenerator renders thumbnails, download button, share toggle
```

### Two Slide Styles

| Style | Slides | Content Depth | Use Case |
|-------|--------|---------------|----------|
| **Presenter** | 5-7 | Key points only, visual focus | Live presentations |
| **Detailed** | 8-12 | Comprehensive with citations | Share without narration |

### Slide Types

Each deck includes a mix of:
- **Title slide**: Claim headline with visual
- **Content slides**: Key concepts with supporting visuals
- **Evidence slides**: Paper citations with findings
- **Summary slide**: Key takeaways

### Key Files

| File | Purpose |
|------|---------|
| `src/bioelectricity_research/server.py` | `_generate_slide_deck_impl()`, `generate_slide_deck` MCP tool |
| `src/bioelectricity_research/http_server.py` | `/tools/generate_slide_deck/execute`, `/tools/get_user_slides/execute` |
| `frontend/components/deep-exploration/slides/slide-deck-generator.tsx` | Main component with style selector, progress, carousel |
| `frontend/components/deep-exploration/tabs/create-tab.tsx` | Integration point in Create tab |
| `frontend/lib/api.ts` | `generateSlideDeck()`, `getUserSlides()` API functions |
| `supabase/migrations/019_add_generated_slides.sql` | Database schema |
| `supabase/migrations/020_add_slides_storage.sql` | Storage bucket policies |

### Database Schema

```sql
CREATE TABLE generated_slides (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  claim_id text NOT NULL,
  episode_id text NOT NULL,
  style text NOT NULL CHECK (style IN ('presenter', 'detailed')),
  slide_count int NOT NULL,
  slide_specs jsonb NOT NULL,
  pdf_url text NOT NULL,
  thumbnail_urls text[],
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  generation_time_ms int,
  CONSTRAINT unique_user_claim_style UNIQUE (user_id, claim_id, style)
);
```

### Storage

- **Bucket:** `generated-slides` (private, in Supabase Storage)
- **Access:** Signed URLs for authenticated users
- **Path format:** `{safe_claim_id}/{style}_{file_id}.pdf`
- **Thumbnails:** `{safe_claim_id}/thumb_{style}_{idx}_{file_id}.png`

### Frontend Features

1. **Style Selector**: Visual cards showing slide count and use case
2. **Progress Indicator**: 4-stage animation (Planning → Content → Visuals → Assembly)
3. **Thumbnail Carousel**: Horizontal scroll with navigation arrows, click-to-expand
4. **Lightbox**: Full-size slide preview with keyboard navigation (←→, Esc)
5. **Share Toggle**: Inline switch to share with community
6. **Persistence**: Fetches existing slides on mount, stores in localStorage for anonymous users

### Configuration

- **Content model:** `gemini-3-pro-preview` for slide planning and text
- **Image model:** Gemini Imagen for slide visuals
- **PDF generation:** ReportLab with custom slide layouts
- **Requires:** `SUPABASE_SERVICE_KEY` env var for storage uploads

### Setup Required

1. Create `generated-slides` bucket in Supabase Dashboard
2. Set file size limit to 100MB
3. Allow MIME types: `application/pdf`, `image/png`
4. Run SQL migrations `019_add_generated_slides.sql` and `020_add_slides_storage.sql`

## Taxonomy Cluster System (Knowledge Cartography)

The taxonomy cluster system organizes the paper corpus into 8-12 labeled "research territories" using GMM clustering, enabling users to visualize their exploration coverage against the full research landscape.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Clustering Pipeline (scripts/build_taxonomy_clusters.py)    │
│ 1. Aggregate chunk embeddings → paper-level embeddings      │
│ 2. GMM clustering with BIC+silhouette for optimal k         │
│ 3. UMAP (or PCA fallback) for 2D positioning               │
│ 4. Gemini generates cluster labels from top papers          │
│ 5. Soft assignments: papers belong to multiple clusters     │
│ 6. Claims inherit assignments from linked papers            │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase Tables                                             │
│ - taxonomy_clusters: id, label, description, keywords, x/y  │
│ - paper_cluster_assignments: paper_id, cluster_id, conf     │
│ - claim_cluster_assignments: claim_id, cluster_id, conf     │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│ RPC Functions (Supabase SQL)                                │
│ - compare_episode_to_notebook() → NEW vs EXPLORED badges    │
│ - get_episode_claims_by_cluster() → Drill-down claims list  │
│ - get_notebook_cluster_distribution() → Bookmark analysis   │
│ - get_bookmark_cluster_mappings() → Badge display           │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend Components                                         │
│ - TaxonomyBubbleMap: Canvas-based cluster visualization     │
│ - EpisodeClusterExplorer: Expandable cluster cards          │
│ - ClusterDistributionBars: Notebook territory breakdown     │
│ - EpisodeClusterSummary: Quick coverage stats               │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/build_taxonomy_clusters.py` | GMM clustering pipeline |
| `supabase/migrations/008_add_taxonomy_clusters.sql` | Schema + RPC functions |
| `supabase/migrations/009_add_cluster_drill_down.sql` | Drill-down RPC functions |
| `frontend/components/taxonomy-bubble-map.tsx` | Visualization components |
| `frontend/components/episode-overview.tsx` | Cluster explorer integration |
| `frontend/components/notebook-view.tsx` | Cluster filtering integration |
| `frontend/lib/supabase.ts` | TypeScript types + query functions |

### Usage

```bash
# Run clustering pipeline (first time or after adding papers)
python scripts/build_taxonomy_clusters.py

# Dry run to preview without saving
python scripts/build_taxonomy_clusters.py --dry-run

# Force specific cluster count
python scripts/build_taxonomy_clusters.py --k 10
```

See `docs/TAXONOMY_CLUSTERS.md` for detailed implementation guide.

## Authentication & BYOK API Keys

The app uses a Bring Your Own Key (BYOK) model where users provide their own Gemini API key.

### Flow

```
User visits app
    ↓
Check localStorage for existing API key
    ↓
If no key → Redirect to /settings
    ↓
User enters Gemini API key in Settings page
    ↓
Key stored in localStorage (browser-side only)
    ↓
Key sent with each API request via header
    ↓
Backend uses user's key for Gemini calls

Magic Link Auth Flow:
    ↓
User clicks magic link in email
    ↓
Redirects to /auth/callback
    ↓
If first login → prompts for display name
    ↓
Saves to user_profiles table
    ↓
Redirects to original destination
```

### Key Components

| File | Purpose |
|------|---------|
| `frontend/app/settings/page.tsx` | Settings page with profile, API key, and account sections |
| `frontend/app/auth/callback/route.ts` | Magic link callback with welcome flow for new users |
| `frontend/components/api-key-modal.tsx` | Legacy modal (API key management moved to settings page) |
| `frontend/components/auth-modal.tsx` | Authentication UI (Supabase magic link auth) |
| `frontend/components/user-menu.tsx` | User dropdown linking to settings |
| `frontend/lib/supabase.ts` | Auth state management |

### Security Notes
- API keys are stored only in the user's browser (localStorage)
- Keys are sent via HTTP headers, not URL parameters
- Backend validates key format before use
- No server-side key storage

## Bookmarks & Notebooks System

Users can save and organize research items in personal notebooks.

### Bookmark Types

| Type | Description | Source |
|------|-------------|--------|
| `claim` | Evidence card from podcast | Listening view, Deep dive |
| `paper` | Academic paper reference | Evidence threads, RAG results |
| `snippet` | Text excerpt with highlight | Chat responses, papers |
| `ai_insight` | AI-generated analysis | Chat responses |
| `image` | AI-generated visualization | Image generation |

### Data Model

```sql
-- bookmarks table
id, user_id, bookmark_type, item_id, episode_id,
claim_id, content, metadata, created_at
```

### Key Components

| File | Purpose |
|------|---------|
| `frontend/components/bookmark-button.tsx` | Bookmark toggle button |
| `frontend/components/bookmarks-library.tsx` | Library view of all bookmarks |
| `frontend/components/notebook-view.tsx` | Single notebook with filtering |
| `frontend/components/notebook-synthesis-panel.tsx` | AI-generated notebook overview |
| `frontend/components/notebook-library.tsx` | List of user's notebooks |

### Notebook Synthesis

The system generates AI summaries of notebook contents:

```
User opens notebook
    ↓
Check notebook_synthesis table for cached summary
    ↓
If stale/missing → Call generate_notebook_synthesis endpoint
    ↓
Gemini analyzes all bookmarked items
    ↓
Returns: themes, key insights, suggested exploration
    ↓
Cache in notebook_synthesis table
```

## Mobile Components

The app is mobile-first with specialized components for small screens.

### Mobile-Specific Components

| Component | Purpose |
|-----------|---------|
| `mobile/claim-preview-sheet.tsx` | Bottom sheet for claim details |
| `mobile/past-claims-strip.tsx` | Horizontal scroll of recent claims |
| `mobile/compact-player.tsx` | Minimized audio player |
| `ui/bottom-sheet.tsx` | Reusable bottom sheet primitive |

### Responsive Behavior

```
Desktop (>1024px):
├── listening-view.tsx with side panels
├── Full taxonomy bubble map
└── Sheet-based AI chat sidebar

Mobile (<768px):
├── Stacked vertical layout
├── Bottom sheets for details
├── Compact player with swipe gestures
└── Past claims as horizontal strip
```

### Key Hooks

| Hook | Purpose |
|------|---------|
| `hooks/use-mobile.ts` | Detect mobile viewport |
| `components/ui/use-mobile.tsx` | Mobile breakpoint utilities |

## Quiz Mode

Interactive quizzes test understanding of podcast content.

### Features

- Multiple choice questions generated from claims
- Spaced repetition for review
- Progress tracking
- Explanations with paper citations

### Key Files

| File | Purpose |
|------|---------|
| `frontend/components/quiz-mode.tsx` | Quiz interface and logic |

### Quiz Generation Flow

```
User enters quiz mode
    ↓
Fetch claims from current episode
    ↓
Gemini generates questions from claims
    ↓
User answers questions
    ↓
Show explanation with evidence
    ↓
Track progress in user_interests table
```

## Knowledge Graph

The system extracts and visualizes entity-relation graphs from papers.

### Architecture

See `docs/KNOWLEDGE_GRAPH_ARCHITECTURE.md` for full details.

```
Papers corpus
    ↓
scripts/knowledge_graph/extract_kg_from_papers.py
    ↓
Entity extraction (concepts, mechanisms, organisms)
    ↓
Relation extraction (causes, enables, inhibits)
    ↓
scripts/knowledge_graph/deduplicate_entities.py
    ↓
data/knowledge_graph/*.json
    ↓
frontend/components/concept-graph/ConceptExpansionGraph.tsx
```

### Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/knowledge_graph/extract_kg_from_papers.py` | Extract entities/relations |
| `scripts/knowledge_graph/deduplicate_entities.py` | Merge duplicate entities |
| `scripts/knowledge_graph/validate_kg.py` | Validate graph consistency |
| `scripts/knowledge_graph/generate_claim_relevance.py` | Link claims to graph |

## Landing Pages

Multiple landing page variants for A/B testing.

### Variants

| File | Description |
|------|-------------|
| `frontend/components/landing-page.tsx` | Current production landing |
| `frontend/components/landing-page-v1.tsx` | Original design |
| `frontend/components/landing-page-v2.tsx` | Feature-focused variant |
| `frontend/components/landing-page-v3.tsx` | Minimalist variant |

### Routing

The main `frontend/app/page.tsx` renders the active landing page variant.

## Episode Library & Overview

### Episode Library

`frontend/components/episode-library.tsx` displays available episodes:
- Episode cards with thumbnails
- Preview vs full episode badges
- Lock icons for unreleased content
- Progress indicators

### Episode Overview

`frontend/components/episode-overview.tsx` shows episode details:
- AI-generated summary (narrative arc, themes, key moments)
- Taxonomy cluster coverage visualization
- Deep dive summaries and evidence threads (auto-fetched)
- Jump-to-claim functionality

## Design System

The frontend uses a warm, earthy color palette defined in CSS custom properties.

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Golden Chestnut | `#BE7C4D` | Primary accent, highlights, CTAs |
| Rosy Copper | `#BE5A38` | Secondary accent, active states |

### Evidence Type Colors

Used for badges and borders on evidence cards to indicate research significance:

| Type | Hex | CSS Variable | Meaning |
|------|-----|--------------|---------|
| Foundational | `#7A8B6E` | `--evidence-foundational` | Muted sage - bedrock research |
| Supporting | `#BE5A38` | `--evidence-supporting` | Rosy copper - builds on foundation |
| Direct Evidence | `#BE7C4D` | `--evidence-direct` | Golden chestnut - confirms claim |
| Speculative | `#8B8178` | `--evidence-speculative` | Warm stone - uncertain/exploratory |

### Color Files

- `frontend/app/globals.css` - Base theme variables
- `frontend/app/noeron.css` - Extended Noeron-specific styles including evidence colors

## Docs to read first

- `docs/LLM_CONTEXT.md`
- `docs/pipeline.md`
- `docs/TAXONOMY_CLUSTERS.md`
- `docs/KNOWLEDGE_GRAPH_ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
