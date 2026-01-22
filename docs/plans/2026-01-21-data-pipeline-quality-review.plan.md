---
name: Data Pipeline Quality Review
overview: Summarize data pipeline strengths, risks, and a focused optimization plan for ingestion, cleaning, chunking, indexing, and claim/context generation.
todos:
  - id: meta-align
    content: Align GROBID metadata fields with cleaner expectations
    status: pending
  - id: vectorstore-selection
    content: Use vectorstore factory in build pipeline
    status: pending
    dependencies:
      - meta-align
  - id: schema-provenance
    content: Add schema version and source provenance fields
    status: pending
    dependencies:
      - meta-align
  - id: pipeline-config
    content: Add small pipeline config and defaults
    status: pending
    dependencies:
      - schema-provenance
  - id: validation-checks
    content: Add cleaned data and registry validation checks
    status: pending
    dependencies:
      - pipeline-config
  - id: batch-hardening
    content: Harden batch scripts with safer defaults and summaries
    status: pending
    dependencies:
      - validation-checks
  - id: cleanup-candidates
    content: Produce file cleanup and organization actions
    status: pending
    dependencies:
      - batch-hardening
---

# Data Pipeline Quality Review Plan

## Goals

- Document current pipeline strengths and risks.
- Define low-risk improvements that stabilize metadata and execution.
- Provide cleanup and organization guidance without deleting anything yet.

## Scope (Data Pipeline)

Primary files:
- `docs/pipeline.md`
- `scripts/grobid_extract.py`
- `scripts/prepare_texts.py`
- `scripts/build_vector_store.py`
- `src/chunking_papers.py`
- `src/bioelectricity_research/vector_store.py`
- `scripts/fetch_assemblyai_transcript.py`
- `scripts/window_transcript_windows.py`
- `scripts/context_card_builder.py`
- `scripts/run_context_card_builder_batch.py`
- `scripts/README.md`

## What Is Working Well

- Clear end-to-end pipeline documentation and a script guide that matches execution order.
- Pipeline stages are separated cleanly: ingestion, extraction, cleaning, chunking, indexing, and claim/context workflows.
- Chunking includes metadata and supports export for inspection.
- Vector store logic supports both local and Supabase backends.

## Key Risks / Gaps

- Metadata drift: the GROBID extractor writes `pdf_path` but the cleaner expects `source_pdf`, causing `source_path` to be empty downstream.
- Backend selection drift: build scripts always use `VectorStore()` and ignore `USE_SUPABASE`, even though a factory exists.
- Mixed schemas in `data/cleaned_papers/` make provenance and deduping brittle.
- Batch tools rely on hard-coded defaults (ex: transcript window input file), which can surprise or mis-route runs.
- Validation is ad hoc; many JSON artifacts are written without schema or version checks.

## Optimization Plan (Ordered, Low Risk)

1. **Metadata alignment**
   - Update GROBID output to include `source_pdf` or update the cleaner to accept both `pdf_path` and `source_pdf`.
   - Ensure `source_path` is always populated for downstream chunk metadata.

2. **Vector store selection**
   - Use `get_vectorstore()` in `scripts/build_vector_store.py`.
   - Keep consistent model selection (MiniLM vs Gemini) and document it.

3. **Schema and provenance**
   - Add `schema_version`, `source_type` (`paper` or `transcript`), and `ingested_at` to cleaned payloads.
   - Consider a manifest or split directories for papers vs transcripts.

4. **Config + reproducibility**
   - Add a minimal `pipeline_config.json` (paths, chunk size, overlap, backend).
   - Allow CLI overrides to keep scripts flexible.

5. **Validation and health checks**
   - Add `validate_cleaned_papers.py` for required fields and type checks.
   - Extend `validate_context_card_registry.py` to verify `rag_results` shape and `schema_version`.

6. **Batch hardening**
   - Require explicit `--input` for transcript windows (or fail with a clear message).
   - Add per-run summaries: counts of processed, skipped, and errors.

## Cleanup / Organization Candidates (No Deletions Yet)

Generated artifacts (should be gitignored or re-generated):
- `cache/*.json`
- `data/grobid_fulltext/*`
- `data/cleaned_papers/*`
- `data/vectorstore/*`
- `data/window_segments.json`
- `data/context_card_registry.json`
- `data/pdfs/*` (optional if re-download is acceptable)

Likely candidates to move under `scripts/maintenance/`:
- `scripts/investigate_claim_timestamps.py`
- `scripts/fix_*`
- `scripts/find_audio_offset.py`
- `scripts/calibrate_audio_offset.py`
- `scripts/test_claim_timing.py`
- `scripts/render_transcript_sentences.py`
- `scripts/corpus_builder*.py`
- `scripts/diagnose_corpus_gap.py`

## Definition of Done

- Metadata and vector store selection are consistent across pipeline stages.
- Cleaned artifacts contain versioned, provenance-aware fields.
- Batch scripts are safer to run and produce clear summaries.
- A documented cleanup list is ready for approval and execution.

