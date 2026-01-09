#!/usr/bin/env python3
"""
Semantic Claim Deduplication Tool

Identifies semantically similar claims using embeddings (all-MiniLM-L6-v2)
and allows manual selection of which variant to keep.

Usage:
    # Detection only - see how many duplicates exist
    python scripts/semantic_dedupe_claims.py --episode lex_325 --detect-only

    # Interactive selection (dry run)
    python scripts/semantic_dedupe_claims.py --episode lex_325

    # Execute changes
    python scripts/semantic_dedupe_claims.py --episode lex_325 --execute

    # Adjust thresholds
    python scripts/semantic_dedupe_claims.py --episode lex_325 \
        --similarity-threshold 0.85 --temporal-window 180000
"""

import argparse
import sys
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from supabase_client import get_db

# =============================================================================
# Configuration
# =============================================================================

DEFAULT_CONFIG = {
    "similarity_threshold": 0.80,      # Cosine similarity cutoff
    "temporal_window_ms": 180000,      # 3 minutes in milliseconds
    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
    "embedding_dim": 384,
}


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class DuplicateGroup:
    """A group of semantically duplicate claims."""
    claims: List[Dict[str, Any]]
    similarity_scores: Dict[Tuple[int, int], float] = field(default_factory=dict)
    suggested_keeper_id: Optional[int] = None

    def __post_init__(self):
        if self.suggested_keeper_id is None and self.claims:
            self.suggested_keeper_id = suggest_best_claim(self.claims)


@dataclass
class SelectionDecision:
    """Record of a user's selection decision."""
    group_claims: List[int]      # All claim IDs in group
    keeper_id: int               # ID of claim to keep
    duplicate_ids: List[int]     # IDs marked as duplicates
    was_auto: bool               # True if auto-selected


# =============================================================================
# Phase 1: Detection
# =============================================================================

def load_claims(db, podcast_id: str) -> List[Dict[str, Any]]:
    """Load all claims for an episode from Supabase."""
    claims = db.get_claims_for_episode(podcast_id)
    # Filter out claims already marked as duplicates
    active_claims = [c for c in claims if c.get('duplicate_of') is None]
    return active_claims


def generate_embeddings(claims: List[Dict[str, Any]], model: SentenceTransformer) -> np.ndarray:
    """Generate 384-dim embeddings for all claim_text values."""
    texts = [c.get('claim_text', '') or '' for c in claims]
    embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    return embeddings


def compute_similarity_matrix(embeddings: np.ndarray) -> np.ndarray:
    """Compute pairwise cosine similarity."""
    return cosine_similarity(embeddings)


def find_duplicate_pairs(
    claims: List[Dict[str, Any]],
    similarity_matrix: np.ndarray,
    similarity_threshold: float = 0.80,
    temporal_window_ms: int = 180000
) -> List[Tuple[int, int, float]]:
    """
    Find pairs of claims exceeding similarity threshold within temporal window.

    Returns:
        List of (claim_idx_1, claim_idx_2, similarity_score)
    """
    pairs = []
    n = len(claims)

    for i in range(n):
        for j in range(i + 1, n):
            sim = similarity_matrix[i, j]

            if sim < similarity_threshold:
                continue

            # Check temporal proximity
            start_i = claims[i].get('start_ms') or 0
            start_j = claims[j].get('start_ms') or 0

            time_diff = abs(start_i - start_j)

            if time_diff <= temporal_window_ms:
                pairs.append((i, j, float(sim)))

    return pairs


def cluster_duplicates(
    pairs: List[Tuple[int, int, float]],
    num_claims: int,
    claims: List[Dict[str, Any]]
) -> List[DuplicateGroup]:
    """
    Use Union-Find to group connected duplicate pairs into clusters.

    Returns:
        List of DuplicateGroup objects
    """
    # Union-Find implementation
    parent = list(range(num_claims))

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])  # Path compression
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    # Union all pairs
    for i, j, _ in pairs:
        union(i, j)

    # Group by root
    groups = defaultdict(list)
    for idx in range(num_claims):
        root = find(idx)
        groups[root].append(idx)

    # Build DuplicateGroup objects (only groups with 2+ members)
    similarity_lookup = {(i, j): sim for i, j, sim in pairs}
    similarity_lookup.update({(j, i): sim for i, j, sim in pairs})

    result = []
    for root, indices in groups.items():
        if len(indices) > 1:
            group_claims = [claims[idx] for idx in indices]

            # Get similarity scores between group members
            group_sims = {}
            for a in indices:
                for b in indices:
                    if a < b and (a, b) in similarity_lookup:
                        id_a = claims[a]['id']
                        id_b = claims[b]['id']
                        group_sims[(id_a, id_b)] = similarity_lookup[(a, b)]

            result.append(DuplicateGroup(
                claims=group_claims,
                similarity_scores=group_sims
            ))

    return result


# =============================================================================
# Quality Scoring
# =============================================================================

def score_claim_quality(claim: Dict[str, Any]) -> float:
    """
    Score a claim for quality/completeness.

    Factors (from existing deduplicate_claims.py pattern):
    - Has distilled_claim (+1000)
    - distilled_word_count (weighted)
    - Has paper_title match (+50)
    - confidence_score (weighted * 100)
    - claim_text length (log scale)
    """
    score = 0

    if claim.get('distilled_claim'):
        score += 1000
        score += claim.get('distilled_word_count', 0) * 10

    if claim.get('paper_title'):
        score += 50

    conf = claim.get('confidence_score') or 0
    score += conf * 100

    text_len = len(claim.get('claim_text', '') or '')
    score += text_len // 10

    return score


def suggest_best_claim(claims: List[Dict[str, Any]]) -> int:
    """
    Auto-suggest which claim to keep based on quality scoring.

    Returns:
        claim ID of suggested claim
    """
    if not claims:
        return None

    best = max(claims, key=score_claim_quality)
    return best['id']


# =============================================================================
# Phase 2: CLI Selection Interface
# =============================================================================

def format_timestamp(ms: int) -> str:
    """Convert milliseconds to HH:MM:SS format."""
    if not ms:
        return "??:??"

    seconds = ms // 1000
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def truncate_text(text: str, max_len: int = 80) -> str:
    """Truncate text with ellipsis."""
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def format_claim_for_display(
    claim: Dict[str, Any],
    index: int,
    is_suggested: bool = False
) -> str:
    """Format a single claim for terminal display."""
    claim_id = claim.get('id', '?')
    timestamp = format_timestamp(claim.get('start_ms'))
    text = truncate_text(claim.get('claim_text', ''), 70)
    conf = claim.get('confidence_score', 0) or 0
    paper = claim.get('paper_title', '')
    has_distilled = bool(claim.get('distilled_claim'))

    marker = " *" if is_suggested else "  "
    distilled_icon = " [D]" if has_distilled else "    "
    paper_short = truncate_text(paper, 30) if paper else "(no paper)"

    line1 = f"{marker}[{index}] ID: {claim_id} @ {timestamp}{distilled_icon}"
    line2 = f"      \"{text}\""
    line3 = f"      Conf: {conf:.2f} | Paper: {paper_short}"

    return f"{line1}\n{line2}\n{line3}"


def display_duplicate_group(
    group: DuplicateGroup,
    group_number: int,
    total_groups: int
) -> None:
    """Display a duplicate group in the terminal."""
    print()
    print("=" * 80)
    print(f"GROUP {group_number} OF {total_groups} - Review Duplicates")
    print("=" * 80)

    # Compute similarity range
    if group.similarity_scores:
        sims = list(group.similarity_scores.values())
        sim_min, sim_max = min(sims), max(sims)
        print(f"Similarity range: {sim_min:.2f} - {sim_max:.2f}")

    # Compute temporal span
    times = [c.get('start_ms', 0) for c in group.claims if c.get('start_ms')]
    if times:
        span = (max(times) - min(times)) // 1000
        print(f"Temporal span: {format_timestamp(min(times))} - {format_timestamp(max(times))} ({span}s)")

    print()

    for i, claim in enumerate(group.claims, 1):
        is_suggested = claim['id'] == group.suggested_keeper_id
        print(format_claim_for_display(claim, i, is_suggested))
        print()

    if group.suggested_keeper_id:
        print(f"  * = SUGGESTED (highest quality score)")


def prompt_user_selection(
    group: DuplicateGroup,
    group_number: int,
    total_groups: int
) -> Optional[SelectionDecision]:
    """
    Interactive CLI prompt for user to select which claim to keep.

    Options:
    - [1-N]: Select specific claim by number
    - [s]: Skip this group (handle later)
    - [a]: Auto-select suggested claim
    - [q]: Quit and save progress

    Returns:
        SelectionDecision or None if skipped
    """
    n_claims = len(group.claims)

    while True:
        print("-" * 80)
        prompt = f"Select claim to KEEP: [1-{n_claims}], [s]kip, [a]uto, [q]uit: "

        try:
            choice = input(prompt).strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nQuitting...")
            raise SystemExit(0)

        if choice == 'q':
            print("\nQuitting...")
            raise SystemExit(0)

        if choice == 's':
            return None  # Skip

        if choice == 'a':
            # Auto-select suggested
            keeper_id = group.suggested_keeper_id
            all_ids = [c['id'] for c in group.claims]
            duplicate_ids = [cid for cid in all_ids if cid != keeper_id]

            return SelectionDecision(
                group_claims=all_ids,
                keeper_id=keeper_id,
                duplicate_ids=duplicate_ids,
                was_auto=True
            )

        # Try to parse as number
        try:
            num = int(choice)
            if 1 <= num <= n_claims:
                selected_claim = group.claims[num - 1]
                keeper_id = selected_claim['id']
                all_ids = [c['id'] for c in group.claims]
                duplicate_ids = [cid for cid in all_ids if cid != keeper_id]

                return SelectionDecision(
                    group_claims=all_ids,
                    keeper_id=keeper_id,
                    duplicate_ids=duplicate_ids,
                    was_auto=False
                )
            else:
                print(f"  Invalid: choose 1-{n_claims}")
        except ValueError:
            print(f"  Invalid input. Enter 1-{n_claims}, 's', 'a', or 'q'")


# =============================================================================
# Phase 3: Resolution
# =============================================================================

def update_supabase_claims(
    db,
    decisions: List[SelectionDecision],
    dry_run: bool = True
) -> Dict[str, int]:
    """
    Add duplicate_of field to Supabase claims table.

    Returns:
        Count of updated records
    """
    total_updated = 0

    for decision in decisions:
        for dup_id in decision.duplicate_ids:
            if dry_run:
                print(f"  [DRY RUN] Would mark claim {dup_id} as duplicate_of {decision.keeper_id}")
            else:
                try:
                    db.update_claim(dup_id, {"duplicate_of": decision.keeper_id})
                    total_updated += 1
                except Exception as e:
                    print(f"  Error updating claim {dup_id}: {e}")

    return {"updated": total_updated}


def generate_report(
    decisions: List[SelectionDecision],
    skipped_groups: int,
    total_claims: int
) -> str:
    """Generate summary report of deduplication actions."""
    lines = [
        "",
        "=" * 80,
        "DEDUPLICATION SUMMARY",
        "=" * 80,
        f"Total claims analyzed:    {total_claims}",
        f"Duplicate groups found:   {len(decisions) + skipped_groups}",
        f"Groups resolved:          {len(decisions)}",
        f"Groups skipped:           {skipped_groups}",
    ]

    if decisions:
        total_dups = sum(len(d.duplicate_ids) for d in decisions)
        auto_count = sum(1 for d in decisions if d.was_auto)
        manual_count = len(decisions) - auto_count

        lines.extend([
            f"Claims marked duplicate:  {total_dups}",
            f"Auto-selected:            {auto_count}",
            f"Manually selected:        {manual_count}",
            f"Final active claims:      {total_claims - total_dups}",
        ])

    lines.append("=" * 80)
    return "\n".join(lines)


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Semantic claim deduplication tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "--episode", "-e",
        required=True,
        help="Podcast ID (e.g., lex_325)"
    )
    parser.add_argument(
        "--similarity-threshold", "-t",
        type=float,
        default=DEFAULT_CONFIG["similarity_threshold"],
        help=f"Cosine similarity threshold (default: {DEFAULT_CONFIG['similarity_threshold']})"
    )
    parser.add_argument(
        "--temporal-window", "-w",
        type=int,
        default=DEFAULT_CONFIG["temporal_window_ms"],
        help=f"Max time between duplicates in ms (default: {DEFAULT_CONFIG['temporal_window_ms']})"
    )
    parser.add_argument(
        "--detect-only", "-d",
        action="store_true",
        help="Only run detection phase, output report"
    )
    parser.add_argument(
        "--auto", "-a",
        action="store_true",
        help="Auto-select suggested claims without prompts"
    )
    parser.add_argument(
        "--execute", "-x",
        action="store_true",
        help="Actually make changes (default is dry run)"
    )

    args = parser.parse_args()

    # Mode banner
    if args.execute:
        print("=" * 80)
        print("EXECUTING - Changes will be made to the database!")
        print("=" * 80)
        if not args.auto and not args.detect_only:
            confirm = input("Are you sure? Type 'yes' to continue: ")
            if confirm.lower() != 'yes':
                print("Cancelled.")
                return
    else:
        print("=" * 80)
        print("DRY RUN MODE - No changes will be made")
        print("Use --execute to make actual changes")
        print("=" * 80)

    print()

    # -------------------------------------------------------------------------
    # Detection Phase
    # -------------------------------------------------------------------------
    print("PHASE 1: DETECTION")
    print("-" * 80)

    print(f"Episode: {args.episode}")
    print(f"Similarity threshold: {args.similarity_threshold}")
    print(f"Temporal window: {args.temporal_window // 1000}s ({args.temporal_window}ms)")
    print()

    # Connect to database
    print("Connecting to Supabase...", end=" ", flush=True)
    db = get_db(use_service_key=True)
    print("done")

    # Load claims
    print("Loading claims...", end=" ", flush=True)
    claims = load_claims(db, args.episode)
    print(f"{len(claims)} claims")

    if not claims:
        print("No claims found for this episode.")
        return

    # Generate embeddings
    print("Loading embedding model...", end=" ", flush=True)
    model = SentenceTransformer(DEFAULT_CONFIG["embedding_model"])
    print("done")

    print("Generating embeddings...")
    embeddings = generate_embeddings(claims, model)

    # Compute similarity
    print("Computing similarity matrix...", end=" ", flush=True)
    sim_matrix = compute_similarity_matrix(embeddings)
    print("done")

    # Find duplicate pairs
    print("Finding duplicate pairs...", end=" ", flush=True)
    pairs = find_duplicate_pairs(
        claims,
        sim_matrix,
        similarity_threshold=args.similarity_threshold,
        temporal_window_ms=args.temporal_window
    )
    print(f"{len(pairs)} pairs")

    if not pairs:
        print()
        print("No semantic duplicates found within the temporal window.")
        print("Try lowering --similarity-threshold or increasing --temporal-window")
        return

    # Cluster into groups
    print("Clustering into groups...", end=" ", flush=True)
    groups = cluster_duplicates(pairs, len(claims), claims)
    print(f"{len(groups)} groups")

    # Display detection summary
    print()
    print("-" * 80)
    print("DUPLICATE GROUPS DETECTED")
    print("-" * 80)

    for i, group in enumerate(groups, 1):
        sims = list(group.similarity_scores.values()) if group.similarity_scores else [0]
        print(f"\nGroup {i} ({len(group.claims)} claims, similarity: {min(sims):.2f}-{max(sims):.2f}):")
        for claim in group.claims:
            text = truncate_text(claim.get('claim_text', ''), 60)
            ts = format_timestamp(claim.get('start_ms'))
            marker = "  " if claim['id'] != group.suggested_keeper_id else " *"
            print(f"  {marker}[{claim['id']}] @ {ts}: {text}")

    # Detection summary
    claims_involved = sum(len(g.claims) for g in groups)
    potential_reduction = claims_involved - len(groups)

    print()
    print("-" * 80)
    print("DETECTION SUMMARY")
    print("-" * 80)
    print(f"Total claims analyzed:     {len(claims)}")
    print(f"Duplicate groups found:    {len(groups)}")
    print(f"Claims involved:           {claims_involved}")
    print(f"Potential reduction:       {potential_reduction} claims ({100*potential_reduction/len(claims):.1f}%)")

    if args.detect_only:
        print()
        print("Detection complete. Run without --detect-only to resolve duplicates.")
        return

    # -------------------------------------------------------------------------
    # Selection Phase
    # -------------------------------------------------------------------------
    print()
    print("=" * 80)
    print("PHASE 2: SELECTION")
    print("=" * 80)

    decisions = []
    skipped = 0

    for i, group in enumerate(groups, 1):
        if args.auto:
            # Auto-select
            keeper_id = group.suggested_keeper_id
            all_ids = [c['id'] for c in group.claims]
            duplicate_ids = [cid for cid in all_ids if cid != keeper_id]

            decision = SelectionDecision(
                group_claims=all_ids,
                keeper_id=keeper_id,
                duplicate_ids=duplicate_ids,
                was_auto=True
            )
            decisions.append(decision)
            print(f"Group {i}: Auto-selected claim {keeper_id}")
        else:
            display_duplicate_group(group, i, len(groups))
            decision = prompt_user_selection(group, i, len(groups))

            if decision:
                decisions.append(decision)
                print(f"\n  Selected claim {decision.keeper_id} to keep")
            else:
                skipped += 1
                print(f"\n  Skipped group {i}")

    # -------------------------------------------------------------------------
    # Resolution Phase
    # -------------------------------------------------------------------------
    if decisions:
        print()
        print("=" * 80)
        print("PHASE 3: RESOLUTION")
        print("=" * 80)

        result = update_supabase_claims(db, decisions, dry_run=not args.execute)

        if args.execute:
            print(f"\nUpdated {result['updated']} claims in database")
        else:
            total_would_update = sum(len(d.duplicate_ids) for d in decisions)
            print(f"\n[DRY RUN] Would update {total_would_update} claims")

    # Final report
    print(generate_report(decisions, skipped, len(claims)))


if __name__ == "__main__":
    main()
