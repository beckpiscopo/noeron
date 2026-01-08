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
- `src/bioelectricity_research/vector_store.py`

### Transcript ingestion

- `scripts/fetch_assemblyai_transcript.py`
- `scripts/assemblyai_retrieve_transcript.py`
- `scripts/transcript_helpers.py`

### Claims + context cards

- `scripts/context_card_builder.py`
- `scripts/run_context_card_builder_batch.py`
- `scripts/validate_context_card_registry.py`

### Frontend (Next.js)

- `frontend/app/`
- `frontend/components/`
- `frontend/app/api/`

## Current defaults and gotchas

- **Always use gemini-3 as the LLM for this project.**
- MCP server reads `os.environ` only; `.env` is not auto-loaded.
- `scripts/build_vector_store.py` runs `prepare_texts.process_all_papers()` in memory and
  appends any JSONs in `data/cleaned_papers/`.
- Avoid committing caches and generated artifacts (`.next`, `node_modules`, `data/vectorstore`).

## When you need more

- Pipeline deep dive: `docs/pipeline.md`
- Distilled claims: `docs/DISTILLED_CLAIMS_GUIDE.md`
- Supabase setup: `docs/SUPABASE_SETUP.md`

## End-of-task note

Add a brief entry to `docs/WORK_LOG.md` before ending a session.
