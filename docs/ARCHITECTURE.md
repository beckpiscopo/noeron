# Architecture Overview

This repo is a Python-based MCP server with a data pipeline that ingests papers and transcripts,
builds a vector store, and exposes tools via FastMCP + a small HTTP adapter. A separate Next.js
frontend consumes those tools.

## System map

Backend (Python):
- `src/bioelectricity_research/server.py` is the MCP tool surface and core orchestration.
- `src/bioelectricity_research/context_builder.py` builds layered chat context (episode + temporal window + evidence cards).
- `src/bioelectricity_research/storage.py` handles paper metadata, PDF caching, and text extraction.
- `src/bioelectricity_research/vector_store.py` manages Chroma persistence and embeddings.
- `src/bioelectricity_research/http_server.py` exposes MCP tools as REST endpoints.

Pipeline (Python scripts):
- `scripts/grobid_extract.py` -> `data/grobid_fulltext/`
- `scripts/grobid_quality_check.py` -> `data/grobid_quality_report.json`
- `scripts/prepare_texts.py` -> in-memory or `data/cleaned_papers/`
- `scripts/build_vector_store.py` -> `data/vectorstore/`
- `scripts/fetch_assemblyai_transcript.py` -> `data/cleaned_papers/`
- `scripts/context_card_builder.py` + `scripts/run_context_card_builder_batch.py`

Frontend (Next.js):
- `frontend/app/` is the primary Next app
- `frontend/components/` is the main UI component set
- API proxy routes live in `frontend/app/api/`

## Data flow (high level)

1) Search + save papers via MCP tools (`save_paper`, `save_author_papers`)
2) PDFs cached in `data/pdfs/`
3) GROBID extracts -> `data/grobid_fulltext/`
4) Cleaned docs (in memory or `data/cleaned_papers/`)
5) Chunk + embed -> `data/vectorstore/`
6) MCP tools query the vector store (`rag_search`, claim context, etc.)

## Key runtime entrypoints

- MCP server: `uv run bioelectricity-research` -> `src/bioelectricity_research/__main__.py`
- HTTP adapter: `src/bioelectricity_research/http_server.py`
- Frontend dev: `cd frontend && pnpm dev`

## Configuration and secrets

- Environment variables are required for Gemini, AssemblyAI, and Supabase.
- The MCP server reads `os.environ` directly; it does not load `.env`.
- `scripts/context_card_builder.py` loads `.env` for local runs.

## AI Chat Feature Architecture

The AI Chat is a RAG-powered research assistant that lets users ask questions about podcast episodes and claims. It uses a **layered context system** that provides temporal awareness, evidence card integration, and RAG retrieval.

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

**Data Sources:**
- `data/episodes.json` - Episode metadata
- `data/window_segments.json` - Temporal windows with transcript excerpts
- `data/context_card_registry.json` - Evidence cards with paper matches

### Component Structure

```
src/bioelectricity_research/
├── context_builder.py    # NEW: Layered context system
├── server.py             # MCP tools (chat_with_context updated)
├── http_server.py        # REST adapter
├── vector_store.py       # ChromaDB wrapper
└── storage.py            # Paper metadata

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
# Test standalone context builder
cd /path/to/bioelectricity-research-mcp-v2
python3 -m src.bioelectricity_research.context_builder lex_325 48:00

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

## Docs to read first

- `docs/LLM_CONTEXT.md`
- `docs/pipeline.md`
- `scripts/README.md`
