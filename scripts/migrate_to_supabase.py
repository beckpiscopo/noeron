"""
Migrate existing JSON data to Supabase.

This script:
1. Loads data from context_card_registry.json (claims + paper matches)
2. Loads timing data from podcast_lex_325_claims_with_timing.json
3. Merges the data intelligently
4. Creates episode record in Supabase
5. Imports all claims with their matched papers and timing
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from supabase_client import get_db


def load_context_cards(path: Path) -> Dict[str, Any]:
    """Load claims with paper matches from context_card_registry.json"""
    print(f"Loading context cards from: {path}")
    data = json.loads(path.read_text())
    print(f"  ✓ Loaded {len(data.get('segments', {}))} segments")
    return data


def load_timing_data(path: Path) -> Dict[str, Any]:
    """Load claims with timing from podcast_lex_325_claims_with_timing.json"""
    print(f"Loading timing data from: {path}")
    data = json.loads(path.read_text())
    print(f"  ✓ Loaded {len(data.get('segments', {}))} segments with timing")
    return data


def extract_paper_id_from_url(url: str) -> str:
    """Extract paper ID from Semantic Scholar URL."""
    if "semanticscholar.org/paper/" in url:
        return url.split("/")[-1]
    return url


def migrate_episode(
    podcast_id: str,
    title: str,
    guest_name: Optional[str] = None,
    description: Optional[str] = None
) -> Dict[str, Any]:
    """Create episode record in Supabase."""
    db = get_db(use_service_key=True)
    
    # Check if episode already exists
    existing = db.get_episode(podcast_id)
    if existing:
        print(f"  ⚠️  Episode '{podcast_id}' already exists, skipping...")
        return existing
    
    episode_data = {
        "podcast_id": podcast_id,
        "title": title,
        "guest_name": guest_name,
        "podcast_series": "Lex Fridman Podcast",  # Hardcoded for now
        "description": description,
        "published_date": "2022-07-20",  # Lex #325 publish date - adjust as needed
    }
    
    print(f"  ✓ Creating episode: {title}")
    return db.create_episode(episode_data)


def merge_claim_data(
    context_claim: Dict[str, Any],
    timing_claim: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Merge claim from context_card_registry with timing data."""
    
    # Start with context card data (has paper matches)
    merged = {
        "claim_text": context_claim.get("claim_text", ""),
        "paper_id": extract_paper_id_from_url(context_claim.get("source_link", "")),
        "paper_title": context_claim.get("paper_title"),
        "paper_url": context_claim.get("source_link"),
        "section": context_claim.get("section"),
        "rationale": context_claim.get("rationale"),
        "confidence_score": context_claim.get("confidence_score"),
        "claim_type": context_claim.get("claim_type"),
        "needs_backing_because": context_claim.get("needs_backing_because"),
        "context_tags": context_claim.get("context_tags"),
    }
    
    # Add timing data if available
    if timing_claim:
        timing_info = timing_claim.get("timing", {})
        merged.update({
            "start_ms": timing_info.get("start_ms"),
            "end_ms": timing_info.get("end_ms"),
            "speaker_stance": timing_claim.get("speaker_stance"),
        })
    
    # Generate timestamp from start_ms
    if merged.get("start_ms"):
        ms = merged["start_ms"]
        hours = ms // 3600000
        minutes = (ms % 3600000) // 60000
        seconds = (ms % 60000) // 1000
        merged["timestamp"] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    else:
        # Fallback to segment timestamp
        merged["timestamp"] = context_claim.get("timestamp", "00:00:00")
    
    return merged


def migrate_claims_for_episode(
    podcast_id: str,
    context_data: Dict[str, Any],
    timing_data: Optional[Dict[str, Any]] = None
) -> int:
    """
    Migrate all claims for an episode to Supabase.
    
    Returns number of claims migrated.
    """
    db = get_db(use_service_key=True)
    
    context_segments = context_data.get("segments", {})
    timing_segments = timing_data.get("segments", {}) if timing_data else {}
    
    # Build timing lookup by claim text
    timing_by_text = {}
    for seg_id, segment in timing_segments.items():
        for claim in segment.get("claims", []):
            claim_text = claim.get("claim_text", "")
            if claim_text:
                timing_by_text[claim_text] = claim
    
    print(f"\n  Building claim records...")
    print(f"  Context segments: {len(context_segments)}")
    print(f"  Timing lookup: {len(timing_by_text)} claims")
    
    # Collect all claims
    claims_to_insert = []
    
    for seg_id, segment in context_segments.items():
        # Handle both formats:
        # - context_card_registry has "rag_results"
        # - other files might have "claims"
        raw_claims = segment.get("rag_results", segment.get("claims", []))
        
        for claim in raw_claims:
            # Skip if not a dict (might be just a string in some formats)
            if not isinstance(claim, dict):
                continue
            
            claim_text = claim.get("claim_text", "")
            if not claim_text:
                continue
            
            # Look up timing data
            timing_claim = timing_by_text.get(claim_text)
            
            # Merge data
            merged_claim = merge_claim_data(claim, timing_claim)
            merged_claim["podcast_id"] = podcast_id
            
            claims_to_insert.append(merged_claim)
    
    # Batch insert
    if claims_to_insert:
        print(f"  ✓ Inserting {len(claims_to_insert)} claims...")
        
        # Insert in batches of 100 (Supabase limit)
        batch_size = 100
        for i in range(0, len(claims_to_insert), batch_size):
            batch = claims_to_insert[i:i+batch_size]
            db.create_claims_batch(batch)
            print(f"    Inserted batch {i//batch_size + 1} ({len(batch)} claims)")
        
        print(f"  ✓ Successfully inserted {len(claims_to_insert)} claims")
    else:
        print(f"  ⚠️  No claims found to insert")
    
    return len(claims_to_insert)


def main():
    """Main migration script."""
    print("=" * 80)
    print("NOERON DATA MIGRATION TO SUPABASE")
    print("=" * 80)
    
    # Paths
    repo_root = Path(__file__).parent.parent
    context_path = repo_root / "data" / "context_card_registry.json"
    timing_path = repo_root / "cache" / "podcast_lex_325_claims_with_timing.json"
    
    # Validate files exist
    if not context_path.exists():
        print(f"✗ Error: {context_path} not found")
        sys.exit(1)
    
    # Load data
    context_data = load_context_cards(context_path)
    timing_data = None
    if timing_path.exists():
        timing_data = load_timing_data(timing_path)
    else:
        print(f"  ⚠️  No timing data found at {timing_path}, continuing without it")
    
    # Migrate episode
    print("\n" + "-" * 80)
    print("Step 1: Creating Episode Record")
    print("-" * 80)
    
    episode = migrate_episode(
        podcast_id="lex_325",
        title="Lex Fridman #325 - Michael Levin: Biology, Life, Aliens, Evolution, Embryogenesis & Xenobots",
        guest_name="Michael Levin",
        description="Michael Levin is a biologist at Tufts University researching regenerative biology and bioelectricity."
    )
    
    # Migrate claims
    print("\n" + "-" * 80)
    print("Step 2: Migrating Claims")
    print("-" * 80)
    
    num_claims = migrate_claims_for_episode("lex_325", context_data, timing_data)
    
    # Summary
    print("\n" + "=" * 80)
    print("MIGRATION COMPLETE")
    print("=" * 80)
    print(f"Episode: {episode['title']}")
    print(f"Claims imported: {num_claims}")
    
    # Get stats
    db = get_db(use_service_key=True)
    stats = db.get_episode_stats("lex_325")
    if stats:
        print(f"\nEpisode Statistics:")
        print(f"  Total claims: {stats.get('total_claims', 0)}")
        print(f"  With paper matches: {stats.get('matched_count', 0)}")
        print(f"  Distilled: {stats.get('distilled_count', 0)}")
        print(f"  Avg confidence: {stats.get('avg_confidence', 0):.2f}")
    
    print("\n" + "=" * 80)
    print("Next steps:")
    print("1. Run: python3 scripts/enrich_with_distillation_supabase.py")
    print("2. Update frontend to query Supabase")
    print("3. Add new episodes with: python3 scripts/add_episode.py")
    print("=" * 80)


if __name__ == "__main__":
    main()



