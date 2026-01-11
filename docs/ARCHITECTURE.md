# Architecture Overview

This repo is a Python-based MCP server with a data pipeline that ingests papers and transcripts,
builds a vector store, and exposes tools via FastMCP + a small HTTP adapter. A separate Next.js
frontend consumes those tools.

## System map

Backend (Python):
- `src/bioelectricity_research/server.py` is the MCP tool surface and core orchestration.
- `src/bioelectricity_research/context_builder.py` builds layered chat context (episode + temporal window + evidence cards).
- `src/bioelectricity_research/storage.py` handles paper metadata, PDF caching, and text extraction.
- `src/bioelectricity_research/vector_store.py` manages vector embeddings (supports both ChromaDB local and Supabase pgvector).
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
- `paper_chunks` - Text chunks with 384-dim pgvector embeddings
- `chat_sessions` / `chat_messages` - Chat persistence
- `user_interests` - User interest tracking
- `taxonomy_clusters` - Research territory definitions with labels, descriptions, 2D positions
- `paper_cluster_assignments` - Soft cluster assignments for papers (GMM probabilities)
- `claim_cluster_assignments` - Inherited cluster assignments for claims
- `bookmarks` - User-saved items (claims, papers, snippets, AI insights, images)
- `notebook_synthesis` - Cached AI-generated notebook overviews

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

### Backend Endpoint

`POST /tools/chat_with_context/execute` in `http_server.py`:

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

## Docs to read first

- `docs/LLM_CONTEXT.md`
- `docs/pipeline.md`
- `docs/TAXONOMY_CLUSTERS.md`
- `scripts/README.md`
