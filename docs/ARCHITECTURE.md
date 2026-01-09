# Architecture Overview

This repo is a Python-based MCP server with a data pipeline that ingests papers and transcripts,
builds a vector store, and exposes tools via FastMCP + a small HTTP adapter. A separate Next.js
frontend consumes those tools.

## System map

Backend (Python):
- `src/bioelectricity_research/server.py` is the MCP tool surface and core orchestration.
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

The AI Chat is a RAG-powered research assistant that lets users ask questions about podcast episodes and claims. It uses the vector store to retrieve relevant context and Gemini to generate responses.

### Data Flow

```
User question
    ↓
useAIChat hook (manages state, conversation history)
    ↓
callMcpTool("chat_with_context", request)
    ↓
frontend/app/api/mcp/[tool]/route.ts (proxy)
    ↓
http_server.py → /tools/chat_with_context/execute
    ↓
┌─────────────────────────────────────────┐
│ 1. Load episode metadata                │
│ 2. Load claim context (if claim_id set) │
│ 3. RAG search via ChromaDB              │
│ 4. Format prompt with history + context │
│ 5. Call Gemini for response             │
│ 6. Return response + sources            │
└─────────────────────────────────────────┘
    ↓
ChatMessage renders response with ChatSources
```

### Component Structure

```
frontend/components/ai-chat/
├── index.ts              # Barrel exports
├── ai-chat-sidebar.tsx   # Main container (Sheet-based sidebar)
├── chat-message.tsx      # Individual message bubble
├── chat-input.tsx        # Auto-resizing textarea + send button
└── chat-sources.tsx      # Collapsible source citations

frontend/hooks/
└── use-ai-chat.ts        # State management for messages, loading, errors

frontend/lib/
└── chat-types.ts         # TypeScript interfaces
```

### Key Types (chat-types.ts)

- `ChatMessage`: User/assistant message with optional sources, loading state, errors
- `ChatContext`: Episode + optional claim context passed to the backend
- `ChatSource`: Paper reference returned by RAG (paper_id, title, year, snippet)
- `ChatWithContextRequest`: API request shape
- `ChatWithContextResponse`: API response with response text + sources

### Integration Points

The `AIChatSidebar` component is mounted in:
- `listening-view.tsx` - Podcast player view
- `deep-exploration-view.tsx` - Claim deep-dive view

Both views pass a `ChatContext` object with episode info and optionally the selected claim.

### Backend Endpoint

`POST /tools/chat_with_context/execute` in `http_server.py`:
1. Loads episode metadata from `_load_episodes()`
2. If `claim_id` provided, loads claim text for additional context
3. Queries ChromaDB with user message (enhanced with "bioelectricity Levin" for claim context)
4. Builds prompt using `CHAT_CONTEXT_PROMPT_TEMPLATE` with conversation history
5. Calls Gemini via `server._GENAI_CLIENT`
6. Returns `{ response, sources, query_used, model }`

### UI Component: Sheet-based Sidebar

Currently uses shadcn's `<Sheet>` component positioned on the right. Opens/closes via a `MessageSquare` icon button in the header.

## Docs to read first

- `docs/LLM_CONTEXT.md`
- `docs/pipeline.md`
- `scripts/README.md`
