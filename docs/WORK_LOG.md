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

Template:

Date:
Task:
Summary:
-
Decisions/Gotchas:
-
Next Steps:
- 
