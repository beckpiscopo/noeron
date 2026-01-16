#!/usr/bin/env python3
"""
Update Supabase claims with fixed timing data.

This script:
1. Loads the fixed timing from cache/podcast_lex_325_claims_with_timing.json
2. Updates existing claims in Supabase with the corrected start_ms/end_ms values
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from supabase_client import get_db


def load_timing_data(path: Path) -> Dict[str, Any]:
    """Load the timing data from JSON file."""
    print(f"Loading timing data from: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_timing_lookup(timing_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Build a lookup from claim_text to timing info."""
    lookup = {}
    
    for seg_id, segment in timing_data.get('segments', {}).items():
        for claim in segment.get('claims', []):
            claim_text = claim.get('claim_text', '')
            timing = claim.get('timing', {})
            
            if claim_text and timing.get('start_ms'):
                lookup[claim_text] = {
                    'start_ms': timing.get('start_ms'),
                    'end_ms': timing.get('end_ms'),
                    'position_ratio': timing.get('position_ratio'),
                    'estimation_method': timing.get('estimation_method', 'word_match' if not timing.get('fallback') else 'segment')
                }
    
    return lookup


def update_claims_timing(podcast_id: str, timing_lookup: Dict[str, Dict[str, Any]], dry_run: bool = False):
    """Update claims in Supabase with fixed timing."""
    db = get_db(use_service_key=True)
    
    if not db.test_connection():
        print("❌ Failed to connect to Supabase")
        return
    
    # Get all claims for the episode
    print(f"\nFetching claims for {podcast_id}...")
    claims = db.get_claims_for_episode(podcast_id)
    
    if not claims:
        print("❌ No claims found in Supabase")
        return
    
    print(f"Found {len(claims)} claims in Supabase")
    
    # Track statistics
    updated = 0
    not_found = 0
    already_correct = 0
    
    for claim in claims:
        claim_id = claim['id']
        claim_text = claim.get('claim_text', '')
        current_start_ms = claim.get('start_ms')
        
        # Look up new timing
        if claim_text in timing_lookup:
            new_timing = timing_lookup[claim_text]
            new_start_ms = new_timing['start_ms']
            new_end_ms = new_timing['end_ms']
            
            # Check if update is needed
            if current_start_ms != new_start_ms:
                diff_sec = abs((new_start_ms or 0) - (current_start_ms or 0)) / 1000
                
                if not dry_run:
                    # Update the claim
                    db.update_claim(claim_id, {
                        'start_ms': new_start_ms,
                        'end_ms': new_end_ms
                    })
                
                if diff_sec > 10:  # Only log significant changes
                    old_mins = int((current_start_ms or 0) / 60000)
                    old_secs = int(((current_start_ms or 0) % 60000) / 1000)
                    new_mins = int(new_start_ms / 60000)
                    new_secs = int((new_start_ms % 60000) / 1000)
                    action = "Would update" if dry_run else "Updated"
                    print(f"  {action}: {old_mins:02d}:{old_secs:02d} → {new_mins:02d}:{new_secs:02d} ({diff_sec:+.0f}s) - {claim_text[:40]}...")
                
                updated += 1
            else:
                already_correct += 1
        else:
            not_found += 1
    
    # Print summary
    print(f"\n{'='*60}")
    print("Summary:")
    print(f"  Total claims: {len(claims)}")
    print(f"  Updated: {updated}")
    print(f"  Already correct: {already_correct}")
    print(f"  Not in timing file: {not_found}")
    
    if dry_run:
        print("\n⚠️  DRY RUN - No changes were made to database")
        print("Run without --dry-run to apply changes")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Update Supabase claims with fixed timing')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be updated without making changes')
    parser.add_argument('--podcast-id', default='lex_325', help='Podcast ID to update')
    args = parser.parse_args()
    
    # Paths
    project_root = Path(__file__).parent.parent
    timing_path = project_root / 'cache' / 'podcast_lex_325_claims_with_timing.json'
    
    if not timing_path.exists():
        print(f"❌ Timing file not found: {timing_path}")
        sys.exit(1)
    
    print("=" * 60)
    print("UPDATE SUPABASE CLAIMS WITH FIXED TIMING")
    print("=" * 60)
    print()
    
    # Load timing data
    timing_data = load_timing_data(timing_path)
    timing_lookup = build_timing_lookup(timing_data)
    print(f"Built timing lookup with {len(timing_lookup)} claims")
    
    # Update claims
    update_claims_timing(args.podcast_id, timing_lookup, dry_run=args.dry_run)


if __name__ == '__main__':
    main()






