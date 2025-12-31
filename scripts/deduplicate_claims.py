#!/usr/bin/env python3
"""
Deduplicate claims in Supabase database.

Removes duplicate claims that have:
- Same podcast_id
- Same or very similar start_ms (within 2 seconds)
- Similar claim text (first 30 chars match)

Keeps the "best" version:
- Prioritize claims with distilled_claim
- If both/neither have distilled, keep the one with longer claim_text
"""

from collections import defaultdict
from typing import List, Dict, Any
from supabase_client import get_db

def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    if not text:
        return ""
    return text.lower().strip()[:50]  # First 50 chars

def find_duplicates(claims: List[Dict[str, Any]]) -> Dict[int, List[Dict[str, Any]]]:
    """
    Group duplicate claims together.
    Returns dict mapping to list of duplicate claims.
    """
    # Group by time window (round to nearest 2 seconds)
    time_groups = defaultdict(list)
    
    for claim in claims:
        start_ms = claim.get('start_ms')
        if start_ms is None or start_ms == 0:
            continue
        
        # Round to nearest 2 second window
        time_bucket = (int(start_ms) // 2000) * 2000
        time_groups[time_bucket].append(claim)
    
    # Within each time bucket, find text duplicates
    duplicate_groups = {}
    group_id = 0
    
    for time_bucket, bucket_claims in time_groups.items():
        if len(bucket_claims) <= 1:
            continue
        
        # Group by similar text
        text_groups = defaultdict(list)
        for claim in bucket_claims:
            # Get display text
            text = claim.get('distilled_claim') or claim.get('claim_text', '')
            normalized = normalize_text(text)
            text_groups[normalized].append(claim)
        
        # Only keep groups with actual duplicates
        for normalized_text, group_claims in text_groups.items():
            if len(group_claims) > 1:
                duplicate_groups[group_id] = group_claims
                group_id += 1
    
    return duplicate_groups

def select_best_claim(claims: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Select the best claim from a group of duplicates.
    Priority:
    1. Has distilled_claim (prefer longer distilled_word_count)
    2. Has longer claim_text
    3. First one (by ID)
    """
    # Sort by quality
    def quality_score(claim):
        score = 0
        if claim.get('distilled_claim'):
            score += 1000
            score += claim.get('distilled_word_count', 0)
        score += len(claim.get('claim_text', '')) // 10
        return score
    
    sorted_claims = sorted(claims, key=quality_score, reverse=True)
    return sorted_claims[0]

def main(podcast_id: str = 'lex_325', dry_run: bool = True):
    """
    Main deduplication function.
    
    Args:
        podcast_id: Episode to deduplicate
        dry_run: If True, only report duplicates without deleting
    """
    db = get_db(use_service_key=True)
    
    print(f"📊 Analyzing claims for {podcast_id}...")
    
    # Get all claims
    claims = db.get_claims_for_episode(podcast_id)
    print(f"   Found {len(claims)} total claims")
    
    # Find duplicates
    duplicate_groups = find_duplicates(claims)
    
    if not duplicate_groups:
        print("✅ No duplicates found!")
        return
    
    print(f"\n🔍 Found {len(duplicate_groups)} duplicate groups:")
    
    total_duplicates = 0
    claims_to_delete = []
    claims_to_keep = []
    
    for group_id, group_claims in duplicate_groups.items():
        # Get display info
        first_claim = group_claims[0]
        start_ms = first_claim.get('start_ms', 0)
        timestamp = f"{start_ms/1000:.1f}s"
        
        # Select best
        best = select_best_claim(group_claims)
        to_delete = [c for c in group_claims if c['id'] != best['id']]
        
        print(f"\n  Group {group_id + 1} @ {timestamp} ({len(group_claims)} duplicates):")
        
        for i, claim in enumerate(group_claims):
            text = claim.get('distilled_claim') or claim.get('claim_text', '')[:60]
            is_best = claim['id'] == best['id']
            marker = "✓ KEEP" if is_best else "✗ DELETE"
            distilled = "📝" if claim.get('distilled_claim') else ""
            
            print(f"    {marker} [{claim['id']}] {distilled} {text}...")
            
            if not is_best:
                claims_to_delete.append(claim['id'])
        
        claims_to_keep.append(best['id'])
        total_duplicates += len(to_delete)
    
    print(f"\n📈 Summary:")
    print(f"   Total duplicate groups: {len(duplicate_groups)}")
    print(f"   Claims to keep: {len(claims_to_keep)}")
    print(f"   Claims to delete: {total_duplicates}")
    print(f"   Final claim count: {len(claims) - total_duplicates}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN - No changes made")
        print(f"   Run with --execute to actually delete duplicates")
    else:
        print(f"\n🗑️  Deleting {total_duplicates} duplicate claims...")
        
        # Delete in batches
        batch_size = 50
        for i in range(0, len(claims_to_delete), batch_size):
            batch = claims_to_delete[i:i+batch_size]
            
            # Delete from database
            for claim_id in batch:
                try:
                    db.client.table('claims').delete().eq('id', claim_id).execute()
                except Exception as e:
                    print(f"   ❌ Error deleting claim {claim_id}: {e}")
            
            print(f"   Deleted {min(i+batch_size, len(claims_to_delete))}/{len(claims_to_delete)} duplicates...")
        
        print(f"\n✅ Deduplication complete!")
        print(f"   Removed {total_duplicates} duplicate claims")
        print(f"   {len(claims) - total_duplicates} claims remaining")

if __name__ == "__main__":
    import sys
    
    # Parse arguments
    dry_run = '--execute' not in sys.argv
    podcast_id = 'lex_325'
    
    # Check for custom podcast_id
    for arg in sys.argv:
        if arg.startswith('--podcast-id='):
            podcast_id = arg.split('=')[1]
    
    if dry_run:
        print("🔍 RUNNING IN DRY-RUN MODE")
        print("   This will analyze duplicates without deleting anything")
        print("   Use --execute to actually remove duplicates\n")
    else:
        print("⚠️  EXECUTING DELETION MODE")
        print("   This will permanently delete duplicate claims!")
        response = input("   Are you sure? Type 'yes' to continue: ")
        if response.lower() != 'yes':
            print("   Cancelled.")
            sys.exit(0)
        print()
    
    main(podcast_id=podcast_id, dry_run=dry_run)

