#!/usr/bin/env python3
"""
Find and remove claims that have the same claim_text (original transcript quote)
but different distilled_claim variations.

Keeps the "best" distilled version (longest and most descriptive).
"""

from collections import defaultdict
from supabase_client import get_db

def find_duplicate_claim_texts(podcast_id: str = 'lex_325'):
    """Find claims with identical claim_text but different distilled versions."""
    db = get_db(use_service_key=True)
    
    print(f"🔍 Analyzing claims for duplicate quote texts in {podcast_id}...")
    
    claims = db.get_claims_for_episode(podcast_id)
    print(f"   Total claims: {len(claims)}")
    
    # Group by claim_text (the original transcript quote)
    by_text = defaultdict(list)
    
    for claim in claims:
        text = claim.get('claim_text', '').strip()
        if text:  # Only process non-empty texts
            by_text[text].append(claim)
    
    # Find groups with multiple claims
    duplicates = {text: claims for text, claims in by_text.items() if len(claims) > 1}
    
    if not duplicates:
        print("✅ No duplicate claim_text found!")
        return []
    
    print(f"\n🔍 Found {len(duplicates)} claim texts with multiple versions:\n")
    
    groups_to_process = []
    
    for text, group_claims in duplicates.items():
        # Check if they have different distilled versions
        distilled_versions = [c.get('distilled_claim', '') for c in group_claims]
        unique_distilled = set(d for d in distilled_versions if d)
        
        if len(unique_distilled) > 1:
            # Multiple different distilled versions
            print(f"📝 Quote: \"{text[:80]}...\"")
            print(f"   {len(group_claims)} claims, {len(unique_distilled)} different distilled versions:")
            
            for claim in group_claims:
                claim_id = claim['id']
                distilled = claim.get('distilled_claim', '[no distillation]')
                start_ms = claim.get('start_ms') or 0
                timestamp = f"{start_ms/1000:.1f}s" if start_ms else "0.0s"
                word_count = claim.get('distilled_word_count', 0)
                
                print(f"     [{claim_id}] @ {timestamp} ({word_count}w): {distilled}")
            
            print()
            groups_to_process.append((text, group_claims))
    
    return groups_to_process

def select_best_distilled_claim(claims):
    """Select the best claim from a group with same claim_text."""
    # Sort by quality
    def quality_score(claim):
        score = 0
        
        # Prefer claims with distilled_claim
        if claim.get('distilled_claim'):
            score += 1000
            # Prefer longer distilled claims (more descriptive)
            score += claim.get('distilled_word_count', 0) * 10
            # Slight bonus for longer distilled text
            score += len(claim.get('distilled_claim', ''))
        
        # Prefer claims with paper matches
        if claim.get('paper_title'):
            score += 50
        
        return score
    
    sorted_claims = sorted(claims, key=quality_score, reverse=True)
    return sorted_claims[0]

def main(podcast_id: str = 'lex_325', dry_run: bool = True):
    """Main deduplication by claim_text."""
    duplicate_groups = find_duplicate_claim_texts(podcast_id)
    
    if not duplicate_groups:
        return
    
    print(f"\n📊 Summary:")
    print(f"   Found {len(duplicate_groups)} groups with different distilled versions")
    
    claims_to_delete = []
    claims_to_keep = []
    
    for text, group_claims in duplicate_groups:
        best = select_best_distilled_claim(group_claims)
        to_delete = [c for c in group_claims if c['id'] != best['id']]
        
        claims_to_keep.append(best['id'])
        claims_to_delete.extend([c['id'] for c in to_delete])
    
    print(f"   Claims to keep: {len(claims_to_keep)}")
    print(f"   Claims to delete: {len(claims_to_delete)}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN - No changes made")
        print(f"   Run with --execute to actually delete duplicates")
    else:
        print(f"\n🗑️  Deleting {len(claims_to_delete)} duplicate claims...")
        
        db = get_db(use_service_key=True)
        
        for claim_id in claims_to_delete:
            try:
                db.client.table('claims').delete().eq('id', claim_id).execute()
                print(f"   ✓ Deleted claim {claim_id}")
            except Exception as e:
                print(f"   ❌ Error deleting claim {claim_id}: {e}")
        
        print(f"\n✅ Deduplication complete!")
        print(f"   Removed {len(claims_to_delete)} duplicate claims")

if __name__ == "__main__":
    import sys
    
    dry_run = '--execute' not in sys.argv
    podcast_id = 'lex_325'
    
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

