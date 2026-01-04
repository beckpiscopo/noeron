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

Template:

Date:
Task:
Summary:
-
Decisions/Gotchas:
-
Next Steps:
- 
