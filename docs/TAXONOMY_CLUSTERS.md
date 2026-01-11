# Taxonomy Clusters Implementation Guide

This document describes the "Knowledge Cartography" feature that organizes papers into research territories and enables users to visualize their exploration progress.

## Overview

The taxonomy cluster system:
1. Groups papers into 8-12 semantic clusters using GMM (Gaussian Mixture Model)
2. Generates human-readable labels via Gemini
3. Positions clusters in 2D space using UMAP for visualization
4. Tracks which clusters appear in each episode and user's notebook
5. Enables drill-down into cluster-specific claims

## Database Schema

### Tables

```sql
-- Cluster definitions
taxonomy_clusters (
    cluster_id INTEGER UNIQUE,     -- 0 to n_clusters-1
    label TEXT,                    -- "Bioelectric Morphogenesis"
    description TEXT,              -- 1-sentence (max 25 words)
    keywords TEXT[],               -- 3-5 characterizing keywords
    position_x FLOAT,              -- UMAP x position (0-1)
    position_y FLOAT,              -- UMAP y position (0-1)
    centroid_embedding vector(384),
    paper_count INTEGER,
    primary_paper_count INTEGER
)

-- Soft paper assignments (many-to-many)
paper_cluster_assignments (
    paper_id TEXT REFERENCES papers(paper_id),
    cluster_id INTEGER REFERENCES taxonomy_clusters(cluster_id),
    confidence FLOAT,              -- GMM probability (0-1)
    is_primary BOOLEAN,            -- Highest-confidence cluster for this paper
    position_x FLOAT,              -- Paper's UMAP position
    position_y FLOAT
)

-- Inherited claim assignments
claim_cluster_assignments (
    claim_id BIGINT REFERENCES claims(id),
    cluster_id INTEGER REFERENCES taxonomy_clusters(cluster_id),
    source_paper_id TEXT,
    confidence FLOAT
)
```

### RPC Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `compare_episode_to_notebook(podcast_id, user_id)` | Main comparison query | All clusters with `in_episode`, `in_notebook` flags |
| `get_episode_cluster_coverage(podcast_id)` | Episode cluster stats | Clusters with claim counts |
| `get_notebook_cluster_distribution(user_id, episode_id)` | Notebook breakdown | Clusters with bookmark counts |
| `get_episode_claims_by_cluster(podcast_id, cluster_id)` | Drill-down | Claims in a cluster |
| `get_bookmark_cluster_mappings(bookmark_ids)` | Badge display | Cluster labels for bookmarks |

## Clustering Pipeline

### Algorithm

1. **Embedding Aggregation**: Chunk embeddings → paper-level via weighted mean (by token count)
2. **Optimal k Selection**: BIC + silhouette score across k=8-12
3. **Clustering**: Gaussian Mixture Model with spherical covariance
4. **Soft Assignment**: Papers assigned to clusters where GMM probability > 0.1
5. **2D Positioning**: UMAP (cosine metric) or PCA fallback, normalized to 0-1
6. **Label Generation**: Gemini analyzes top 5 papers per cluster → JSON {label, description, keywords}

### Usage

```bash
# Full run
python scripts/build_taxonomy_clusters.py

# Options
python scripts/build_taxonomy_clusters.py --dry-run        # Preview without saving
python scripts/build_taxonomy_clusters.py --k 10           # Force 10 clusters
python scripts/build_taxonomy_clusters.py --skip-labels    # Use "Cluster 0", etc.
python scripts/build_taxonomy_clusters.py --skip-claims    # Don't populate claim assignments
```

### Dependencies

```bash
pip install scikit-learn

# Optional for better 2D layout (falls back to PCA without)
brew install cmake && pip install umap-learn
```

## Frontend Components

### TaxonomyBubbleMap

Canvas-based bubble visualization of all clusters.

```tsx
import { TaxonomyBubbleMap } from "@/components/taxonomy-bubble-map"

<TaxonomyBubbleMap
  highlightMode="comparison"  // "none" | "episode" | "notebook" | "comparison"
  episodeId="lex_325"
  onClusterClick={(clusterId) => handleDrillDown(clusterId)}
  width={600}
  height={400}
  showLegend={true}
/>
```

### EpisodeClusterExplorer

Expandable cluster cards with drill-down claims list.

```tsx
import { EpisodeClusterExplorer } from "@/components/episode-overview"

// Renders inside episode-overview.tsx
<EpisodeClusterExplorer
  episodeId={episode.id}
  onSeek={(timestamp) => onStartListening(timestamp)}
/>
```

Features:
- Shows NEW/EXPLORED badges based on notebook comparison
- Expandable to show claims in each cluster
- Click claim to seek to timestamp

### ClusterDistributionBars

Horizontal bar chart showing bookmark distribution across clusters.

```tsx
import { ClusterDistributionBars } from "@/components/taxonomy-bubble-map"

<ClusterDistributionBars
  distribution={clusterDistribution}
  totalBookmarks={stats.total}
  maxClusters={6}
/>
```

### EpisodeClusterSummary

Quick stats card for sidebar.

```tsx
import { EpisodeClusterSummary } from "@/components/taxonomy-bubble-map"

<EpisodeClusterSummary
  episodeId={episode.id}
  onViewMap={() => setShowMap(true)}
/>
```

## TypeScript Types

```typescript
// frontend/lib/supabase.ts

interface TaxonomyCluster {
  cluster_id: number
  label: string
  description: string
  keywords: string[]
  position_x: number
  position_y: number
  paper_count: number
  primary_paper_count: number
}

interface EpisodeNotebookComparison {
  cluster_id: number
  label: string
  description?: string
  keywords?: string[]
  in_episode: boolean
  episode_claim_count: number
  in_notebook: boolean
  notebook_item_count: number
}

interface ClaimWithCluster {
  claim_id: number
  claim_text: string
  distilled_claim?: string
  claim_timestamp?: string  // Note: "claim_timestamp" not "timestamp" (reserved word)
  start_ms?: number
  paper_id?: string
  paper_title?: string
  confidence: number
}
```

## Query Functions

```typescript
// frontend/lib/supabase.ts

// Get all clusters for bubble map
await getTaxonomyClusters()

// Compare episode to user's notebook
await compareEpisodeToNotebook(episodeId)
// Returns: { all, new_clusters, overlapping, existing_only, unexplored, summary }

// Get claims in a cluster for an episode
await getEpisodeClaimsByCluster(podcastId, clusterId, limit)

// Get cluster distribution for notebook
await getNotebookClusterDistribution(episodeId)

// Get cluster badges for bookmarks
await getBookmarkClusterMappings(bookmarkIds)
// Returns: Map<bookmarkId, BookmarkClusterMapping[]>
```

## SQL Gotchas

### Ambiguous Column Reference

PL/pgSQL functions with `RETURNS TABLE` can conflict with table column names. Always alias columns in CTEs:

```sql
-- BAD: "cluster_id" is ambiguous
WITH episode_clusters AS (
    SELECT cca.cluster_id, COUNT(*) ...
)
SELECT tc.cluster_id FROM taxonomy_clusters tc
LEFT JOIN episode_clusters ec ON tc.cluster_id = ec.cluster_id

-- GOOD: Use unique aliases
WITH episode_clusters AS (
    SELECT cca.cluster_id AS ec_cluster_id, COUNT(*) ...
)
SELECT tc.cluster_id AS cluster_id FROM taxonomy_clusters tc
LEFT JOIN episode_clusters ec ON tc.cluster_id = ec.ec_cluster_id
```

### Reserved Words

PostgreSQL reserves `timestamp` as a column name. Use `claim_timestamp` in return types:

```sql
RETURNS TABLE (
    claim_timestamp text,  -- NOT "timestamp"
    ...
)
```

## Migrations

Apply in order:

1. `supabase/migrations/008_add_taxonomy_clusters.sql` - Schema + main RPC functions
2. `supabase/migrations/009_add_cluster_drill_down.sql` - Drill-down RPC functions

## Maintenance

### Re-clustering after adding papers

```bash
# Re-run the full pipeline
python scripts/build_taxonomy_clusters.py

# Force regeneration of labels
python scripts/build_taxonomy_clusters.py --force
```

### Updating claim assignments

Claims are assigned when running the pipeline with `--skip-claims` omitted. New claims from new episodes need the pipeline re-run to get cluster assignments.

## Debugging

### Check if clusters exist

```sql
SELECT COUNT(*) FROM taxonomy_clusters;
SELECT COUNT(*) FROM paper_cluster_assignments;
SELECT COUNT(*) FROM claim_cluster_assignments;
```

### Test RPC functions

```sql
-- Test comparison function
SELECT * FROM compare_episode_to_notebook('lex_325', 'default_user');

-- Test drill-down
SELECT * FROM get_episode_claims_by_cluster('lex_325', 0, 10);
```

### Frontend errors

Common issues:
- `Map is not a constructor`: Icon import shadowing built-in Map. Use `Map as MapIcon`.
- `column reference is ambiguous`: RPC function needs aliased columns (see SQL Gotchas above).
- Empty clusters array: Run `build_taxonomy_clusters.py` to populate data.
