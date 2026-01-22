#!/usr/bin/env python3
"""
Build Taxonomy Clusters for Knowledge Cartography.

This script clusters the paper corpus into 8-12 concept territories using
embedding similarity. Each paper gets soft assignments to multiple clusters
with confidence scores (from GMM probabilities).

Usage:
    python scripts/build_taxonomy_clusters.py                # Full pipeline
    python scripts/build_taxonomy_clusters.py --dry-run      # Preview without saving
    python scripts/build_taxonomy_clusters.py --k 10         # Force specific cluster count
    python scripts/build_taxonomy_clusters.py --skip-labels  # Skip LLM label generation

Algorithm:
    1. Fetch all paper_chunks with embeddings from Supabase
    2. Aggregate chunk embeddings to paper-level (weighted mean by token count)
    3. Run GMM clustering (k=8-12, find optimal via BIC + silhouette)
    4. Compute soft assignments (papers can belong to multiple clusters)
    5. Run UMAP for 2D positioning (for bubble map visualization)
    6. Generate cluster labels using Gemini (analyze top papers per cluster)
    7. Store results in Supabase

Dependencies:
    pip install scikit-learn umap-learn sentence-transformers google-generativeai
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Add project root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Load environment variables
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

from supabase import create_client, Client

# Configuration
MIN_CLUSTERS = 8
MAX_CLUSTERS = 12
SOFT_ASSIGNMENT_THRESHOLD = 0.1  # Minimum probability to count as cluster member
GEMINI_MODEL = "gemini-2.0-flash"  # Fast model for labeling


@dataclass
class PaperEmbedding:
    """Paper with aggregated embedding."""
    paper_id: str
    title: str
    abstract: str
    year: int
    embedding: np.ndarray
    chunk_count: int


@dataclass
class ClusterAssignment:
    """Soft assignment of paper to cluster."""
    paper_id: str
    cluster_id: int
    confidence: float
    is_primary: bool


@dataclass
class ClusterInfo:
    """Cluster metadata with LLM-generated labels."""
    cluster_id: int
    label: str
    description: str
    keywords: List[str]
    centroid: np.ndarray
    position_x: float
    position_y: float
    paper_count: int
    primary_paper_count: int


def get_supabase_client() -> Client:
    """Get authenticated Supabase client with service key."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


def fetch_paper_chunks(client: Client) -> List[Dict[str, Any]]:
    """Fetch all paper chunks with embeddings from Supabase."""
    print("Fetching paper chunks from Supabase...")

    all_chunks = []
    offset = 0
    batch_size = 1000

    while True:
        response = (
            client.table("paper_chunks")
            .select("paper_id, chunk_index, token_count, embedding")
            .range(offset, offset + batch_size - 1)
            .execute()
        )

        if not response.data:
            break

        all_chunks.extend(response.data)
        print(f"  Fetched {len(all_chunks)} chunks...")

        if len(response.data) < batch_size:
            break

        offset += batch_size

    print(f"  Total: {len(all_chunks)} chunks")
    return all_chunks


def fetch_papers_metadata(client: Client, paper_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Fetch paper metadata for given paper IDs."""
    print(f"Fetching metadata for {len(paper_ids)} papers...")

    papers = {}
    batch_size = 100

    for i in range(0, len(paper_ids), batch_size):
        batch = paper_ids[i:i + batch_size]
        response = (
            client.table("papers")
            .select("paper_id, title, abstract, year")
            .in_("paper_id", batch)
            .execute()
        )

        for paper in response.data:
            papers[paper["paper_id"]] = paper

    print(f"  Fetched {len(papers)} papers")
    return papers


def aggregate_paper_embeddings(
    chunks: List[Dict[str, Any]],
    papers_metadata: Dict[str, Dict[str, Any]]
) -> List[PaperEmbedding]:
    """
    Aggregate chunk embeddings to paper-level vectors using weighted mean pooling.

    Weight by token count to give more weight to longer/more substantial chunks.
    """
    print("Aggregating chunk embeddings to paper level...")

    # Group chunks by paper
    paper_chunks: Dict[str, List[Tuple[int, np.ndarray]]] = {}

    for chunk in chunks:
        paper_id = chunk["paper_id"]
        embedding = chunk.get("embedding")

        if embedding is None:
            continue

        # Parse embedding if it's a string
        if isinstance(embedding, str):
            try:
                embedding = json.loads(embedding)
            except json.JSONDecodeError:
                continue

        weight = chunk.get("token_count") or 1
        embedding_arr = np.array(embedding, dtype=np.float32)

        if paper_id not in paper_chunks:
            paper_chunks[paper_id] = []
        paper_chunks[paper_id].append((weight, embedding_arr))

    # Compute weighted mean for each paper
    paper_embeddings = []

    for paper_id, chunk_list in paper_chunks.items():
        if paper_id not in papers_metadata:
            continue

        weights = np.array([c[0] for c in chunk_list], dtype=np.float32)
        embeddings = np.vstack([c[1] for c in chunk_list])

        # Normalize weights
        weights = weights / weights.sum()

        # Weighted average
        paper_embedding = np.dot(weights, embeddings)

        # L2 normalize
        norm = np.linalg.norm(paper_embedding)
        if norm > 0:
            paper_embedding = paper_embedding / norm

        meta = papers_metadata[paper_id]
        paper_embeddings.append(PaperEmbedding(
            paper_id=paper_id,
            title=meta.get("title", ""),
            abstract=meta.get("abstract", ""),
            year=meta.get("year"),
            embedding=paper_embedding,
            chunk_count=len(chunk_list)
        ))

    print(f"  Aggregated {len(paper_embeddings)} papers")
    return paper_embeddings


def find_optimal_clusters(embeddings: np.ndarray, min_k: int = 8, max_k: int = 12) -> int:
    """
    Find optimal cluster count using BIC + silhouette score.

    GMM's BIC prefers simpler models, silhouette measures cluster quality.
    We combine them to find a good balance.
    """
    from sklearn.mixture import GaussianMixture
    from sklearn.metrics import silhouette_score

    print(f"Finding optimal cluster count (k={min_k} to {max_k})...")

    best_k = min_k
    best_score = float('inf')

    for k in range(min_k, max_k + 1):
        gmm = GaussianMixture(
            n_components=k,
            covariance_type='spherical',
            random_state=42,
            n_init=3,
            max_iter=200
        )
        gmm.fit(embeddings)

        # Get cluster labels for silhouette
        labels = gmm.predict(embeddings)

        # Check if we have enough samples in each cluster
        unique_labels = np.unique(labels)
        if len(unique_labels) < k:
            print(f"  k={k}: Only {len(unique_labels)} non-empty clusters, skipping")
            continue

        # BIC (lower is better)
        bic = gmm.bic(embeddings)

        # Silhouette (higher is better, -1 to 1)
        silhouette = silhouette_score(embeddings, labels)

        # Combined score: normalize BIC and combine with silhouette
        # We want to minimize this score
        score = (bic / 10000) - (silhouette * 5)

        print(f"  k={k}: BIC={bic:.0f}, silhouette={silhouette:.3f}, combined={score:.3f}")

        if score < best_score:
            best_score = score
            best_k = k

    print(f"  Optimal k={best_k}")
    return best_k


def cluster_papers(
    embeddings: np.ndarray,
    n_clusters: int
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Cluster papers using Gaussian Mixture Model.

    Returns:
        cluster_probabilities: (n_papers, n_clusters) matrix of membership probabilities
        cluster_centers: (n_clusters, 384) matrix of cluster centroids
    """
    from sklearn.mixture import GaussianMixture

    print(f"Clustering {len(embeddings)} papers into {n_clusters} clusters...")

    gmm = GaussianMixture(
        n_components=n_clusters,
        covariance_type='spherical',
        random_state=42,
        n_init=5,
        max_iter=200
    )

    gmm.fit(embeddings)

    # Soft assignments (probabilities for each cluster)
    cluster_probabilities = gmm.predict_proba(embeddings)

    # Cluster centers (means)
    cluster_centers = gmm.means_

    return cluster_probabilities, cluster_centers


def compute_soft_assignments(
    paper_embeddings: List[PaperEmbedding],
    cluster_probabilities: np.ndarray,
    threshold: float = 0.1
) -> List[ClusterAssignment]:
    """
    Generate multi-cluster assignments for each paper.
    Papers can belong to multiple clusters if probability > threshold.
    """
    print(f"Computing soft assignments (threshold={threshold})...")

    assignments = []
    multi_cluster_count = 0

    for i, paper in enumerate(paper_embeddings):
        probs = cluster_probabilities[i]
        primary_cluster = int(np.argmax(probs))

        clusters_assigned = 0
        for cluster_id, prob in enumerate(probs):
            if prob >= threshold:
                assignments.append(ClusterAssignment(
                    paper_id=paper.paper_id,
                    cluster_id=cluster_id,
                    confidence=float(prob),
                    is_primary=(cluster_id == primary_cluster)
                ))
                clusters_assigned += 1

        if clusters_assigned > 1:
            multi_cluster_count += 1

    print(f"  Total assignments: {len(assignments)}")
    print(f"  Papers with multiple clusters: {multi_cluster_count}")
    return assignments


def compute_2d_positions(
    cluster_centers: np.ndarray,
    paper_embeddings: np.ndarray
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute 2D positions for clusters and papers using UMAP (preferred) or PCA (fallback).

    Returns:
        cluster_positions: (n_clusters, 2) - cluster bubble centers
        paper_positions: (n_papers, 2) - individual paper positions
    """
    # Combine cluster centers with paper embeddings for joint embedding
    all_embeddings = np.vstack([cluster_centers, paper_embeddings])
    n_clusters = cluster_centers.shape[0]

    # Try UMAP first (best for preserving cluster structure)
    try:
        import umap
        print("Computing 2D positions with UMAP...")
        reducer = umap.UMAP(
            n_components=2,
            n_neighbors=min(15, len(all_embeddings) - 1),
            min_dist=0.1,
            metric='cosine',
            random_state=42
        )
        positions_2d = reducer.fit_transform(all_embeddings)
    except ImportError:
        # Fall back to PCA (faster, no extra dependencies)
        from sklearn.decomposition import PCA
        print("  UMAP not installed, using PCA for 2D positioning...")
        print("  (Install umap-learn for better cluster separation: brew install cmake && pip install umap-learn)")
        reducer = PCA(n_components=2, random_state=42)
        positions_2d = reducer.fit_transform(all_embeddings)

    # Split back
    cluster_positions = positions_2d[:n_clusters]
    paper_positions = positions_2d[n_clusters:]

    # Normalize to 0-1 range
    min_vals = positions_2d.min(axis=0)
    max_vals = positions_2d.max(axis=0)
    range_vals = max_vals - min_vals
    range_vals[range_vals == 0] = 1  # Avoid division by zero

    cluster_positions = (cluster_positions - min_vals) / range_vals
    paper_positions = (paper_positions - min_vals) / range_vals

    print(f"  Computed positions for {n_clusters} clusters and {len(paper_positions)} papers")
    return cluster_positions, paper_positions


def generate_cluster_labels(
    cluster_id: int,
    cluster_papers: List[PaperEmbedding],
    model_name: str = GEMINI_MODEL
) -> Dict[str, Any]:
    """Generate descriptive label for a cluster using Gemini."""
    try:
        import google.generativeai as genai
    except ImportError:
        print(f"  WARNING: google-generativeai not installed. Using placeholder for cluster {cluster_id}.")
        return {
            "label": f"Cluster {cluster_id}",
            "description": "Cluster description pending.",
            "keywords": ["bioelectricity", "research"]
        }

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print(f"  WARNING: GEMINI_API_KEY not set. Using placeholder for cluster {cluster_id}.")
        return {
            "label": f"Cluster {cluster_id}",
            "description": "Cluster description pending.",
            "keywords": ["bioelectricity", "research"]
        }

    genai.configure(api_key=api_key)

    # Build papers info
    papers_info_lines = []
    for i, paper in enumerate(cluster_papers[:5], 1):
        abstract_snippet = (paper.abstract or "")[:300]
        papers_info_lines.append(
            f"{i}. **{paper.title}** ({paper.year or 'N/A'})\n   Abstract: {abstract_snippet}..."
        )

    papers_info = "\n\n".join(papers_info_lines)

    prompt = f"""You are analyzing a cluster of bioelectricity research papers to generate a descriptive label.

## Papers in this cluster (top 5 by membership confidence):
{papers_info}

## Task
Generate a concise, descriptive label for this research cluster. The label should:
1. Be 2-5 words that capture the core theme
2. Be specific enough to distinguish from other clusters
3. Use standard scientific terminology
4. Avoid generic terms like "research" or "studies"

Also provide:
- A 1-sentence description (max 25 words)
- 3-5 keywords that characterize this cluster

## Output Format (JSON only):
{{
  "label": "Membrane Potential Signaling",
  "description": "Research on how voltage gradients across cell membranes control developmental and regenerative processes.",
  "keywords": ["bioelectricity", "Vmem", "ion channels", "morphogenesis", "gap junctions"]
}}

Output ONLY valid JSON, no markdown or preamble."""

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)

        text = response.text.strip()
        # Remove markdown code block if present
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        return json.loads(text)
    except Exception as e:
        print(f"  WARNING: Gemini error for cluster {cluster_id}: {e}")
        return {
            "label": f"Cluster {cluster_id}",
            "description": "Cluster description pending.",
            "keywords": ["bioelectricity", "research"]
        }


def build_cluster_info(
    cluster_centers: np.ndarray,
    cluster_positions: np.ndarray,
    assignments: List[ClusterAssignment],
    paper_embeddings: List[PaperEmbedding],
    skip_labels: bool = False
) -> List[ClusterInfo]:
    """Build cluster metadata including LLM-generated labels."""
    print("Building cluster info...")

    n_clusters = cluster_centers.shape[0]
    paper_by_id = {p.paper_id: p for p in paper_embeddings}

    # Group papers by cluster for labeling
    cluster_papers: Dict[int, List[Tuple[float, PaperEmbedding]]] = {i: [] for i in range(n_clusters)}

    for assignment in assignments:
        paper = paper_by_id.get(assignment.paper_id)
        if paper:
            cluster_papers[assignment.cluster_id].append((assignment.confidence, paper))

    # Sort by confidence
    for cluster_id in cluster_papers:
        cluster_papers[cluster_id].sort(key=lambda x: x[0], reverse=True)

    clusters = []
    for cluster_id in range(n_clusters):
        papers_in_cluster = cluster_papers[cluster_id]
        paper_count = len(papers_in_cluster)
        primary_count = sum(1 for a in assignments if a.cluster_id == cluster_id and a.is_primary)

        # Generate label
        if skip_labels:
            label_info = {
                "label": f"Cluster {cluster_id}",
                "description": "Label generation skipped.",
                "keywords": []
            }
        else:
            top_papers = [p for _, p in papers_in_cluster[:5]]
            print(f"  Generating label for cluster {cluster_id} ({paper_count} papers)...")
            label_info = generate_cluster_labels(cluster_id, top_papers)

        clusters.append(ClusterInfo(
            cluster_id=cluster_id,
            label=label_info["label"],
            description=label_info["description"],
            keywords=label_info.get("keywords", []),
            centroid=cluster_centers[cluster_id],
            position_x=float(cluster_positions[cluster_id][0]),
            position_y=float(cluster_positions[cluster_id][1]),
            paper_count=paper_count,
            primary_paper_count=primary_count
        ))

    return clusters


def save_to_supabase(
    client: Client,
    clusters: List[ClusterInfo],
    assignments: List[ClusterAssignment],
    paper_positions: np.ndarray,
    paper_embeddings: List[PaperEmbedding]
) -> None:
    """Save clustering results to Supabase."""
    print("Saving to Supabase...")

    # Clear existing data
    print("  Clearing existing taxonomy data...")
    client.table("claim_cluster_assignments").delete().neq("id", 0).execute()
    client.table("paper_cluster_assignments").delete().neq("id", 0).execute()
    client.table("taxonomy_clusters").delete().neq("id", 0).execute()

    # Insert clusters
    print(f"  Inserting {len(clusters)} clusters...")
    for cluster in clusters:
        cluster_data = {
            "cluster_id": cluster.cluster_id,
            "label": cluster.label,
            "description": cluster.description,
            "keywords": cluster.keywords,
            "position_x": cluster.position_x,
            "position_y": cluster.position_y,
            # Note: centroid_embedding skipped - column is 384-dim but embeddings are 768-dim
            # TODO: Run migration to update taxonomy_clusters.centroid_embedding to vector(768)
            "paper_count": cluster.paper_count,
            "primary_paper_count": cluster.primary_paper_count,
            "model_used": GEMINI_MODEL
        }
        client.table("taxonomy_clusters").insert(cluster_data).execute()

    # Create paper_id to position mapping
    paper_position_map = {
        paper_embeddings[i].paper_id: paper_positions[i]
        for i in range(len(paper_embeddings))
    }

    # Insert paper assignments in batches
    print(f"  Inserting {len(assignments)} paper assignments...")
    batch_size = 100
    for i in range(0, len(assignments), batch_size):
        batch = assignments[i:i + batch_size]
        batch_data = []
        for assignment in batch:
            pos = paper_position_map.get(assignment.paper_id, np.array([0.5, 0.5]))
            batch_data.append({
                "paper_id": assignment.paper_id,
                "cluster_id": assignment.cluster_id,
                "confidence": assignment.confidence,
                "is_primary": assignment.is_primary,
                "position_x": float(pos[0]),
                "position_y": float(pos[1])
            })

        try:
            client.table("paper_cluster_assignments").insert(batch_data).execute()
        except Exception as e:
            print(f"    Error inserting batch: {e}")
            # Try one by one
            for item in batch_data:
                try:
                    client.table("paper_cluster_assignments").insert(item).execute()
                except Exception as e2:
                    print(f"    Skipping paper {item['paper_id']}: {e2}")

    print("  Done!")


def populate_claim_assignments(client: Client) -> int:
    """
    Populate claim_cluster_assignments by inheriting from paper assignments.
    Claims get the same cluster assignments as their linked papers.
    """
    print("Populating claim cluster assignments...")

    # Get all claims with paper_id
    print("  Fetching claims with paper references...")
    claims_response = (
        client.table("claims")
        .select("id, paper_id")
        .not_.is_("paper_id", "null")
        .execute()
    )

    claims = claims_response.data
    print(f"  Found {len(claims)} claims with paper references")

    if not claims:
        return 0

    # Get paper -> cluster mappings
    print("  Fetching paper cluster assignments...")
    paper_ids = list(set(c["paper_id"] for c in claims if c.get("paper_id")))

    paper_clusters = {}
    batch_size = 100
    for i in range(0, len(paper_ids), batch_size):
        batch = paper_ids[i:i + batch_size]
        response = (
            client.table("paper_cluster_assignments")
            .select("paper_id, cluster_id, confidence")
            .in_("paper_id", batch)
            .execute()
        )
        for row in response.data:
            pid = row["paper_id"]
            if pid not in paper_clusters:
                paper_clusters[pid] = []
            paper_clusters[pid].append({
                "cluster_id": row["cluster_id"],
                "confidence": row["confidence"]
            })

    # Create claim assignments
    print("  Creating claim cluster assignments...")
    assignments = []
    for claim in claims:
        paper_id = claim.get("paper_id")
        if paper_id and paper_id in paper_clusters:
            for pc in paper_clusters[paper_id]:
                assignments.append({
                    "claim_id": claim["id"],
                    "cluster_id": pc["cluster_id"],
                    "source_paper_id": paper_id,
                    "confidence": pc["confidence"]
                })

    print(f"  Inserting {len(assignments)} claim assignments...")
    batch_size = 100
    count = 0
    for i in range(0, len(assignments), batch_size):
        batch = assignments[i:i + batch_size]
        try:
            client.table("claim_cluster_assignments").insert(batch).execute()
            count += len(batch)
        except Exception as e:
            print(f"    Batch error: {e}")

    print(f"  Created {count} claim cluster assignments")
    return count


def main():
    parser = argparse.ArgumentParser(description="Build taxonomy clusters for knowledge cartography")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving to database")
    parser.add_argument("--k", type=int, help="Force specific cluster count (default: auto-detect)")
    parser.add_argument("--skip-labels", action="store_true", help="Skip LLM label generation")
    parser.add_argument("--skip-claims", action="store_true", help="Skip populating claim assignments")
    args = parser.parse_args()

    print("=" * 60)
    print("Building Taxonomy Clusters")
    print("=" * 60)

    # Connect to Supabase
    client = get_supabase_client()

    # Step 1: Fetch paper chunks
    chunks = fetch_paper_chunks(client)
    if not chunks:
        print("ERROR: No paper chunks found in database")
        return 1

    # Get unique paper IDs
    paper_ids = list(set(c["paper_id"] for c in chunks))
    print(f"Found {len(paper_ids)} unique papers")

    # Step 2: Fetch paper metadata
    papers_metadata = fetch_papers_metadata(client, paper_ids)

    # Step 3: Aggregate embeddings
    paper_embeddings = aggregate_paper_embeddings(chunks, papers_metadata)
    if len(paper_embeddings) < MIN_CLUSTERS:
        print(f"ERROR: Need at least {MIN_CLUSTERS} papers, found {len(paper_embeddings)}")
        return 1

    # Build embedding matrix
    embeddings_matrix = np.vstack([p.embedding for p in paper_embeddings])
    print(f"Embedding matrix shape: {embeddings_matrix.shape}")

    # Step 4: Find optimal cluster count
    if args.k:
        n_clusters = args.k
        print(f"Using forced cluster count: {n_clusters}")
    else:
        n_clusters = find_optimal_clusters(embeddings_matrix, MIN_CLUSTERS, MAX_CLUSTERS)

    # Step 5: Cluster papers
    cluster_probabilities, cluster_centers = cluster_papers(embeddings_matrix, n_clusters)

    # Step 6: Compute soft assignments
    assignments = compute_soft_assignments(paper_embeddings, cluster_probabilities, SOFT_ASSIGNMENT_THRESHOLD)

    # Step 7: Compute 2D positions
    cluster_positions, paper_positions = compute_2d_positions(cluster_centers, embeddings_matrix)

    # Step 8: Build cluster info with labels
    clusters = build_cluster_info(
        cluster_centers,
        cluster_positions,
        assignments,
        paper_embeddings,
        skip_labels=args.skip_labels
    )

    # Summary
    print("\n" + "=" * 60)
    print("Cluster Summary")
    print("=" * 60)
    for cluster in clusters:
        print(f"  [{cluster.cluster_id}] {cluster.label}")
        print(f"      {cluster.description}")
        print(f"      Papers: {cluster.paper_count} ({cluster.primary_paper_count} primary)")
        print(f"      Keywords: {', '.join(cluster.keywords)}")
        print()

    # Step 9: Save to database
    if args.dry_run:
        print("DRY RUN: Skipping database save")
    else:
        save_to_supabase(client, clusters, assignments, paper_positions, paper_embeddings)

        # Step 10: Populate claim assignments
        if not args.skip_claims:
            populate_claim_assignments(client)

    print("\nDone!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
