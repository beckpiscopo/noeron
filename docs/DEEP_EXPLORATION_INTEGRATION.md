# Deep Exploration View - Real Data Integration

## Overview

The Deep Exploration View has been successfully connected to real data from the MCP server. When users click "Dive Deeper" on a claim in the Listening View, they now see actual research papers, evidence threads, and related concepts from your bioelectricity research corpus.

## Architecture

### Data Flow

```
User clicks "Dive Deeper" on Claim
    ↓
page.tsx tracks selectedClaimId
    ↓
DeepExplorationView receives claim.id and episodeId
    ↓
Component calls MCP tool: get_claim_context
    ↓
MCP Server processes:
    - Loads claim from claims cache
    - Extracts evidence threads from RAG results
    - Searches vector store for related concepts
    - Calculates confidence metrics
    ↓
Returns enriched context data
    ↓
Component displays real data in UI
```

## New MCP Tool: `get_claim_context`

### Location
`src/bioelectricity_research/server.py`

### Parameters
- `claim_id` (string, required): The claim ID in format "segment_key-index"
- `episode_id` (string, default: "lex_325"): The episode ID
- `include_related_concepts` (bool, default: true): Whether to search for related concepts
- `related_concepts_limit` (int, default: 5): Number of related concepts to return

### Returns
```typescript
{
  claim_id: string
  claim_data: {
    claim_text: string
    speaker_stance: string
    needs_backing_because: string
    claim_type: string
    context_tags: Record<string, string>
  }
  evidence_threads: Array<{
    type: "primary" | "replication" | "counter"
    title: string
    paper_title: string
    description: string
    paper_id: string
    source_link: string
    confidence_score: number
    citation_count: number
    highlighted: boolean
  }>
  related_concepts: Array<{
    title: string
    description: string
    paper_title: string
    paper_id: string
    year: string | number
  }>
  synthesis: {
    claim_text: string
    rationale: string
    speaker_stance: string
    claim_type: string
    context_tags: Record<string, string>
  }
  confidence_metrics: {
    confidence_level: "High" | "Medium" | "Low"
    confidence_score: number
    consensus_percentage: number
    evidence_counts: {
      primary: number
      replication: number
      counter: number
    }
  }
  segment_info: {
    timestamp: string
    speaker: string
    transcript_excerpt: string
  }
}
```

## Evidence Thread Classification

Papers are automatically classified into three categories:

### Primary Source
- Confidence score ≥ 0.7
- OR claim_type contains "primary"
- These are highlighted in the UI with a larger dot

### Replication
- Default category for supporting evidence
- Papers that confirm or extend the primary findings

### Counter-Evidence
- claim_type contains "counter" or "alternative"
- Papers proposing alternative explanations or contradicting the claim

Evidence threads are sorted by:
1. Type (primary → replication → counter)
2. Citation count (descending)

## Confidence Metrics

### Confidence Level
Calculated from average confidence scores of evidence threads:
- **High**: avg_confidence ≥ 0.7
- **Medium**: 0.4 ≤ avg_confidence < 0.7
- **Low**: avg_confidence < 0.4

### Consensus Percentage
```
consensus = (primary_count + replication_count) / total_evidence_count * 100
```

This represents the percentage of evidence that supports the claim.

## Related Concepts

Related concepts are discovered using semantic search on the vector store:
1. Query the vector store with the claim text
2. Extract unique paper titles and section headings
3. Return top N results (default: 5)
4. Display with excerpts from the papers

## Frontend Updates

### page.tsx
- Added `selectedClaimId` state to track which claim user wants to explore
- Pass `episodeId` to DeepExplorationView
- Find and pass the correct claim object based on selectedClaimId

### deep-exploration-view.tsx
- Added `useEffect` hook to fetch claim context on mount
- Loading state with spinner
- Error state with user-friendly message
- Three synthesis modes:
  - **Simplified**: Plain language explanation
  - **Technical**: Detailed analysis with context tags and evidence counts
  - **Raw Data**: JSON view of complete data structure
- Real evidence threads with clickable links to papers
- Related concepts from vector store
- Dynamic confidence and consensus metrics

## Data Sources

The tool pulls from multiple data sources:

1. **Claims Cache** (`cache/podcast_lex_325_claims_with_timing.json`)
   - Original claim data
   - Timing information
   - RAG results with paper matches

2. **Context Card Registry** (`data/context_card_registry.json`)
   - Segment-level metadata
   - Research queries
   - Context tags

3. **Papers Collection** (`data/papers_collection.json`)
   - Paper metadata (authors, year, citations, venue)
   - Abstracts and full text (when available)

4. **Vector Store** (`data/vectorstore/`)
   - Semantic search for related concepts
   - Paper chunks with embeddings

## Usage Example

### From Listening View
```typescript
// User clicks "Dive Deeper" button
onDiveDeeper={handleDiveDeeper}

// Handler in page.tsx
const handleDiveDeeper = (claimId: string) => {
  setSelectedClaimId(claimId)  // Track which claim
  setView("exploration")        // Navigate to exploration view
}
```

### Deep Exploration View
```typescript
<DeepExplorationView
  episode={explorationEpisode}
  claim={currentExplorationClaim}  // The selected claim
  episodeId={activeEpisode.id}     // e.g., "lex_325"
  onBack={handleBackToListening}
  onViewSourcePaper={() => setView("paper")}
/>
```

### MCP Tool Call
```typescript
const data = await callMcpTool<ClaimContextData>("get_claim_context", {
  claim_id: claim.id,              // e.g., "lex_325|00:00:00.160|1-0"
  episode_id: episodeId,           // e.g., "lex_325"
  include_related_concepts: true,
  related_concepts_limit: 5,
})
```

## Features Implemented

✅ Real evidence threads from research papers
✅ Automatic classification (primary/replication/counter)
✅ Citation counts and paper metadata
✅ Clickable links to Semantic Scholar
✅ Related concepts from vector store
✅ Dynamic confidence and consensus metrics
✅ Three synthesis modes (simplified/technical/raw)
✅ Context tags display
✅ Loading and error states
✅ Responsive design

## Testing

To test the integration:

1. Start the MCP server:
   ```bash
   cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
   python -m src.bioelectricity_research.server
   ```

2. Start the frontend:
   ```bash
   cd frontend
   pnpm dev
   ```

3. Navigate through the app:
   - Landing Page → Episode Library
   - Select an episode (e.g., Lex Fridman #325)
   - In Listening View, click "Dive Deeper" on any claim
   - Observe real data loading in Deep Exploration View

4. Verify:
   - Evidence threads show real papers
   - Related concepts appear from vector store
   - Confidence metrics are calculated
   - Synthesis shows actual claim data
   - Raw data mode shows complete JSON

## Troubleshooting

### No Evidence Threads
- Check if the claim has RAG results in the claims cache
- Verify papers_collection.json has metadata for the paper IDs
- Some claims may not have associated papers yet

### No Related Concepts
- Ensure vector store is built: `python scripts/build_vector_store.py`
- Check vector store stats: Use MCP tool `rag_stats`
- Verify the claim has meaningful text for semantic search

### Error: "Segment not found"
- Claim ID format must be: "segment_key-index"
- Verify the claim exists in the claims cache
- Check that episode_id matches the cache data

### Confidence Metrics Show 0%
- This means no evidence threads were found
- Check the RAG results in the segment data
- Verify papers are in the collection

## Future Enhancements

Potential improvements:

1. **Pre-generate Synthesis**: Create AI-generated summaries for each claim
2. **Citation Graph**: Visualize paper relationships
3. **Filter Evidence**: Allow filtering by evidence type or confidence
4. **Paper Previews**: Show paper abstracts in tooltips
5. **Bookmark Claims**: Let users save interesting claims
6. **Export**: Download evidence threads as PDF or markdown
7. **Interactive Prompts**: Make guided prompts actually query the AI
8. **Related Claims**: Show other claims from the same papers

## Questions Answered

### 1. How should I structure the context card data to include evidence threads?
Evidence threads are extracted from the existing RAG results in the claims cache. Each RAG result that matches the claim is converted to an evidence thread with classification based on confidence scores and claim types.

### 2. Should I use the existing vector store to find related concepts?
Yes! The implementation uses `rag_search` on the vector store with the claim text as the query. This finds semantically similar content from the paper corpus.

### 3. How do I classify papers as "primary", "replication", or "counter-evidence"?
Classification is based on:
- Confidence score (≥0.7 = primary)
- Claim type field (contains "primary", "counter", or "alternative")
- Default to "replication" for supporting evidence

### 4. What metadata from papers_collection.json can be used for confidence/consensus?
- Citation count (used for sorting)
- Year (displayed in UI)
- Authors (formatted as "First Author et al.")
- Venue (journal/conference name)

### 5. Should synthesis be pre-generated or generated on-demand?
Currently using existing data from the claims cache (claim_text, rationale, context_tags). For more sophisticated synthesis, you could add an AI generation step in the MCP tool or pre-generate during claim processing.

## Summary

The Deep Exploration View is now fully connected to your real bioelectricity research data. Users can explore claims with actual evidence from your paper corpus, see related concepts through semantic search, and understand the confidence and consensus around each claim. The implementation leverages your existing data infrastructure (claims cache, papers collection, vector store) without requiring new data processing pipelines.

