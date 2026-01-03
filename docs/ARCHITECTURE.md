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

## Docs to read first

- `docs/LLM_CONTEXT.md`
- `docs/pipeline.md`
- `scripts/README.md`
