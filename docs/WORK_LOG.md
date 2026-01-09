# Work Log

Short, task-focused notes to help the next session pick up quickly.

---

## 2026-01-03: Knowledge Graph Extraction Pipeline

**Task:** Build KG extraction from scientific papers using Gemini, integrate into deep dive view

**Summary:**
- Created `scripts/knowledge_graph/` module with 3 scripts:
  - `extract_kg_from_papers.py` - Main extraction using Gemini 3 Pro
  - `deduplicate_entities.py` - Entity canonicalization with bioelectricity synonyms
  - `validate_kg.py` - Validation and inspection CLI
- Added `get_relevant_kg_subgraph` MCP tool to server.py and http_server.py
- Replaced "Related Concepts" carousel in deep-exploration-view.tsx with Knowledge Graph section
- Processed all 84 papers in corpus

**Final KG Stats:**
- 687 nodes, 1117 edges
- 875 cross-paper connections
- Top entities: Membrane potential (87 connections), Left-Right Patterning (75), Bioelectricity (66)

**Key Files:**
```
scripts/knowledge_graph/
├── __init__.py
├── extract_kg_from_papers.py    # Gemini extraction, caching
├── deduplicate_entities.py       # BIOELECTRICITY_SYNONYMS dict
└── validate_kg.py                # CLI validation

data/knowledge_graph/
├── knowledge_graph.json          # Merged graph
└── raw_extractions/              # Per-paper cache (84 files)

src/bioelectricity_research/
├── server.py                     # Added get_relevant_kg_subgraph MCP tool
└── http_server.py                # Added /tools/get_relevant_kg_subgraph/execute route

frontend/components/
└── deep-exploration-view.tsx     # Replaced Related Concepts with KG section
```

**Decisions/Gotchas:**
- Model: `gemini-3-pro-preview` (not gemini-2.5)
- http_server.py has explicit routes per tool (not auto-discovered) - must add route for new tools
- Extraction takes ~40s per paper due to Gemini thinking mode
- One stall at paper #16 required restart; caching prevented re-processing

**Usage:**
```bash
# Extract from all papers (cached results skipped)
python3 scripts/knowledge_graph/extract_kg_from_papers.py --all

# Validate the graph
python3 scripts/knowledge_graph/validate_kg.py --graph data/knowledge_graph/knowledge_graph.json

# Inspect relationships
python3 scripts/knowledge_graph/validate_kg.py --graph data/knowledge_graph/knowledge_graph.json --inspect --entity "membrane_potential"

# Deduplicate (if needed)
python3 scripts/knowledge_graph/deduplicate_entities.py data/knowledge_graph/knowledge_graph.json
```

**Next Steps:**
- Add more synonyms to BIOELECTRICITY_SYNONYMS as duplicates are discovered
- Consider force-directed graph visualization in frontend
- Could add confidence thresholding in subgraph retrieval
- Run deduplication pass to merge Kir4.1 variants

---

## 2026-01-04: Style-Specific Deep Dive Summaries (Simplified/Technical Tabs)

**Task:** Implement tab-specific prompts for deep dive summaries with separate caching per style

**Summary:**
- Backend already had `DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL` and `DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED` with a `style` parameter on `generate_deep_dive_summary` tool
- Cache key format changed from `episode:claim_id` to `episode:claim_id:style`
- Updated frontend `DeepExplorationView` to track state per style:
  - `deepDiveSummaries[synthesisMode]` - cached summaries per tab
  - `isLoadingDeepDive[synthesisMode]` - loading state per tab
  - `deepDiveErrors[synthesisMode]` - error state per tab
- Replaced dual-mode rendering (old "technical" showing raw synthesis + "ai_summary" showing deep dive) with unified renderer using per-style state
- Migrated 10 existing cache entries to include `:technical` suffix

**Key Files:**
```
src/bioelectricity_research/server.py
├── DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL  # Detailed, mechanistic output
├── DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED # Accessible, plain-language output
└── generate_deep_dive_summary()         # style param, cache key with :style

frontend/components/deep-exploration-view.tsx
├── State: deepDiveSummaries, isLoadingDeepDive, deepDiveErrors (per style)
├── Tabs: "Simplified" / "Technical" (was "AI Summary" / "Technical")
└── Unified rendering block using deepDiveSummaries[synthesisMode]

cache/deep_dive_summaries.json
└── Keys now: "lex_325:claim_id:technical" or "lex_325:claim_id:simplified"
```

**Decisions/Gotchas:**
- Removed the old "technical" view that showed raw claim/synthesis data - now both tabs show AI-generated summaries
- Existing cache entries were all generated with technical prompt, so migrated with `:technical` suffix
- Simplified summaries will generate on-demand when users first click that tab

**Next Steps:**
- Consider pre-generating simplified summaries for popular claims
- Could add a toggle to show the raw claim context alongside the AI summary

---

## 2026-01-06: YouTube Transcript Ingestion + Vector Store Separation Issue

**Task:** Download and transcribe YouTube video via AssemblyAI, document vector store limitations

**Summary:**
- Downloaded Michael Levin interview from YouTube (`c8iFtaltX-s`) using existing `fetch_assemblyai_transcript.py` pipeline
- AssemblyAI transcription succeeded (transcript ID: `42cfcca9-9bfd-41aa-b0a4-5079c2754ab8`)
- Moved transcript to `data/transcripts/` to prevent inclusion in RAG searches

**Files Created:**
```
data/podcasts/raw/c8iFtaltX-s.webm              # Downloaded video (118MB)
data/transcripts/levin-consciousness-biology-emergence.json  # Cleaned transcript
data/cleaned_papers/42cfcca9-9bfd-41aa-b0a4-5079c2754ab8.raw.json  # Raw AssemblyAI response
```

**Known Issue: No Document Type Filtering in Vector Store**

The current vector store has no way to distinguish between peer-reviewed papers and podcast transcripts:
- `build_vector_store.py` merges all JSONs from `data/cleaned_papers/` with GROBID-extracted papers
- `vector_store.py` stores no `doc_type` metadata field
- `rag_search()` in `server.py` has no filtering capability
- Chroma supports `where` filters, but the schema doesn't include document type

**Workaround (current):** Keep transcripts in `data/transcripts/` instead of `data/cleaned_papers/`

**Proper Fix (future):**
1. Add `doc_type` field to `_build_metadata()` in `vector_store.py`
2. Add `where={"doc_type": "paper"}` filter option to `search()` method
3. Add `doc_type` parameter to `rag_search()` MCP tool in `server.py`
4. Update `build_vector_store.py` to tag sources appropriately

**Decisions/Gotchas:**
- `yt-dlp` requires JS runtime warning but still works
- Long transcripts can timeout during AssemblyAI polling; use `assemblyai_retrieve_transcript.py` with the transcript ID to recover
- Speaker diarization assumes "Michael Levin" is the speaker with longest average utterances

**Next Steps:**
- Implement `doc_type` filtering when unified search across papers + transcripts is needed
- Consider separate Chroma collection for transcripts as alternative approach

---

## 2026-01-06: Claim → Entity Relationship Explainability (#7)

**Task:** Add claim-specific relevance explanations to knowledge graph entities so users understand WHY each entity is relevant to a particular claim.

**Summary:**
- Created batch script to pre-compute claim-entity relevance using Gemini 3
- Each entity gets a `relevance_to_claim` explanation and `claim_role` category
- Backend injects pre-computed relevance into `get_relevant_kg_subgraph` response
- Frontend displays "Why relevant" section in node panel with role badges
- Added parallel processing (5 concurrent) to speed up batch generation ~3-4x

**Claim Roles:**
- `claim_concept` - Entity directly mentioned in the claim
- `experimental_technique` - Methods/tools used in supporting studies
- `mechanism` - Underlying molecular/cellular process
- `supporting_context` - Background context from papers

**Key Files:**
```
scripts/knowledge_graph/
└── generate_claim_relevance.py    # Batch generation with parallel processing

data/knowledge_graph/
└── claim_entity_relevance.json    # Pre-computed relevance cache (152/411 claims)

src/bioelectricity_research/server.py
├── CLAIM_RELEVANCE_CACHE_PATH     # Path constant
├── _load_claim_relevance_cache()  # Cache loader
└── get_relevant_kg_subgraph()     # Injects relevance_to_claim, claim_role

frontend/components/concept-graph/
├── types/graph-types.ts           # Added ClaimRole type, relevanceToClaim fields
├── ConceptExpansionGraph.tsx      # Updated panel UI with "Why relevant" section
└── utils/vis-config.ts            # Updated tooltips to show relevance
```

**Usage:**
```bash
# Generate relevance for all claims (parallel, resumes from cache)
python3 scripts/knowledge_graph/generate_claim_relevance.py --all --concurrency 5

# Generate for specific claims
python3 scripts/knowledge_graph/generate_claim_relevance.py --claim-ids "lex_325|00:00:00-0"

# Force re-generate
python3 scripts/knowledge_graph/generate_claim_relevance.py --all --force
```

**Decisions/Gotchas:**
- Pre-computed batch approach (not runtime) to avoid latency
- Gemini 3 is slow (~40-70s per claim); parallel processing essential
- Cache saves after each batch of 5, safe to interrupt and resume
- 152/411 claims processed so far, ~1.5 hours remaining

**Next Steps:**
- Complete batch generation for remaining ~260 claims
- Consider increasing concurrency if API limits allow
- Could add visual distinction (border colors) based on claim_role

---

## 2026-01-07: Fix Missing Relevance Data in HTTP Server Route

**Task:** Debug why knowledge graph nodes don't show research connections in frontend

**Summary:**
- Investigated why `relevance_to_claim` and `claim_role` were returning `None` in API responses
- Root cause: `http_server.py` route was a duplicate implementation that skipped Step 6 (relevance injection)
- The MCP tool in `server.py` had the correct code, but `http_server.py` was missing it
- Added `_load_claim_relevance_cache` import and Step 6 relevance injection to `http_server.py:827-840`

**Files Changed:**
```
src/bioelectricity_research/http_server.py
├── Line 739: Added _load_claim_relevance_cache to imports
└── Lines 827-840: Added Step 6 relevance injection block
```

**Decisions/Gotchas:**
- HTTP server needs restart for changes to take effect
- 152/361 claims have pre-computed relevance (~42% coverage)
- Claims without cached relevance will show `relevance_to_claim: null`

**Next Steps:**
- Restart HTTP server to apply fix
- Continue generating relevance for remaining ~210 claims
- Consider adding fallback that generates relevance on-demand for uncached claims

---

## 2026-01-09: Timestamp-Aware Chat Context Builder

**Task:** Implement layered context system for AI chat that provides episode awareness and temporal synchronization

**Summary:**
- Created `src/bioelectricity_research/context_builder.py` with 4-layer context system:
  - Layer 1: Episode metadata (title, guest, topics, description)
  - Layer 2: Temporal window (3-min transcript excerpt at current playback position)
  - Layer 3: Evidence cards (papers shown in last 5 minutes from context_card_registry)
  - Layer 4: RAG retrieval (query-triggered, integrated with existing ChromaDB)
- Updated `chat_with_context` tool in `server.py` to use context builder when `use_layered_context=true` (default)
- Added `current_timestamp` parameter to chat API and frontend types
- Frontend now passes `formatTime(episode.currentTime)` to chat context
- Chat sidebar displays timestamp in context badge (e.g., "Episode Title @ 48:00")
- Sources now include both RAG results and evidence cards with timestamps

**Key Files:**
```
src/bioelectricity_research/
├── context_builder.py    # NEW: Layered context system
└── server.py             # Updated chat_with_context tool

frontend/
├── lib/chat-types.ts     # Added current_timestamp to ChatContext
├── hooks/use-ai-chat.ts  # Passes current_timestamp to API
├── components/listening-view.tsx       # Passes formatTime(episode.currentTime)
└── components/ai-chat/ai-chat-sidebar.tsx  # Shows timestamp in context badge
```

**Data Classes in context_builder.py:**
- `EpisodeContext` - Episode metadata
- `TemporalWindow` - Current position with transcript excerpt
- `EvidenceCard` - Paper-backed claim with timestamp
- `ActiveEvidenceCards` - Cards in time range
- `ChatContextLayers` - Complete context for chat

**Testing:**
```bash
python3 -m src.bioelectricity_research.context_builder lex_325 48:00
```

**Decisions/Gotchas:**
- Context builder loads from JSON files (episodes.json, window_segments.json, context_card_registry.json) not Supabase
- Evidence cards lookback is 5 minutes (configurable via EVIDENCE_CARD_LOOKBACK_MS)
- Temporal window is ~3 minutes centered on current position
- Legacy mode (`use_layered_context=false`) preserved for backward compatibility
- Response includes `context_metadata` with temporal window info and evidence card count

**Next Steps:**
- ~~Add episode-level narrative summaries~~ (completed 2026-01-09)
- ~~Create `scripts/generate_episode_summaries.py` to pre-generate summaries with Gemini~~ (completed 2026-01-09)
- Consider migrating temporal windows to Supabase for better query performance
- Add timestamp-aware RAG boosting (boost papers from recent evidence cards)

---

## 2026-01-09: Episode-Level Narrative Summaries

**Task:** Add episode-level narrative awareness to the chat so it can explain "what this episode is about" and connect current discussion to the broader conversation arc.

**Summary:**
- Created `scripts/generate_episode_summaries.py` that uses Gemini to generate structured summaries from full transcripts
- Summary structure includes: narrative arc (3-5 paragraphs), major themes with timestamps, key moments, guest thesis, conversation dynamics
- Full structured summaries stored in `data/episode_summaries.json`
- Compact summaries (for chat context) stored in `episodes.json` under `summary` field
- **Fixed critical bug:** `http_server.py` had its own chat implementation that bypassed `context_builder.py` entirely, so the summaries weren't being used. Updated to use the layered context builder.
- Generated summaries for `lex_325` and `theories_of_everything` episodes

**Key Files:**
```
scripts/generate_episode_summaries.py     # NEW: Gemini-based summary generation
data/episode_summaries.json               # NEW: Full structured summaries
data/episodes.json                        # UPDATED: Added summary field

src/bioelectricity_research/http_server.py  # FIXED: Now uses context_builder
src/bioelectricity_research/context_builder.py  # Already had episode_summary support
```

**Usage:**
```bash
# Generate for specific episode
python3 scripts/generate_episode_summaries.py lex_325

# Generate for all episodes with transcripts
python3 scripts/generate_episode_summaries.py --all

# Print existing summary
python3 scripts/generate_episode_summaries.py lex_325 --print-only

# Regenerate even if exists
python3 scripts/generate_episode_summaries.py lex_325 --force
```

**Decisions/Gotchas:**
- Uses `gemini-2.0-flash` for cost efficiency on long transcripts (not gemini-3-pro-preview)
- HTTP server requires restart to pick up new summaries (reads from disk each request, but imports are cached)
- Summary compact format uses ~7000 characters to stay within token budget
- Episodes without transcripts (mlst, essentia_foundation) will need transcripts before summaries can be generated

**Next Steps:**
- Generate summaries for remaining episodes when transcripts are added
- Consider caching the system prompt to reduce per-request overhead
- Add "suggest related moments" feature using key_moments timestamps

---

## 2026-01-09: Full Supabase Migration with pgvector

**Task:** Migrate from local JSON files + ChromaDB to Supabase with pgvector for production deployment

**Summary:**
- Created SQL migration `supabase/migrations/004_full_supabase_migration.sql` with:
  - pgvector extension enabled
  - 8 tables: episodes (enhanced), temporal_windows, evidence_cards, papers (enhanced), paper_chunks, chat_sessions, chat_messages, user_interests
  - `match_papers(query_embedding, threshold, count)` function for vector similarity search
  - `match_papers_with_filters()` for filtered search (year range, sections)
  - Helper functions: `get_temporal_window()`, `get_evidence_cards_in_range()`
  - IVFFlat index on embeddings for fast approximate nearest neighbor search
- Created Python migration script `scripts/migrate_to_supabase_full.py` with:
  - Batch migration for all data sources (episodes, temporal_windows, evidence_cards, papers, paper_chunks)
  - Embedding generation using sentence-transformers/all-MiniLM-L6-v2
  - Error handling for Unicode null characters, duplicate keys, foreign key violations
- Updated `scripts/supabase_client.py` with 20+ new query methods
- Updated `src/bioelectricity_research/context_builder.py` with dual-mode loaders (JSON + Supabase)
- Updated `src/bioelectricity_research/vector_store.py` with `SupabaseVectorStore` class

**Data Migrated:**
- 4 episodes with summaries and narrative metadata
- 161 temporal windows (3-minute transcript segments)
- 96 evidence cards with paper-backed claims
- 387 papers with metadata
- 2,287 paper chunks with 384-dim embeddings

**Key Files:**
```
supabase/migrations/004_full_supabase_migration.sql  # NEW: SQL schema + functions
scripts/migrate_to_supabase_full.py                   # NEW: Data migration script
scripts/supabase_client.py                            # MODIFIED: Added query methods
src/bioelectricity_research/context_builder.py        # MODIFIED: Dual-mode loaders
src/bioelectricity_research/vector_store.py           # MODIFIED: SupabaseVectorStore class
```

**Usage:**
```bash
# Run with Supabase backend (production)
export USE_SUPABASE=true
python3 -m src.bioelectricity_research.http_server

# Run with local JSON/ChromaDB (development)
export USE_SUPABASE=false
python3 -m src.bioelectricity_research.http_server

# Run migration (if needed)
python3 scripts/migrate_to_supabase_full.py --all
```

**Decisions/Gotchas:**
- `USE_SUPABASE` env var controls backend selection (default: true)
- Falls back to JSON/ChromaDB on Supabase connection errors
- JSONL files (chunks.json) are newline-delimited JSON, not JSON arrays
- Evidence cards required deduplication before insert (duplicate compound keys)
- Paper text fields needed sanitization to remove Unicode null characters (`\x00`)
- Some paper_chunks had missing paper_ids; script skips chunks without valid foreign keys
- pgvector uses cosine distance (`<=>` operator), converted to similarity (1 - distance)

**Next Steps:**
- Add chat session persistence to frontend
- Consider adding real-time subscriptions for collaborative features
- Add RLS policies when multi-user support is needed

---

## 2026-01-09: Semantic Claim Deduplication Tool

**Task:** Build a tool to identify and resolve duplicate claims caused by multiple transcription passes during development

**Summary:**
- Created `scripts/semantic_dedupe_claims.py` - CLI tool for semantic deduplication using embeddings
- Uses `sentence-transformers/all-MiniLM-L6-v2` (same 384-dim model as vector store) for claim similarity
- Detects duplicates based on cosine similarity threshold + temporal proximity window
- Supports interactive CLI selection or auto-resolve mode
- Implements soft delete via `duplicate_of` column (preserves data lineage)
- Created SQL migration `supabase/migrations/005_add_duplicate_of.sql`

**Deduplication Results (lex_325):**
- Pass 1: ≥0.95 similarity, 30s window → 35 duplicates removed
- Pass 2: ≥0.90 similarity, 30s window → 27 duplicates removed
- Total: 62 duplicates removed (370 → 308 active claims, 17% reduction)

**Key Files:**
```
scripts/semantic_dedupe_claims.py           # NEW: Semantic deduplication CLI
supabase/migrations/005_add_duplicate_of.sql # NEW: Add duplicate_of column
```

**Usage:**
```bash
# Detection only - see how many duplicates exist
python3 scripts/semantic_dedupe_claims.py --episode lex_325 --detect-only

# Auto-resolve with specific thresholds
python3 scripts/semantic_dedupe_claims.py --episode lex_325 \
    --similarity-threshold 0.95 --temporal-window 30000 --auto --execute

# Interactive selection (dry run)
python3 scripts/semantic_dedupe_claims.py --episode lex_325

# Query active claims only
SELECT * FROM active_claims;  -- or WHERE duplicate_of IS NULL
```

**Decisions/Gotchas:**
- 0.80 threshold catches semantically related but different quotes; 0.90+ catches true transcription duplicates
- 30-second temporal window is sufficient for same-moment duplicates; 3-minute window catches rephrased claims
- Quality scoring prefers: has distilled_claim (+1000), longer text, has paper match (+50), higher confidence
- Soft delete preserves all data; `duplicate_of` points to the kept claim ID

**Next Steps:**
- Run on other episodes if they have similar duplicate issues
- Could add `--exclude-duplicates` flag to other scripts that query claims

---

Template:

Date:
Task:
Summary:
-
Decisions/Gotchas:
-
Next Steps:
- 
