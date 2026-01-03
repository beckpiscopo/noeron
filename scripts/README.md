# Scripts Guide

This folder mixes pipeline-critical scripts with one-off maintenance helpers. Use the sections
below to decide what to run in normal ingestion vs. ad-hoc fixes. For flags and exact usage,
run `python scripts/<script>.py --help`.

## Core pipeline (run in order when adding new papers)

1) `grobid_extract.py`  
   Convert cached PDFs in `data/pdfs/` into structured JSON in `data/grobid_fulltext/`.

2) `grobid_quality_check.py`  
   Audit GROBID outputs and write `data/grobid_quality_report.json`.

3) `prepare_texts.py`  
   Normalize `data/grobid_fulltext/` into clean JSON in `data/cleaned_papers/`.

4) `build_vector_store.py`  
   Chunk + embed everything in `data/cleaned_papers/` and persist `data/vectorstore/`.

## Core pipeline (transcripts)

Use these when adding new podcast/interview transcripts to the corpus:

- `fetch_assemblyai_transcript.py`  
  Main transcript ingestion from YouTube/URL into `data/cleaned_papers/`.
- `assemblyai_retrieve_transcript.py`  
  Re-fetches an existing AssemblyAI job by ID.
- `transcript_helpers.py`  
  Shared helpers; not invoked directly.
- `render_transcript_sentences.py`  
  Renders sentence-level views for inspection/debugging.
- `window_transcript_windows.py`  
  Builds windowed segments used by claim/context workflows.

## Claims + context cards pipeline

These scripts convert transcript windows into claims + RAG evidence.

- `context_card_builder.py`  
  Creates claim context cards for a single window.
- `run_context_card_builder_batch.py`  
  Batch runner over `data/window_segments.json`.
- `validate_context_card_registry.py`  
  Checks `data/context_card_registry.json` for consistency.
- `claim_distiller.py`  
  Distills raw claims into a normalized format.
- `enrich_claims_with_distillation.py`  
  Adds distillation output to cached claim files.
- `enrich_with_distillation_supabase.py`  
  Same enrichment but writing to Supabase.
- `run_verification_on_cache.py`  
  Runs the verification agent against cached claims.

## Vector store utilities

Use these to inspect or debug the corpus:

- `query_vector_store.py`  
  Quick vector store query runner.
- `inspect_vectorstore.py`  
  Dumps stats/metadata for the Chroma collection.
- `diagnose_corpus_gap.py`  
  Compares expected corpus vs. indexed content.
- `corpus_builder.py` / `corpus_builder_filtered.py`  
  Build/export corpus files; useful for inspections or ad-hoc exports.

## Paper ingestion helpers (one-offs or targeted runs)

These are usually run ad-hoc for collection growth or cleanup.

- `collect_papers.py`  
  Batch collection of papers into `data/papers_collection.json`.
- `scrape_levin_papers.py`  
  Project-specific scrape for Levin-related papers.
- `semantic_scholar_abstracts.py`  
  Backfills abstracts for stored papers.
- `fetch_citation_data.py`  
  Backfills citation metadata.
- `retry_grobid_failed.py`  
  Reprocesses PDFs that failed GROBID extraction.

## Timing alignment + claim maintenance (one-offs)

These scripts fix or maintain timing data in transcript/claim caches.

- `find_audio_offset.py` / `calibrate_audio_offset.py`  
  Locate offsets between transcript and audio.
- `fix_timing_with_words.py` / `fix_fallback_timing.py`  
  Repairs timing data using word-level info.
- `test_claim_timing.py`  
  Spot-check timing fixes.
- `enrich_claims_with_timing.py`  
  Adds timing to claim caches.
- `update_supabase_timing.py`  
  Pushes timing updates into Supabase.
- `populate_segment_claim_ids.py`  
  Ensures stable claim IDs per segment.
- `deduplicate_claims.py` / `dedupe_by_claim_text.py`  
  Removes duplicates in claim caches.
- `delete_specific_claims.py`  
  Removes known-bad claims by ID.
- `find_claim_segment.py`  
  Locates which segment a claim belongs to.

## Supabase utilities

- `supabase_client.py`  
  Shared helper (not typically invoked directly).
- `migrate_to_supabase.py`  
  One-time migration of local artifacts into Supabase.

## Project hygiene

- `add_work_log.py`  
  Appends a short entry to `docs/WORK_LOG.md`.

## Quick guidance

- If you're ingesting new papers: run the four-step core pipeline.
- If you're ingesting transcripts: run transcript ingestion, then build windows,
  then the claims/context card pipeline, then rebuild the vector store.
- If you are fixing data: use the one-off helpers in the timing/maintenance sections.
