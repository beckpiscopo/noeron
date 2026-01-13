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

## 2026-01-10: Fix NULL start_ms and Incorrect Episode Duration

**Task:** Diagnose and fix claims showing up at 0:00 and missing claims in timeline visualization

**Summary:**
- Investigated claim timestamp issues: 36 claims had NULL `start_ms`, latest claim at 180 min vs expected 222 min
- **Root Cause 1:** Bug in `scripts/migrate_to_supabase.py` - fallback logic set `timestamp` string but not `start_ms` when timing data was missing
- **Root Cause 2:** Episode metadata had wrong duration ("3h 42m" vs actual "3h 0m")
- Fixed migration script to parse segment timestamp as fallback for `start_ms`
- Created `scripts/fix_null_start_ms.py` to backfill the 36 NULL values
- Corrected episode duration in both Supabase (`duration_ms: 10812500`) and local JSON

**Key Files:**
```
scripts/migrate_to_supabase.py      # FIXED: Added timestamp_to_ms() fallback
scripts/fix_null_start_ms.py        # NEW: Backfill script for NULL start_ms
data/episodes.json                  # FIXED: duration "3h 42m" → "3h 0m"
```

**Decisions/Gotchas:**
- The `claims` table gets `start_ms` from timing enrichment (`enrich_claims_with_timing.py`), not directly from migration
- When timing enrichment fails to match a claim, `start_ms` was left NULL instead of using segment timestamp
- Episode duration discrepancy: actual podcast is ~180 min, metadata incorrectly said 222 min
- AssemblyAI transcript confirmed episode ends at 180.2 min (10812500 ms)

**Next Steps:**
- Monitor for similar issues in other episodes
- Consider adding validation to migration script to catch NULL `start_ms` values

---

## 2026-01-10: Notebooks System (Replaces Bookmarks Library)

**Task:** Replace flat bookmarks library with episode-centric notebooks. Each episode becomes a personal research notebook with saved claims, papers, AI insights, images, and snippets.

**Summary:**
- Replaced `bookmarks-library.tsx` with two new components:
  - `notebook-library.tsx` - Grid of episodes that have saved items
  - `notebook-view.tsx` - Two-tab interface (Overview + Saved Items)
- Added new bookmark types: `ai_insight` and `image` (in addition to existing `claim`, `paper`, `snippet`)
- Created AI synthesis feature:
  - `notebook-synthesis-panel.tsx` - Displays Gemini-generated insights about saved items
  - Backend endpoint `/tools/generate_notebook_synthesis/execute` - Generates synthesis with themes
  - `notebook_synthesis` table - Caches synthesis with auto-invalidation when bookmarks change
- Updated bookmarks hook with episode-scoped methods

**Key Files:**
```
supabase/migrations/007_add_notebook_types_and_synthesis.sql  # NEW: Schema changes
├── Expanded bookmark_type to include 'ai_insight', 'image'
├── Added insight_source, image_url, image_caption columns
├── Created notebook_synthesis table (caches AI overviews)
├── Created episode_notebook_stats view (counts per episode)
├── Triggers to auto-invalidate synthesis when bookmarks change

frontend/components/
├── notebook-library.tsx          # NEW: Episode grid showing notebooks
├── notebook-view.tsx             # NEW: Two-tab interface (Overview + Saved Items)
├── notebook-synthesis-panel.tsx  # NEW: AI synthesis display + generation
└── bookmarks-library.tsx         # ORPHANED: Can be deleted

frontend/lib/supabase.ts
├── BookmarkType expanded: 'claim' | 'paper' | 'snippet' | 'ai_insight' | 'image'
├── NotebookSynthesis interface
├── getBookmarksForEpisode(), getEpisodesWithBookmarks()
├── getNotebookSynthesis(), saveNotebookSynthesis()

frontend/hooks/use-bookmarks.tsx
├── addAiInsightBookmark(), addImageBookmark()
├── getBookmarksForEpisode(), getEpisodeBookmarkCounts()

frontend/app/page.tsx
├── View states: added "notebook-library", "notebook"
├── Navigation: bookmarks button → notebook library
├── Added selectedNotebookEpisodeId state

src/bioelectricity_research/http_server.py
└── /tools/generate_notebook_synthesis/execute  # NEW endpoint
```

**Notebook View - Overview Tab:**
- Statistics cards (total items, last updated, quiz ready, item types)
- Item breakdown bar chart (horizontal, color-coded by type)
- AI Synthesis panel (on-demand generation, cached in Supabase)
- Cross-episode connections section (stubbed for v1)
- Action buttons: Export (disabled), Start Quiz

**Notebook View - Saved Items Tab:**
- Filter tabs: All | Claims | Papers | AI Insights | Images | Snippets
- Sort dropdown: Timestamp | Type | Date Added
- Card grid with type-specific styling
- Edit notes, delete actions per card

**AI Synthesis Prompt:**
- Analyzes all saved items for an episode
- Identifies 2-4 themes with descriptions
- Returns JSON: `{ synthesis: string, themes: [{name, description}] }`
- Cached in `notebook_synthesis` table, marked stale when bookmarks change

**Database Migration Notes:**
- Separate INSERT/DELETE triggers (can't reference NEW in DELETE trigger WHEN clause)
- DROP VIEW before CREATE VIEW (can't change column names with CREATE OR REPLACE)
- Run cleanup SQL first if partial migration ran:
  ```sql
  DROP TRIGGER IF EXISTS trigger_invalidate_synthesis_insert ON bookmarks;
  DROP TRIGGER IF EXISTS trigger_invalidate_synthesis_delete ON bookmarks;
  DROP FUNCTION IF EXISTS invalidate_notebook_synthesis() CASCADE;
  DROP VIEW IF EXISTS bookmark_stats;
  DROP VIEW IF EXISTS episode_notebook_stats;
  ```

**Decisions/Gotchas:**
- Episode association: bookmarks already had `episode_id` field, used for grouping
- Synthesis is on-demand (not auto-generated) with manual "Regenerate" button
- Cross-episode connections stubbed with placeholder UI for v1
- Old `bookmarks-library.tsx` is orphaned but not deleted (can reference for styling)
- Navigation changed: bookmark button in header → notebook library → individual notebook

**Next Steps:**
- Run migration: `supabase/migrations/007_add_notebook_types_and_synthesis.sql`
- Delete orphaned `bookmarks-library.tsx` if not needed
- Implement cross-episode connections (find shared papers/topics across notebooks)
- Add "Save to Notebook" button to AI chat responses
- Consider image capture/screenshot save functionality

---

## 2026-01-10: Episode Overview UI + Concept Density Keywords

**Task:** Add navbar and AI chat to episode overview page, make chat resizable, add keyword tooltips to concept density graph

**Summary:**
- Added `NoeronHeader` and `AIChatSidebar` to `episode-overview.tsx` (matching listening-view.tsx)
- Unified navbar font to "Russo One" across all pages (landing, listening, overview)
- Made AI chat sidebar resizable:
  - Added drag handle on left edge
  - Min width 320px, max 700px, default 440px
  - `onWidthChange` callback so parent components can adjust margins
- Made suggested chat prompts context-aware:
  - Episode prompts (no claim selected): "What are the main topics?", "Summarize key claims", etc.
  - Claim prompts (when claim in context): "Explain this in simpler terms", "What evidence supports this?", etc.
- Added keywords to concept density graph hover tooltips:
  - Created `supabase/migrations/006_add_keywords_to_claims.sql` (TEXT[] column + GIN index)
  - Created `scripts/generate_claim_keywords.py` using Gemini 2.0 Flash
  - Updated `computeClaimDensity` to aggregate top 3 keywords per time bucket
  - Updated hover tooltip to display keyword pills
  - Generated keywords for 365 claims in lex_325 episode

**Key Files:**
```
supabase/migrations/006_add_keywords_to_claims.sql  # NEW: Keywords column
scripts/generate_claim_keywords.py                   # NEW: Gemini keyword extraction

frontend/components/
├── episode-overview.tsx        # Added NoeronHeader, AIChatSidebar, chatWidth state
├── noeron-header.tsx           # Changed font to Russo One
├── ai-chat/ai-chat-sidebar.tsx # Added resize handle, context-aware prompts
└── listening-view.tsx          # Added chatWidth state, onWidthChange prop

frontend/app/page.tsx
├── ClaimDensityPoint interface  # Added keywords field
├── computeClaimDensity()        # Aggregates keywords per bucket
└── convertSupabaseClaim()       # Fixed: now maps keywords field

frontend/lib/supabase.ts
└── Claim interface              # Added keywords field
```

**Usage:**
```bash
# Generate keywords for all claims (or specific episode)
cd /path/to/project
source .venv/bin/activate
python scripts/generate_claim_keywords.py
python scripts/generate_claim_keywords.py --episode lex_325 --dry-run
```

**Decisions/Gotchas:**
- Resize disables CSS transition during drag for smooth feedback
- Keywords are extracted in batches of 50 claims per Gemini request for efficiency
- `convertSupabaseClaim` was missing `keywords` field - this caused keywords to not appear even after DB update
- google.generativeai package shows deprecation warning but still works

**Next Steps:**
- Generate keywords for other episodes when claims are added
- Consider adding keyword search/filtering capability
- Could highlight keywords that match user's chat query

---

## 2026-01-11: Taxonomy Layer - Knowledge Cartography

**Task:** Build a clustering layer that organizes the paper corpus into 8-12 labeled concept territories, enabling users to visualize their exploration coverage against the full research landscape.

**Summary:**
- Created GMM-based clustering pipeline that assigns papers to multiple clusters with confidence scores (soft assignment)
- Uses UMAP (or PCA fallback) for 2D spatial positioning to create bubble map visualization
- Gemini auto-generates descriptive labels for each cluster based on top papers
- Claims inherit cluster assignments from their linked papers
- Frontend shows "Research Territories" in notebook view and episode overview
- Comparison feature shows "This episode covers X, Y, Z - you've touched X but not Y, Z"

**Key Files:**
```
supabase/migrations/008_add_taxonomy_clusters.sql  # NEW: Schema + RPC functions
├── taxonomy_clusters table (label, description, keywords, position_x/y, centroid_embedding)
├── paper_cluster_assignments table (soft assignments with confidence scores)
├── claim_cluster_assignments table (inherited from papers)
├── RPC: get_episode_cluster_coverage(), get_notebook_cluster_distribution()
├── RPC: compare_episode_to_notebook(), get_taxonomy_overview()
└── RPC: match_nearest_cluster() for classifying new papers

scripts/build_taxonomy_clusters.py                  # NEW: Clustering pipeline
├── GMM clustering with BIC+silhouette for optimal k
├── UMAP or PCA for 2D positioning
├── Gemini label generation from top papers
└── Soft assignments (papers can belong to multiple clusters)

scripts/supabase_client.py                          # MODIFIED: Added 8 cluster methods
├── get_taxonomy_clusters(), get_taxonomy_overview()
├── get_cluster_papers(), get_paper_clusters()
├── get_episode_cluster_coverage(), get_notebook_cluster_distribution()
├── compare_episode_to_notebook(), get_clusters_for_papers()
└── match_nearest_cluster()

src/bioelectricity_research/server.py               # MODIFIED: Added 6 MCP tools
├── list_taxonomy_clusters (include_papers, limit_papers)
├── get_cluster_details (cluster_id, include_papers, include_claims)
├── get_episode_cluster_coverage (podcast_id)
├── get_notebook_cluster_distribution (episode_id)
├── compare_episode_to_notebook (podcast_id) ← Key insight tool
└── get_cluster_bubble_map_data ()

frontend/lib/supabase.ts                            # MODIFIED: Added types + queries
├── Types: TaxonomyCluster, ClusterNode, PaperClusterAssignment
├── Types: ClusterCoverage, NotebookClusterDistribution, EpisodeNotebookComparison
├── getTaxonomyClusters(), getClusterPapers()
├── getEpisodeClusterCoverage(), getNotebookClusterDistribution()
├── compareEpisodeToNotebook(), getClusterBubbleMapData()

frontend/components/taxonomy-bubble-map.tsx         # NEW: Visualization components
├── TaxonomyBubbleMap - Canvas-based bubble visualization
├── ClusterDistributionBars - Horizontal bar chart for notebook
└── EpisodeClusterSummary - Comparison summary card

frontend/components/notebook-view.tsx               # MODIFIED: Added Research Territories
├── Cluster distribution bars in Overview tab
├── "X of Y territories explored" summary
├── Unexplored territories list
└── Full-screen taxonomy map modal

frontend/components/episode-overview.tsx            # MODIFIED: Added cluster coverage
└── EpisodeClusterSummary in sidebar
```

**Implementation Steps:**

1. **Run the SQL migration** (Supabase SQL Editor):
   ```sql
   -- Copy contents of supabase/migrations/008_add_taxonomy_clusters.sql
   ```

2. **Install Python dependencies**:
   ```bash
   pip install scikit-learn
   # Optional for better 2D layout:
   brew install cmake && pip install umap-learn
   ```

3. **Run the clustering pipeline**:
   ```bash
   # Dry run first to see results without saving
   python scripts/build_taxonomy_clusters.py --dry-run

   # Full run (clusters papers, generates labels, populates claim assignments)
   python scripts/build_taxonomy_clusters.py

   # Options:
   #   --k 10           Force specific cluster count (default: auto 8-12)
   #   --skip-labels    Skip Gemini label generation (use "Cluster 0", etc.)
   #   --skip-claims    Skip populating claim_cluster_assignments
   ```

4. **Restart the HTTP server** to pick up new MCP tools:
   ```bash
   python -m src.bioelectricity_research.http_server
   ```

5. **Test in frontend**:
   - Notebook view → Overview tab → "Research Territories" section
   - Episode overview → Sidebar → "Research Territory Coverage" card
   - Click "VIEW MAP" for full bubble visualization

**Algorithm Details:**
- **Embedding Aggregation:** Chunk embeddings → paper-level via weighted mean (by token count)
- **Optimal k Selection:** BIC + silhouette score across k=8-12
- **Clustering:** Gaussian Mixture Model with spherical covariance
- **Soft Assignment:** Papers assigned to clusters where GMM probability > 0.1
- **2D Positioning:** UMAP (cosine metric) or PCA fallback, normalized to 0-1
- **Label Generation:** Gemini analyzes top 5 papers per cluster → JSON {label, description, keywords}

**Decisions/Gotchas:**
- UMAP requires cmake + llvmlite to build; PCA fallback works without extra deps
- Gemini model: `gemini-2.0-flash` for label generation (fast, cheap)
- Soft assignment threshold 0.1 means papers typically belong to 1-3 clusters
- Claims inherit clusters from their `paper_id` reference (not re-embedded)
- Frontend uses canvas rendering (not D3) for performance with many clusters

**Next Steps:**
- Add cluster filtering to claim/paper lists
- Consider cluster badges on claim cards in listening view
- Add "explore cluster" drill-down view showing all papers/claims
- Re-run clustering periodically as new papers are added

---

## 2026-01-11: Interactive Cluster Explorer (IN PROGRESS - HAS ERRORS)

**Task:** Make taxonomy clusters interactive and explorable in episode-overview.tsx and notebook-view.tsx

**Summary:**
- Added new RPC functions for cluster drill-down queries
- Created `EpisodeClusterExplorer` component showing clickable cluster cards in episode overview
- Added cluster filtering to notebook saved items view
- Added cluster badges to bookmark cards

**Status:** FRONTEND ERROR - needs debugging in new context

**Key Files Created/Modified:**

```
supabase/migrations/009_add_cluster_drill_down.sql  # NEW: 3 RPC functions
├── get_episode_claims_by_cluster(p_podcast_id, p_cluster_id, p_limit)
│   Returns claims for an episode within a specific cluster
│   NOTE: Uses `claim_timestamp` not `timestamp` (reserved word)
├── get_bookmarks_by_cluster(p_user_id, p_cluster_id, p_episode_id)
│   Returns bookmarks filtered by cluster
└── get_bookmark_cluster_mappings(p_bookmark_ids)
    Returns cluster info for a set of bookmarks (for badges)

frontend/lib/supabase.ts                            # MODIFIED: Added types + functions
├── ClaimWithCluster interface (claim_timestamp not timestamp!)
├── BookmarkWithCluster interface
├── BookmarkClusterMapping interface
├── getEpisodeClaimsByCluster() - calls RPC
├── getBookmarksByCluster() - calls RPC
└── getBookmarkClusterMappings() - calls RPC

frontend/components/episode-overview.tsx            # MODIFIED: Added cluster explorer
├── New imports: useEffect, useCallback, ChevronDown, Layers, Sparkles
├── Import types: EpisodeNotebookComparison, ClaimWithCluster
├── Import functions: compareEpisodeToNotebook, getEpisodeClaimsByCluster
├── NEW ClusterCard component (lines ~572-681)
│   - Shows cluster label, description, claim count, keywords
│   - NEW/EXPLORED badges based on notebook comparison
│   - Expandable to show claims list
├── NEW EpisodeClusterExplorer component (lines ~684-805)
│   - Fetches clusters via compareEpisodeToNotebook()
│   - Grid of ClusterCard components
│   - Caches claims when cluster is expanded
└── Added <EpisodeClusterExplorer> after Episode Outline section (line ~958)

frontend/components/notebook-view.tsx               # MODIFIED: Added cluster filtering
├── New import: BookmarkClusterMapping, getBookmarkClusterMappings
├── New state: clusterFilter, bookmarkClusterMappings
├── Modified useEffect to load bookmark cluster mappings
├── Modified filteredBookmarks useMemo to filter by cluster
├── Replaced ClusterDistributionBars with clickable custom bars (lines ~437-477)
│   - Shows excavation depth: DEEP/MODERATE/TOUCHED
│   - Clicking sets clusterFilter and switches to "saved" tab
├── Added cluster filter chips UI in Saved Items tab (lines ~598-643)
└── Added cluster badges to bookmark cards (lines ~766-783)
```

**Architecture:**

```
User clicks cluster in Episode Overview
    ↓
EpisodeClusterExplorer.handleToggleCluster(clusterId)
    ↓
getEpisodeClaimsByCluster(episodeId, clusterId) via Supabase RPC
    ↓
Returns ClaimWithCluster[] with claim_timestamp, start_ms, etc.
    ↓
ClusterCard renders expandable claims list
    ↓
User clicks claim → onSeek(start_ms/1000) → jumps to listening view

User clicks cluster bar in Notebook Overview
    ↓
setClusterFilter(clusterId) + setActiveTab("saved")
    ↓
filteredBookmarks useMemo filters by cluster via bookmarkClusterMappings
    ↓
Shows only bookmarks in that cluster
```

**Decisions/Gotchas:**
- `timestamp` is reserved in PostgreSQL - renamed to `claim_timestamp` in RPC return type
- Frontend type `ClaimWithCluster` uses `claim_timestamp` not `timestamp`
- Cluster mappings loaded after bookmarks via `getBookmarkClusterMappings()`
- Claims cached per-cluster in `claimsCache` Map to avoid re-fetching

**Debugging Completed (2026-01-11):**

Two errors were identified and fixed:

**Error 1: Ambiguous column reference (PostgreSQL 42702)**
```
column reference "cluster_id" is ambiguous
It could refer to either a PL/pgSQL variable or a table column.
```

**Root Cause:** PL/pgSQL functions with `RETURNS TABLE (cluster_id integer, ...)` conflict with table columns named `cluster_id`. PostgreSQL can't tell if you mean the output column or the source table column.

**Fix:** Alias all columns in CTEs and final SELECT:
```sql
-- Before (broken)
WITH episode_clusters AS (
    SELECT cca.cluster_id, COUNT(*) as claim_count ...
)
SELECT tc.cluster_id FROM taxonomy_clusters tc
LEFT JOIN episode_clusters ec ON tc.cluster_id = ec.cluster_id

-- After (fixed)
WITH episode_clusters AS (
    SELECT cca.cluster_id AS ec_cluster_id, COUNT(*) as claim_count ...
)
SELECT tc.cluster_id AS cluster_id FROM taxonomy_clusters tc
LEFT JOIN episode_clusters ec ON tc.cluster_id = ec.ec_cluster_id
```

**Files Fixed:**
- `supabase/migrations/008_add_taxonomy_clusters.sql` - `compare_episode_to_notebook()`, `get_notebook_cluster_distribution()`

**Error 2: Map icon shadowing built-in Map constructor**
```
Map is not a constructor
```

**Root Cause:** `import { Map } from "lucide-react"` shadows JavaScript's built-in `Map` class, so `new Map()` tries to instantiate the icon component.

**Fix:** Rename the icon import:
```tsx
import { Map as MapIcon } from "lucide-react"
```

**Files Fixed:**
- `frontend/components/notebook-view.tsx` - Line 32 import, lines 419 and 514 usages

**Documentation Added:**
- `docs/ARCHITECTURE.md` - Added Taxonomy Cluster System section
- `docs/TAXONOMY_CLUSTERS.md` - NEW: Detailed implementation guide

---

## 2026-01-12: AI Image Generation in Chat

**Task:** Add Gemini-powered image generation to the AI chat sidebar for scientific visualizations

**Summary:**
- Users can generate images via chat commands (`/visualize`, `/image`) or natural language ("generate an image of...")
- Backend uses `gemini-3-pro-image-preview` model with `response_modalities=["TEXT", "IMAGE"]`
- Images stored in Supabase Storage bucket (public)
- Frontend detects image intent, renders images in chat with download/bookmark hover actions
- Images can be saved to notebook using existing `addImageBookmark()` function

**Key Files:**
```
supabase/migrations/
├── 010_add_generated_images_storage.sql  # Storage bucket policies
└── 011_add_image_to_chat_messages.sql    # image_url, image_caption columns

src/bioelectricity_research/
├── server.py        # _generate_image_impl(), generate_image_with_context MCP tool
└── http_server.py   # /tools/generate_image_with_context/execute endpoint

frontend/
├── lib/chat-types.ts              # GeneratedImage, GenerateImageResponse types
├── lib/supabase.ts                # ChatMessageRecord image fields
├── hooks/use-ai-chat.ts           # detectImageIntent(), image generation flow
├── components/ai-chat/chat-message.tsx    # Image rendering with actions
└── components/ai-chat/ai-chat-sidebar.tsx # handleBookmarkImage callback
```

**Decisions/Gotchas:**
- `@mcp.tool()` decorator wraps functions in `FunctionTool` object - can't call directly from HTTP endpoint. Extracted core logic to `_generate_image_impl()` helper.
- Model: `gemini-3-pro-image-preview` (Nano Banana Pro) has best text rendering for scientific diagrams

**Critical Bug Fixed: Corrupted Image Data**

**Root Cause:** The `google-genai` SDK returns `part.inline_data.data` as **raw bytes**, not base64-encoded strings. The original code called `base64.b64decode(image_data)` which corrupted the image data, resulting in broken images that uploaded successfully but couldn't be displayed.

**Symptoms:**
- Image uploaded to Supabase Storage (file visible in dashboard)
- Image URL returned correctly to frontend
- Image failed to load in browser (`<img>` onError fired)
- Image also failed to load when opened directly in Supabase dashboard
- File size seemed reasonable (~600KB) but image was corrupted

**Fix:** Check the type of `image_data` before processing:
```python
if isinstance(image_data, bytes):
    # Already raw bytes, use directly
    image_bytes = image_data
elif isinstance(image_data, str):
    # Base64 encoded string, decode it
    image_bytes = base64.b64decode(image_data)
```

**Setup Required:**
1. Create `generated-images` bucket in Supabase Dashboard (public bucket)
2. Run SQL migrations 010 and 011
3. Ensure `SUPABASE_SERVICE_KEY` is set in backend environment
4. Restart HTTP server

**Next Steps:**
- Remove debug console.log statements from frontend
- Consider switching to signed URLs for security
- Add loading skeleton while image generates

---

## 2026-01-12: AI Mini Podcast Generation

**Task:** Add AI-generated mini podcasts to deep dive pages where two hosts discuss claims and supporting research in a 3-5 minute conversational format.

**Summary:**
- Created two-host podcast generation using Gemini 3 (script) + Gemini 2.5 TTS (multi-speaker audio)
- Script features ALEX (curious interviewer, voice: Puck) and SAM (knowledgeable expert, voice: Charon)
- Backend generates conversational script from claim context + RAG-retrieved papers, then synthesizes multi-speaker audio
- Audio stored in Supabase Storage `generated-podcasts` bucket (public for playback)
- Frontend shows audio player with play/pause, progress bar, time display, expandable script, download
- Results cached in `data/cache/generated_podcasts.json` to avoid regenerating

**Key Files:**
```
supabase/migrations/
└── 012_add_generated_podcasts_storage.sql  # RLS policies for storage bucket

src/bioelectricity_research/
├── server.py        # Lines 3324-3776: Constants, prompt, model, implementation, MCP tool
│   ├── GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"
│   ├── PODCAST_HOST_A = "Puck", PODCAST_HOST_B = "Charon"
│   ├── GenerateMiniPodcastInput (Pydantic model)
│   ├── PODCAST_SCRIPT_PROMPT_TEMPLATE
│   ├── _generate_mini_podcast_impl() - Core logic
│   └── @mcp.tool() generate_mini_podcast
└── http_server.py   # Lines 1091-1124: /tools/generate_mini_podcast/execute endpoint

frontend/
├── lib/chat-types.ts                    # GeneratedPodcast, GeneratePodcastResponse types
├── components/mini-podcast-player.tsx   # NEW: Audio player component (~280 lines)
│   ├── Play/pause, progress bar, seek
│   ├── Time display, download button
│   ├── Expandable script section
│   └── Loading, error, no-audio states
└── components/deep-exploration-view.tsx # Added Mini Podcast section above Evidence Threads
    ├── miniPodcast, isLoadingPodcast, podcastError state
    └── fetchMiniPodcast() function
```

**TTS Multi-Speaker Config:**
```python
speech_config = types.SpeechConfig(
    multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
        speaker_voice_configs=[
            types.SpeakerVoiceConfig(
                speaker='ALEX',
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name='Puck')
                )
            ),
            types.SpeakerVoiceConfig(
                speaker='SAM',
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name='Charon')
                )
            ),
        ]
    )
)
```

**Decisions/Gotchas:**
- Gemini 3 doesn't have TTS yet; used hybrid approach (Gemini 3 for script, Gemini 2.5 TTS for audio)
- TTS returns PCM 24kHz audio; converted to WAV with proper header for browser playback
- RAG results bug: was passing `documents` list (strings) instead of dicts with metadata; fixed by combining `documents` + `metadatas` before formatting
- Script targets ~900 words for 3-5 minutes spoken duration
- Cache key format: `{episode_id}:{claim_id}:{style}`
- `force_regenerate` flag bypasses cache when user wants fresh generation

**Setup Required:**
1. Create `generated-podcasts` bucket in Supabase Dashboard (public bucket, 50MB limit, audio/* MIME)
2. Run migration `012_add_generated_podcasts_storage.sql`
3. Restart HTTP server

**Next Steps:**
- Consider adding style toggle (casual/academic) to frontend UI
- Could pre-generate podcasts for popular claims
- Add playback speed control to player
- Consider episode-level podcast combining multiple claims

---

## 2026-01-13: Gemini 3 Thinking Traces in AI Chat (RESOLVED)

**Task:** Add visible thinking/reasoning traces to AI chat to showcase Gemini 3's thinking capability for hackathon demo

**Status:** FIXED - Streaming mode required for thought summaries

**Root Cause:**
Gemini 3 Pro only returns thought summaries in **streaming mode** (`generate_content_stream()`). Non-streaming mode returns `thought_signature` (proving model IS thinking) but `thought=None` (no summary exposed). This is documented as "best effort" but in practice, streaming is required.

**Solution:**
Changed from `generate_content()` to `generate_content_stream()` when `include_thinking=True`. Also fixed config structure to use `types.GenerateContentConfig` properly instead of passing a plain dict.

**Key Changes:**
```
src/bioelectricity_research/server.py
├── Changed GenerateContentConfig from dict to types.GenerateContentConfig
├── Use generate_content_stream() when include_thinking=True
└── Collect thinking_parts and response_parts from streamed chunks

src/bioelectricity_research/http_server.py
├── Same changes as server.py
└── Removed debug logging (cleaned up)

frontend/hooks/use-ai-chat.ts
└── Removed debug console.log statements
```

**Test Results (from scripts/test_thinking_api.py):**
```
# Non-streaming: thought=None, thought_signature=present (model thinks but no summary)
# Streaming: Returns 3 thinking parts with actual reasoning text!

Example thinking output:
"**Focusing on Bioelectricity**
I'm now zeroing in on bioelectricity. My goal is to find three surprising facts..."
```

**Alternative Discovery:**
`gemini-2.5-pro` (non-streaming) DOES return thought summaries with `thought=True`. If streaming latency is a concern, switching models is another option.

**Decisions/Gotchas:**
- Streaming is required for Gemini 3 Pro thought summaries (not optional)
- Config must use `types.GenerateContentConfig()` not a plain dict
- Non-streaming is still used when `include_thinking=False` for lower latency
- Thought summaries are still "best effort" - may occasionally not appear

---

## 2026-01-13: Real-Time Thinking Streaming

**Task:** Stream thinking traces to the frontend in real-time as the model reasons, rather than showing them only after completion.

**Summary:**
- Added new SSE (Server-Sent Events) streaming endpoint `/tools/chat_with_context/stream`
- Frontend now consumes SSE events progressively, updating UI in real-time
- Thinking traces appear live with a pulsing cursor while reasoning
- Response content also streams progressively after thinking completes

**Key Changes:**

**Backend (http_server.py):**
```
@app.post("/tools/chat_with_context/stream")
- Returns StreamingResponse with media_type="text/event-stream"
- Event types: thinking, content, sources, done, error
- Streams Gemini chunks directly to client as they arrive
```

**Frontend (hooks/use-ai-chat.ts):**
```
- Uses fetch() with ReadableStream to consume SSE
- Parses event: and data: lines from buffer
- Progressively updates message state for thinking, content, and sources
- New message properties: isThinking, isStreaming
```

**Frontend (chat-message.tsx):**
```
- Auto-expands thinking section while isThinking is true
- Shows animated spinner with "Reasoning..." label during thinking
- Pulsing cursor at end of thinking text while streaming
- Pulsing cursor at end of content while streaming response
```

**Frontend (chat-types.ts):**
```
- Added isThinking?: boolean (true while receiving thinking chunks)
- Added isStreaming?: boolean (true while receiving content chunks)
```

**SSE Event Format:**
```
event: thinking
data: {"text": "...reasoning chunk..."}

event: content
data: {"text": "...response chunk..."}

event: sources
data: {"sources": [...]}

event: done
data: {"query_used": "...", "model": "...", "thinking_complete": "...", "response_complete": "..."}

event: error
data: {"error": "..."}
```

**User Experience:**
1. User sends message
2. "Reasoning..." label appears with spinner, auto-expanded
3. Thinking text streams in real-time with pulsing cursor
4. When thinking completes, section stays visible
5. Response content begins streaming below with its own cursor
6. When done, cursors disappear, sources appear

**Bugs Fixed During Implementation:**

1. **KeyError: 'episode_title'** - The SSE endpoint was using incorrect template variables (`system_prompt` instead of `episode_title`, `guest_name`, etc.). Fixed by matching the format call to `CHAT_CONTEXT_PROMPT_TEMPLATE`'s expected variables.

2. **Events not streaming in real-time** - The synchronous Gemini iterator was blocking the async event loop, causing all SSE events to be batched and sent only after completion. Fixed by using a **queue-based approach**:
   - Gemini streaming runs in a background thread via `threading.Thread`
   - Chunks are put into a `queue.Queue` as they arrive
   - The async generator reads from the queue using `run_in_executor` with timeout
   - `await asyncio.sleep(0.01)` yields control when queue is empty

**Final Implementation (http_server.py lines ~1247-1308):**
```python
# Queue bridges sync Gemini streaming with async SSE
chunk_queue = queue.Queue()

def stream_gemini():
    for chunk in response_stream:
        # Parse and put chunks in queue
        chunk_queue.put(("thinking", text))  # or ("content", text)
    chunk_queue.put(("done", None))

thread = threading.Thread(target=stream_gemini)
thread.start()

while True:
    event_type, text = await loop.run_in_executor(
        None, lambda: chunk_queue.get(timeout=0.1)
    )
    yield f"event: {event_type}\ndata: {json.dumps({'text': text})}\n\n"
```

**To Test:**
```bash
# Restart HTTP server
python -m src.bioelectricity_research.http_server

# Frontend should already work - the hook uses the new endpoint
cd frontend && npm run dev
```

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
