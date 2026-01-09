# LLM Context Pack

Use this document to minimize context. Read this first, then only open the files
listed under your task category.

## Read first (always)

- `docs/ARCHITECTURE.md`
- `docs/pipeline.md`
- `scripts/README.md`
- `README.md` (high-level overview only)

## Task-based file map

### MCP server / tool behavior

- `src/bioelectricity_research/server.py`
- `src/bioelectricity_research/http_server.py`
- `src/bioelectricity_research/__main__.py`

### Storage / PDF ingestion

- `src/bioelectricity_research/storage.py`
- `scripts/grobid_extract.py`
- `scripts/grobid_quality_check.py`

### Text prep / chunking / vector store

- `scripts/prepare_texts.py`
- `src/chunking_papers.py`
- `scripts/build_vector_store.py`
- `src/bioelectricity_research/vector_store.py` - Supports ChromaDB (local) and Supabase pgvector (cloud)

### Supabase / Database

- `scripts/supabase_client.py` - Database client with query methods
- `scripts/migrate_to_supabase_full.py` - Data migration from JSON/ChromaDB to Supabase
- `supabase/migrations/004_full_supabase_migration.sql` - SQL schema, pgvector, match_papers function

### Transcript ingestion

- `scripts/fetch_assemblyai_transcript.py`
- `scripts/assemblyai_retrieve_transcript.py`
- `scripts/transcript_helpers.py`

### Claims + context cards

- `scripts/context_card_builder.py`
- `scripts/run_context_card_builder_batch.py`
- `scripts/validate_context_card_registry.py`

### Episode summaries

- `scripts/generate_episode_summaries.py` - Generates narrative summaries using Gemini

### Frontend (Next.js)

- `frontend/app/`
- `frontend/components/`
- `frontend/app/api/`

### AI Chat Feature

**Backend (context building):**
- `src/bioelectricity_research/context_builder.py` - Layered context system (episode + temporal window + evidence cards)
- `src/bioelectricity_research/server.py` - `chat_with_context` MCP tool
- `src/bioelectricity_research/http_server.py` - `/tools/chat_with_context/execute` endpoint

**Frontend:**
- `frontend/components/ai-chat/ai-chat-sidebar.tsx` - Main chat container
- `frontend/components/ai-chat/chat-message.tsx` - Message bubble component
- `frontend/components/ai-chat/chat-input.tsx` - Input textarea + send
- `frontend/components/ai-chat/chat-sources.tsx` - Collapsible citations
- `frontend/hooks/use-ai-chat.ts` - State management hook (passes current_timestamp)
- `frontend/lib/chat-types.ts` - TypeScript interfaces (includes current_timestamp)

**Data sources for context (JSON mode, USE_SUPABASE=false):**
- `data/episodes.json` - Episode metadata (includes compact `summary` field)
- `data/episode_summaries.json` - Full structured summaries (narrative arc, themes, key moments)
- `data/window_segments.json` - Temporal windows with transcript
- `data/context_card_registry.json` - Evidence cards with paper matches

**Data sources for context (Supabase mode, USE_SUPABASE=true):**
- `episodes` table - Episode metadata with summaries
- `temporal_windows` table - Transcript windows
- `evidence_cards` table - Evidence cards with paper matches
- `paper_chunks` table - Vector embeddings via `match_papers()` function

## Current defaults and gotchas

- **Always use gemini-3-pro-preview as the LLM for this project.**
- MCP server reads `os.environ` only; `.env` is not auto-loaded.
- **`USE_SUPABASE=true` (default)** - Uses Supabase for context data and pgvector for RAG search. Set to `false` for local JSON/ChromaDB mode.
- `scripts/build_vector_store.py` runs `prepare_texts.process_all_papers()` in memory and
  appends any JSONs in `data/cleaned_papers/`.
- Avoid committing caches and generated artifacts (`.next`, `node_modules`, `data/vectorstore`).

## When you need more

- Pipeline deep dive: `docs/pipeline.md`
- Distilled claims: `docs/DISTILLED_CLAIMS_GUIDE.md`
- Supabase setup: `docs/SUPABASE_SETUP.md`

## End-of-task note

Add a brief entry to `docs/WORK_LOG.md` before ending a session.
