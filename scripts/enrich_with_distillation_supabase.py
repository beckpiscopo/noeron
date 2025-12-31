"""
Enrich claims in Supabase with distilled summaries using gemini-3-pro-preview.

This script:
1. Queries Supabase for claims that need distillation
2. Generates distilled 10-15 word summaries using gemini-3-pro-preview
3. Updates claims in Supabase with distilled_claim field
"""

import sys
from pathlib import Path
from typing import Optional

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from supabase_client import get_db
from claim_distiller import ClaimDistiller, DistillationInput


def create_distillation_input_from_db_claim(claim: dict) -> Optional[DistillationInput]:
    """
    Create DistillationInput from a Supabase claim record.
    
    Args:
        claim: Claim dict from Supabase
        
    Returns:
        DistillationInput or None if missing required fields
    """
    transcript_quote = claim.get("claim_text")
    paper_title = claim.get("paper_title")
    
    if not all([transcript_quote, paper_title]):
        return None
    
    # Extract paper excerpt from rationale
    rationale = claim.get("rationale", "")
    paper_excerpt = rationale.replace("Matches the paper section by quoting: ", "").strip() if rationale else ""
    
    # For now, use paper_title as abstract (we could enhance this by fetching from papers table)
    # TODO: Query papers table for full abstract if paper_id exists
    
    return DistillationInput(
        transcript_quote=transcript_quote,
        paper_title=paper_title,
        paper_abstract=paper_title,  # Using title as fallback
        paper_excerpt=paper_excerpt or paper_title,
        section_heading=claim.get("section") or "Unknown Section",
        claim_type=claim.get("claim_type"),
        speaker_stance=claim.get("speaker_stance"),
    )


def enrich_claims_for_episode(
    podcast_id: Optional[str] = None,
    limit: int = 100,
    dry_run: bool = False,
    resume: bool = True
) -> dict:
    """
    Enrich claims with distilled summaries.
    
    Args:
        podcast_id: If provided, only process claims from this episode
        limit: Maximum number of claims to process
        dry_run: If True, generate distillations but don't save to database
        
    Returns:
        Statistics about the enrichment process
    """
    db = get_db(use_service_key=True)
    distiller = ClaimDistiller()
    
    # Get claims that need distillation
    print(f"Fetching claims that need distillation (limit: {limit})...")
    
    if podcast_id:
        # Get all claims for episode that don't have distilled_claim
        claims = [
            c for c in db.get_claims_for_episode(podcast_id)
            if not c.get("distilled_claim") and c.get("paper_title")
        ][:limit]
        print(f"  Found {len(claims)} claims for episode '{podcast_id}' needing distillation")
        
        # Show progress if resume=True
        if resume:
            total_claims = len([c for c in db.get_claims_for_episode(podcast_id) if c.get("paper_title")])
            already_done = total_claims - len(claims)
            if already_done > 0:
                print(f"  ✓ Already distilled: {already_done} claims")
                print(f"  → Remaining: {len(claims)} claims")
    else:
        # Get claims across all episodes
        claims = db.get_claims_needing_distillation(limit=limit)
        print(f"  Found {len(claims)} claims across all episodes")
    
    if not claims:
        print("  No claims need distillation!")
        return {"processed": 0, "success": 0, "failed": 0}
    
    # Process each claim
    stats = {
        "processed": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0
    }
    
    print("\n" + "=" * 80)
    print(f"DISTILLING {len(claims)} CLAIMS")
    print("=" * 80)
    
    for i, claim in enumerate(claims, 1):
        claim_id = claim["id"]
        claim_text = claim.get("claim_text", "")[:80]
        
        print(f"\n[{i}/{len(claims)}] Processing claim {claim_id}")
        print(f"  Original: {claim_text}...")
        
        try:
            # Create distillation input
            distill_input = create_distillation_input_from_db_claim(claim)
            
            if not distill_input:
                print(f"  ⊘ Skipped - missing required fields")
                stats["skipped"] += 1
                continue
            
            # Generate distilled claim
            result = distiller.distill(distill_input)
            
            if result.success:
                print(f"  ✓ Distilled: {result.distilled_claim}")
                print(f"    ({result.word_count} words)")
                
                # Update in database (unless dry run)
                if not dry_run:
                    db.add_distilled_claim(claim_id, result.distilled_claim, result.word_count)
                    print(f"    ✓ Saved to database")
                else:
                    print(f"    (Dry run - not saved)")
                
                stats["success"] += 1
            else:
                print(f"  ✗ Failed: {result.error[:100]}...")
                stats["failed"] += 1
            
            stats["processed"] += 1
            
        except KeyboardInterrupt:
            print("\n\n⚠️  Interrupted by user")
            print(f"Progress saved: {stats['success']} claims distilled")
            print("Run the script again to resume from where you left off")
            raise
        except Exception as e:
            print(f"  ✗ Unexpected error: {str(e)[:100]}...")
            stats["failed"] += 1
            stats["processed"] += 1
            # Continue with next claim instead of crashing
    
    # Print summary
    print("\n" + "=" * 80)
    print("ENRICHMENT COMPLETE")
    print("=" * 80)
    print(f"Processed: {stats['processed']}")
    print(f"Success:   {stats['success']}")
    print(f"Failed:    {stats['failed']}")
    print(f"Skipped:   {stats['skipped']}")
    if stats['processed'] > 0:
        success_rate = (stats['success'] / stats['processed']) * 100
        print(f"Success rate: {success_rate:.1f}%")
    print("=" * 80)
    
    return stats


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Enrich claims in Supabase with distilled summaries"
    )
    parser.add_argument(
        "--episode",
        type=str,
        help="Only process claims from this episode (e.g., 'lex_325')",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum number of claims to process (default: 100)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process ALL claims (overrides --limit)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate distillations but don't save to database",
    )
    
    args = parser.parse_args()
    
    limit = 10000 if args.all else args.limit
    
    print("=" * 80)
    print("NOERON CLAIM DISTILLATION")
    print("=" * 80)
    print(f"Episode filter: {args.episode or 'All episodes'}")
    print(f"Limit: {limit if not args.all else 'No limit'}")
    print(f"Dry run: {args.dry_run}")
    print("=" * 80)
    
    stats = enrich_claims_for_episode(
        podcast_id=args.episode,
        limit=limit,
        dry_run=args.dry_run
    )
    
    if stats["processed"] == 0:
        print("\n✓ All claims already have distilled summaries!")
    elif stats["success"] > 0 and not args.dry_run:
        print(f"\n✓ Successfully enriched {stats['success']} claims!")
        print("\nNext step: Update your frontend to display distilled_claim field")


if __name__ == "__main__":
    main()

