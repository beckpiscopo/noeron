# Knowledge Graph Architecture

This document describes how the bioelectricity research knowledge graph works and captures ideas for future improvements.

## Table of Contents
1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Extraction Process](#extraction-process)
4. [Entity & Relationship Schema](#entity--relationship-schema)
5. [Deduplication & Canonicalization](#deduplication--canonicalization)
6. [Validation System](#validation-system)
7. [Frontend Integration](#frontend-integration)
8. [Live Concept Expansion](#live-concept-expansion)
9. [Current Statistics](#current-statistics)
10. [Future Improvements](#future-improvements)

---

## Overview

The knowledge graph (KG) is a structured representation of bioelectricity research concepts and their relationships, extracted from scientific papers using Gemini AI. It enables:

- **Concept Discovery**: Explore how scientific concepts relate to each other
- **Evidence Tracing**: Every relationship links back to source papers
- **Dynamic Expansion**: Users can expand nodes with AI-powered analysis
- **Cross-Paper Synthesis**: Understand how findings connect across multiple studies

### Key Files

| File | Purpose |
|------|---------|
| `data/knowledge_graph/knowledge_graph.json` | Merged KG (661 entities, 999 relationships) |
| `data/knowledge_graph/entity_aliases.json` | Synonym mappings (2,900+ aliases) |
| `data/knowledge_graph/claim_entity_relevance.json` | Pre-computed claim-entity relevance |
| `data/knowledge_graph/raw_extractions/` | Per-paper extraction cache |
| `scripts/knowledge_graph/extract_kg_from_papers.py` | Extraction pipeline |
| `scripts/knowledge_graph/generate_claim_relevance.py` | Claim-entity relevance generation |
| `scripts/knowledge_graph/deduplicate_entities.py` | Entity deduplication |
| `scripts/knowledge_graph/validate_kg.py` | Quality validation |

---

## Pipeline Architecture

```
                                 ┌─────────────────────┐
                                 │   Scientific Papers │
                                 │   (GROBID JSON)     │
                                 └──────────┬──────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │     STAGE 1: EXTRACTION   │
                              │   (Gemini AI + Prompts)   │
                              └─────────────┬─────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │   Raw Extractions Cache   │
                              │   (per-paper JSON files)  │
                              └─────────────┬─────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │   STAGE 2: DEDUPLICATION  │
                              │   (Synonym Groups + NLP)  │
                              └─────────────┬─────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │    STAGE 3: VALIDATION    │
                              │   (Quality Checks)        │
                              └─────────────┬─────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │   Merged Knowledge Graph  │
                              │   (knowledge_graph.json)  │
                              └───────────────────────────┘
```

---

## Extraction Process

### Gemini Prompt Design

The extraction uses a carefully designed prompt that:
1. Provides paper title, abstract, and full text (truncated to 30K tokens)
2. Specifies 8 entity types and 13 relationship types
3. Requires evidence quotes for each relationship
4. Assigns confidence scores (1.0 = explicit, 0.7 = implied, 0.5 = speculative)

**Key prompt constraints:**
- Extract 10-30 high-quality entities per paper (not quantity, quality)
- Extract 15-40 meaningful relationships per paper
- Use lowercase_snake_case for entity IDs
- Focus on bioelectricity domain concepts
- Include section reference for each relationship

### Extraction Output Structure

Each paper generates a cached extraction:

```json
{
  "paper_id": "8cdeaf667e3442848b43478a9c01c397bade535d",
  "entities": [
    {
      "id": "habituation",
      "name": "Habituation",
      "type": "phenomenon",
      "description": "Reversible decrement of a response...",
      "aliases": ["cellular habituation", "response decrement"],
      "mentions": 35
    }
  ],
  "relationships": [
    {
      "source": "habituation",
      "target": "non_associative_learning",
      "relationship": "part_of",
      "evidence": "Habituation is widely established as a form of...",
      "confidence": 1.0,
      "section": "Abstract"
    }
  ],
  "paper_metadata": {
    "title": "...",
    "year": 2020,
    "organisms": ["Planaria", "Xenopus"],
    "techniques": ["Optogenetics", "Patch clamp"]
  }
}
```

---

## Entity & Relationship Schema

### Entity Types (8)

| Type | Description | Examples |
|------|-------------|----------|
| `concept` | Scientific concepts | voltage gradients, bioelectric signaling |
| `organism` | Model organisms | planaria, xenopus, hydra, zebrafish |
| `technique` | Experimental methods | optogenetics, voltage-sensitive dyes |
| `molecule` | Molecular components | ion channels, gap junctions |
| `gene` | Genes and proteins | connexins, H-V-ATPase |
| `anatomical_structure` | Body parts/tissues | blastema, neural tube |
| `process` | Biological processes | regeneration, morphogenesis |
| `phenomenon` | Observable phenomena | left-right asymmetry, memory retention |

### Relationship Types (13)

| Relationship | Meaning | Example |
|--------------|---------|---------|
| `regulates` | X controls Y | voltage gradients regulate gene expression |
| `enables` | X makes Y possible | gap junctions enable bioelectric signaling |
| `disrupts` | X interferes with Y | blocking ion channels disrupts regeneration |
| `precedes` | X happens before Y | depolarization precedes cell division |
| `correlates_with` | X associated with Y | bioelectric state correlates with morphology |
| `required_for` | X is necessary for Y | gap junctions required for patterning |
| `inhibits` | X suppresses Y | anesthetics inhibit bioelectric signaling |
| `activates` | X turns on Y | depolarization activates gene expression |
| `produces` | X generates Y | ion channel misexpression produces phenotype |
| `expressed_in` | X found in Y | connexin expressed in gap junctions |
| `interacts_with` | X directly engages Y | serotonin interacts with 5-HT receptors |
| `part_of` | X is component of Y | habituation is part of learning |
| `measured_by` | X quantified using Y | membrane potential measured by dyes |

---

## Deduplication & Canonicalization

### Pre-defined Synonym Groups

The system includes 149+ canonical entities with known aliases. Examples:

```python
BIOELECTRICITY_SYNONYMS = {
    "membrane_potential": [
        "membrane voltage", "transmembrane voltage", "vmem", "vm",
        "transmembrane potential", "resting potential", "cell voltage"
    ],
    "gap_junction": [
        "gap junctions", "gj", "gap junction channel",
        "connexin channel", "electrical synapse"
    ],
    "planaria": [
        "planarian", "flatworm", "dugesia japonica",
        "schmidtea mediterranea", "girardia tigrina"
    ]
}
```

### Normalization Algorithm

```
Input: "Membrane Potential"
  → lowercase: "membrane potential"
  → replace spaces: "membrane_potential"
  → remove special chars: "membrane_potential"
  → lookup synonyms: "membrane_potential" (canonical)
Output: "membrane_potential"
```

### Merge Process

When combining extractions:
1. Normalize all entity IDs
2. Merge entities with same canonical ID
3. Aggregate mention counts
4. Collect paper references
5. Update relationship endpoints
6. Remove self-loops and duplicates

---

## Validation System

### Quality Checks

**Per-extraction validation:**
- Entity count: 5-50 expected
- Relationship count: 5-60 expected
- All entities have IDs and names
- All relationships reference valid entities
- No duplicate entity IDs
- No self-loops

**Merged graph validation:**
- Orphan reference detection
- Connectivity analysis
- Entity type distribution
- Relationship type distribution
- Hub analysis (most connected entities)

### Running Validation

```bash
# Validate merged graph
python scripts/knowledge_graph/validate_kg.py \
  --graph data/knowledge_graph/knowledge_graph.json

# Inspect specific entity relationships
python scripts/knowledge_graph/validate_kg.py \
  --graph data/knowledge_graph/knowledge_graph.json \
  --inspect --entity "voltage_gradient"
```

---

## Frontend Integration

### Interactive Graph Component

The knowledge graph is visualized using Vis.js:

**Location:** `frontend/components/concept-graph/`

**Features:**
- Force-directed and hierarchical layouts
- Color-coded nodes by entity type
- Click to select, double-click to expand
- Relationship labels on edges
- Loading states during expansion

### Node Type Colors

| Type | Color |
|------|-------|
| concept | Golden (#BE7C4D) |
| evidence | Green (#4CAF50) |
| counter_argument | Red (#EF5350) |
| cross_domain | Purple (#AB47BC) |
| organism | Blue (#42A5F5) |
| technique | Orange (#FFA726) |
| molecule | Cyan (#26C6DA) |

---

## Live Concept Expansion

### How It Works

When a user double-clicks a node:

```
User double-clicks "bioelectric_signaling"
           │
           ▼
┌──────────────────────────────────┐
│  1. RAG Search (ChromaDB)        │
│     → Find related paper chunks  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  2. Load Existing KG Context     │
│     → Get known relationships    │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  3. Gemini Grounded Analysis     │
│     → Identify new concepts      │
│     → Find counter-arguments     │
│     → Cross-domain connections   │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  4. Validate Paper References    │
│     → Filter invalid paper IDs   │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  5. Animate New Nodes on Graph   │
└──────────────────────────────────┘
```

### MCP Tool: `expand_concept_grounded`

**Input:**
- `concept_name`: The concept to expand
- `concept_context`: Optional context (e.g., the claim it came from)
- `n_rag_results`: Number of RAG results (default: 10)
- `include_counter_arguments`: Whether to look for contradicting evidence
- `include_cross_domain`: Whether to find cross-domain connections

**Output:**
```json
{
  "related_concepts": [...],
  "supporting_evidence": [...],
  "counter_arguments": [...],
  "cross_domain": [...],
  "stats": {
    "rag_results_used": 10,
    "papers_referenced": 6,
    "new_concepts_found": 4
  }
}
```

### Grounding Constraint

All expansion results are **strictly grounded** in the paper corpus:
- Every concept must have a paper_id and evidence quote
- Paper IDs are validated against the vectorstore
- No speculative or general knowledge concepts

---

## Current Statistics

| Metric | Value |
|--------|-------|
| Total Entities | 661 |
| Total Relationships | 999 |
| Papers Processed | 46 |
| Average Entities/Paper | ~14 |
| Average Relationships/Paper | ~22 |
| Average Confidence | 0.918 |
| Synonym Mappings | 2,900+ |

### Entity Type Distribution

```
molecule:             158 (23.9%)
process:               91 (13.8%)
technique:             85 (12.9%)
concept:               82 (12.4%)
anatomical_structure:  82 (12.4%)
phenomenon:            74 (11.2%)
gene:                  53 (8.0%)
organism:              34 (5.1%)
```

### Most Connected Entities

1. `depolarization` - 474 mentions
2. `bioelectric_signaling` - High cross-paper coverage
3. `morphogenesis` - Core domain concept
4. `regeneration` - Foundational process

---

## Future Improvements

### High Priority

#### 1. Incremental Graph Updates
**Problem:** Currently, adding new papers requires re-running the full merge.
**Solution:** Implement incremental extraction and merge:
- Detect new/changed papers
- Extract only new content
- Merge into existing graph without full rebuild
- Track extraction timestamps for cache invalidation

#### 2. Entity Linking to External Ontologies
**Problem:** Entities aren't linked to standard identifiers.
**Solution:** Map entities to external knowledge bases:
- Gene Ontology (GO) for processes and functions
- UniProt for proteins
- PubChem for molecules
- NCBI Taxonomy for organisms
- Provides interoperability and richer metadata

#### 3. Confidence Score Refinement
**Problem:** Confidence scores are Gemini's self-assessment, not validated.
**Solution:** Implement multi-signal confidence:
- Cross-paper validation (same relationship in multiple papers)
- Citation count weighting
- Recency weighting
- User feedback integration

### High Priority (UX)

#### 4. Graph: Start Collapsed ✅ DONE
**Problem:** Default graph shows too many relationships at once (e.g., 180 edges), making it overwhelming and hard to navigate.
**Solution:** Progressive disclosure:
- [x] Initially show only the claim + its direct connections (1-hop)
- [x] User expands nodes on demand via double-click
- [x] Add "Expand All" / "Collapse All" controls
- [x] Depth dropdown: 1-hop, 2-hop, Show All
- [x] Hidden nodes indicator shows count of collapsed nodes
- [ ] Remember expansion state per session (future enhancement)

#### 5. Evidence Thread → Graph Sync
**Problem:** Evidence Threads panel and Knowledge Graph are disconnected views.
**Solution:** Bi-directional highlighting:
- Clicking a paper in Evidence Threads highlights its node in the graph
- Clicking a graph node scrolls Evidence Threads to relevant papers
- Visual pulse animation on highlighted elements
- Creates spatial memory and connects narrative to structure
- Could extend to: click a milestone → zoom to that concept cluster

#### 6. Related Claims Panel
**Problem:** No way to discover cross-claim connections within an episode.
**Solution:** Add "Related Claims" sidebar section:
- "Other claims in this episode that connect to this concept..."
- Show claims that share entities with current claim
- Enable quick navigation between related moments
- Builds cross-episode value proposition
- Could extend to cross-episode: "This concept also appears in Episode X at timestamp Y"

#### 7. Claim → Entity Relationship Explainability ✅ DONE
**Problem:** Graph shows entities from papers that support a claim, but users can't understand WHY those entities are relevant. For example, a claim about "blastoderm splitting" shows entities like "Ethylene Glycol" (a cryoprotectant) without explaining the connection.

**Implementation (completed):**
- [x] Edge hover shows evidence quotes
- [x] Edge click shows full evidence panel
- [x] Node tooltips show entity type and description
- [x] Direct match nodes are visually distinguished
- [x] **Pre-computed claim-entity relevance** via batch script
- [x] **`relevance_to_claim` field** added to nodes in `get_relevant_kg_subgraph` response
- [x] **`claim_role` field** categorizes entities (claim_concept, experimental_technique, mechanism, supporting_context)
- [x] **Frontend displays relevance** in node panel with "Why relevant" section
- [x] **Tooltips show relevance** instead of generic description
- [x] **Role badges** show entity's relationship to the claim

**Files:**
- `scripts/knowledge_graph/generate_claim_relevance.py` - Batch script to pre-compute relevance
- `data/knowledge_graph/claim_entity_relevance.json` - Cache of claim-entity relevance explanations
- `src/bioelectricity_research/server.py` - Backend loads and injects relevance into response
- `frontend/components/concept-graph/` - Frontend displays relevance in UI

**Usage:**
```bash
# Generate relevance for all claims
python scripts/knowledge_graph/generate_claim_relevance.py --all

# Generate for specific claims
python scripts/knowledge_graph/generate_claim_relevance.py --claim-ids "lex_325|00:00:00-0"

# Force re-generate (overwrite cache)
python scripts/knowledge_graph/generate_claim_relevance.py --all --force
```

### Medium Priority

#### 8. Temporal Graph Analysis
**Problem:** No temporal dimension in the graph.
**Solution:** Add time-based features:
- Track when concepts first appeared (by paper year)
- Visualize concept evolution over time
- Identify emerging vs. established concepts
- Show research trend directions

#### 9. Contradiction Detection
**Problem:** Contradictory findings aren't explicitly flagged.
**Solution:** Automatic contradiction identification:
- Detect relationship conflicts (A inhibits B vs. A activates B)
- Flag for manual review
- Show both sides in UI with evidence
- Enable scientific debate exploration

#### 10. Hierarchical Entity Clustering
**Problem:** Flat entity list makes navigation difficult.
**Solution:** Automatic clustering:
- Group related entities (all ion channels together)
- Create hierarchical browse interface
- Enable drill-down exploration
- Use embedding similarity for clustering

#### 11. Citation Network Integration
**Problem:** Paper relationships not captured.
**Solution:** Add citation graph layer:
- Track which papers cite which
- Identify foundational papers
- Show research lineages
- Weight relationships by citation support

### Lower Priority (Research Ideas)

#### 12. Active Learning for Extraction
**Problem:** Extraction quality varies without feedback.
**Solution:** User feedback loop:
- Allow users to correct/confirm extractions
- Fine-tune prompts based on corrections
- Track extraction accuracy over time
- Prioritize uncertain extractions for review

#### 13. Multi-Modal Entity Linking
**Problem:** Figures/diagrams in papers not analyzed.
**Solution:** Gemini multimodal analysis:
- Extract concepts from figures
- Link diagram elements to entities
- Parse pathway diagrams automatically
- Capture visual relationships

#### 14. Hypothesis Generation
**Problem:** Graph is descriptive, not generative.
**Solution:** AI-powered hypothesis suggestion:
- Identify missing links (A→B, B→C, but no A→C)
- Suggest experiments to test connections
- Generate research questions
- Rank by novelty and testability

#### 15. Collaborative Curation
**Problem:** Single-source extraction, no expert validation.
**Solution:** Community features:
- Expert annotation interface
- Voting on relationship accuracy
- Discussion threads on controversial edges
- Version history for graph changes

#### 16. Query Language
**Problem:** Only simple lookups supported.
**Solution:** Structured query interface:
- "Find all molecules that regulate regeneration"
- "What connects bioelectricity to cancer?"
- Path queries between entities
- Aggregate queries (counts, distributions)

---

## Implementation Roadmap

### Phase 1: Foundation (Completed)
- [x] Extraction pipeline with Gemini
- [x] Deduplication with synonyms
- [x] Validation system
- [x] Vis.js visualization
- [x] Live concept expansion
- [x] Collapsed graph with depth controls (1-hop/2-hop/All)

### Phase 2: Quality (Next)
- [ ] Incremental updates
- [ ] External ontology linking
- [ ] Confidence refinement
- [ ] Contradiction detection

### Phase 3: Intelligence
- [ ] Temporal analysis
- [ ] Hierarchical clustering
- [ ] Citation integration
- [ ] Query language

### Phase 4: Collaboration
- [ ] Expert curation UI
- [ ] User feedback integration
- [ ] Hypothesis generation
- [ ] Multi-modal extraction

---

## CLI Reference

```bash
# Extract from all papers
python scripts/knowledge_graph/extract_kg_from_papers.py --all

# Extract from specific papers
python scripts/knowledge_graph/extract_kg_from_papers.py \
  --paper-ids PAPER_ID1 PAPER_ID2

# Force re-extraction
python scripts/knowledge_graph/extract_kg_from_papers.py --all --force

# Merge cached extractions
python scripts/knowledge_graph/extract_kg_from_papers.py --merge

# Deduplicate graph
python scripts/knowledge_graph/deduplicate_entities.py \
  data/knowledge_graph/knowledge_graph.json

# Validate graph
python scripts/knowledge_graph/validate_kg.py \
  --graph data/knowledge_graph/knowledge_graph.json

# Inspect entity relationships
python scripts/knowledge_graph/validate_kg.py \
  --inspect --entity "membrane_potential"
```

---

## References

- **Vis.js Network**: https://visjs.github.io/vis-network/docs/network/
- **Gemini API**: https://ai.google.dev/docs
- **ChromaDB**: https://docs.trychroma.com/
- **Gene Ontology**: http://geneontology.org/
