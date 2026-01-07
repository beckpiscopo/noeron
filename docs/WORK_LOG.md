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

Template:

Date:
Task:
Summary:
-
Decisions/Gotchas:
-
Next Steps:
- 
