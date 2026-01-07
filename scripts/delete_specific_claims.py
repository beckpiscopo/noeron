#!/usr/bin/env python3
"""
Delete specific claims by their distilled_claim or claim_text.
"""

from supabase_client import get_db

def delete_claims_by_text(texts_to_delete: list[str], podcast_id: str = 'lex_325', dry_run: bool = True):
    """
    Delete claims that match the given texts.
    
    Args:
        texts_to_delete: List of exact distilled_claim texts to delete
        podcast_id: Episode to search in
        dry_run: If True, only show what would be deleted
    """
    db = get_db(use_service_key=True)
    
    print(f"🔍 Searching for claims to delete in {podcast_id}...")
    
    # Get all claims
    all_claims = db.get_claims_for_episode(podcast_id)
    
    # Find matching claims
    claims_to_delete = []
    
    for claim in all_claims:
        distilled = claim.get('distilled_claim', '')
        claim_text = claim.get('claim_text', '')
        
        # Check if this claim matches any of our delete targets
        for target_text in texts_to_delete:
            if distilled == target_text or claim_text.startswith(target_text):
                claims_to_delete.append(claim)
                break
    
    if not claims_to_delete:
        print("❌ No matching claims found!")
        return
    
    print(f"\n📋 Found {len(claims_to_delete)} claims to delete:\n")
    
    for claim in claims_to_delete:
        claim_id = claim['id']
        start_ms = claim.get('start_ms', 0)
        timestamp = f"{start_ms/1000:.1f}s"
        distilled = claim.get('distilled_claim', '')
        text_preview = claim.get('claim_text', '')[:60]
        
        print(f"  [{claim_id}] @ {timestamp}")
        if distilled:
            print(f"    Distilled: {distilled}")
        print(f"    Full: {text_preview}...")
        print()
    
    if dry_run:
        print(f"⚠️  DRY RUN - No changes made")
        print(f"   Run with --execute to actually delete these claims")
    else:
        print(f"🗑️  Deleting {len(claims_to_delete)} claims...")
        
        for claim in claims_to_delete:
            claim_id = claim['id']
            try:
                db.client.table('claims').delete().eq('id', claim_id).execute()
                print(f"   ✓ Deleted claim {claim_id}")
            except Exception as e:
                print(f"   ❌ Error deleting claim {claim_id}: {e}")
        
        print(f"\n✅ Deleted {len(claims_to_delete)} claims!")

if __name__ == "__main__":
    import sys
    
    # Claims to delete (provided by user)
    CLAIMS_TO_DELETE = [
        "Planarians grow brand new brains that retain old memories.",
        "Planarian flatworms are biologically immortal and never die of old age",
        "Planarian worms conquered aging and are biologically immortal",
        "Biological systems resist disorder, refuting thermodynamic limits on lifespan.",
    ]
    
    dry_run = '--execute' not in sys.argv
    
    if dry_run:
        print("🔍 RUNNING IN DRY-RUN MODE")
        print("   This will show which claims would be deleted")
        print("   Use --execute to actually delete them\n")
    else:
        print("⚠️  EXECUTING DELETION MODE")
        print("   This will permanently delete the specified claims!")
        response = input("   Are you sure? Type 'yes' to continue: ")
        if response.lower() != 'yes':
            print("   Cancelled.")
            sys.exit(0)
        print()
    
    delete_claims_by_text(CLAIMS_TO_DELETE, dry_run=dry_run)



