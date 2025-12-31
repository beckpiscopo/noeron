#!/usr/bin/env python3
"""
Populate segment_claim_id field in Supabase claims table.

This script reads the cached claims data (which has segment keys and claim indices)
and updates the Supabase database to add the segment_claim_id field in the format
expected by the MCP server: "segment_key-index"
"""

import json
import os
from pathlib import Path
from supabase_client import get_db

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
CLAIMS_CACHE = PROJECT_ROOT / "cache" / "podcast_lex_325_claims_with_timing.json"


def load_claims_cache():
    """Load the claims cache file."""
    if not CLAIMS_CACHE.exists():
        print(f"❌ Claims cache not found: {CLAIMS_CACHE}")
        return None
    
    with open(CLAIMS_CACHE, "r", encoding="utf-8") as f:
        return json.load(f)


def populate_segment_claim_ids(dry_run=False):
    """
    Populate segment_claim_id field in Supabase.
    
    Args:
        dry_run: If True, only print what would be updated without making changes
    """
    # Load claims cache
    print("📂 Loading claims cache...")
    cache_data = load_claims_cache()
    if not cache_data:
        return
    
    segments = cache_data.get("segments", {})
    if not segments:
        print("❌ No segments found in cache")
        return
    
    print(f"✅ Found {len(segments)} segments in cache")
    
    # Connect to Supabase
    print("\n🔌 Connecting to Supabase...")
    db = get_db(use_service_key=True)  # Use service key for backend operations
    
    # Test connection
    if not db.test_connection():
        print("❌ Failed to connect to Supabase. Check your .env file.")
        return
    
    # Track statistics
    total_claims = 0
    updated_claims = 0
    skipped_claims = 0
    errors = 0
    
    # Process each segment
    for segment_key, segment_data in segments.items():
        claims_list = segment_data.get("claims", [])
        
        if not claims_list:
            continue
        
        print(f"\n📍 Processing segment: {segment_key}")
        print(f"   Claims in segment: {len(claims_list)}")
        
        for claim_index, claim_data in enumerate(claims_list):
            total_claims += 1
            
            # Construct segment_claim_id
            segment_claim_id = f"{segment_key}-{claim_index}"
            
            # Get claim identifiers for matching
            claim_text = claim_data.get("claim_text", "")
            start_ms = claim_data.get("timing", {}).get("start_ms") if claim_data.get("timing") else None
            
            if not claim_text:
                print(f"   ⚠️  Skipping claim {claim_index}: No claim_text")
                skipped_claims += 1
                continue
            
            try:
                # Find matching claim in Supabase by claim_text and start_ms
                query = db.client.table("claims").select("id, segment_claim_id")
                query = query.eq("claim_text", claim_text)
                
                if start_ms is not None:
                    query = query.eq("start_ms", start_ms)
                
                result = query.execute()
                
                if not result.data:
                    print(f"   ⚠️  Claim not found in Supabase: {claim_text[:50]}...")
                    skipped_claims += 1
                    continue
                
                if len(result.data) > 1:
                    print(f"   ⚠️  Multiple claims match ({len(result.data)}): {claim_text[:50]}...")
                    # Use the first one
                
                db_claim = result.data[0]
                db_claim_id = db_claim["id"]
                existing_segment_claim_id = db_claim.get("segment_claim_id")
                
                # Skip if already populated
                if existing_segment_claim_id:
                    if existing_segment_claim_id == segment_claim_id:
                        print(f"   ✓  Claim {db_claim_id} already has correct segment_claim_id")
                        skipped_claims += 1
                        continue
                    else:
                        print(f"   ⚠️  Claim {db_claim_id} has different segment_claim_id: {existing_segment_claim_id} vs {segment_claim_id}")
                
                # Update the claim
                if dry_run:
                    print(f"   [DRY RUN] Would update claim {db_claim_id}: segment_claim_id = {segment_claim_id}")
                    updated_claims += 1
                else:
                    update_result = (
                        db.client.table("claims")
                        .update({"segment_claim_id": segment_claim_id})
                        .eq("id", db_claim_id)
                        .execute()
                    )
                    
                    if update_result.data:
                        print(f"   ✅ Updated claim {db_claim_id}: {claim_text[:50]}...")
                        updated_claims += 1
                    else:
                        print(f"   ❌ Failed to update claim {db_claim_id}")
                        errors += 1
                        
            except Exception as e:
                print(f"   ❌ Error processing claim {claim_index}: {str(e)}")
                errors += 1
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"Total claims processed:  {total_claims}")
    print(f"Successfully updated:    {updated_claims}")
    print(f"Skipped:                 {skipped_claims}")
    print(f"Errors:                  {errors}")
    
    if dry_run:
        print("\n💡 This was a dry run. Run without --dry-run to apply changes.")
    else:
        print("\n✅ Migration complete!")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Populate segment_claim_id field in Supabase"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without updating the database"
    )
    
    args = parser.parse_args()
    
    print("🚀 Populating segment_claim_id in Supabase")
    print("=" * 60)
    
    populate_segment_claim_ids(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

