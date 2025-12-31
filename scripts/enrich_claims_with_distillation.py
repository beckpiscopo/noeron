"""
Batch script to enrich existing claims with distilled summaries.

This script:
1. Loads claims from cache (e.g., podcast_lex_325_claims_with_timing.json)
2. For each claim with a matched paper, generates a distilled summary
3. Adds a "distilled_claim" field to each claim
4. Saves the enriched cache back to disk
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Load .env file for API keys
REPO_ROOT = Path(__file__).resolve().parent.parent
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

# Add parent directory to path for imports
sys.path.insert(0, str(REPO_ROOT))

from scripts.claim_distiller import ClaimDistiller, create_distillation_input_from_claim


def enrich_claims_in_cache(
    cache_path: Path,
    papers_dir: Path,
    output_path: Optional[Path] = None,
    force_regenerate: bool = False,
) -> None:
    """
    Enrich all claims in a cache file with distilled summaries.
    
    Args:
        cache_path: Path to claims cache JSON file
        papers_dir: Path to cleaned_papers directory
        output_path: Optional output path (defaults to overwriting cache_path)
        force_regenerate: If True, regenerate even if distilled_claim already exists
    """
    print(f"Loading claims from: {cache_path}")
    cache_data = json.loads(cache_path.read_text())
    
    # Initialize distiller
    print("Initializing ClaimDistiller with Gemini...")
    distiller = ClaimDistiller()
    
    # Process each segment
    segments = cache_data.get("segments", {})
    total_claims = 0
    processed_claims = 0
    skipped_claims = 0
    failed_claims = 0
    
    # Count total claims
    for segment_id, segment in segments.items():
        # Try both "rag_results" (context_card_registry) and "claims" (timing cache)
        claims = segment.get("rag_results", segment.get("claims", []))
        total_claims += len(claims)
    
    print(f"\nFound {total_claims} claims across {len(segments)} segments")
    print("=" * 80)
    
    # Process each claim
    current_claim = 0
    for segment_id, segment in segments.items():
        # Try both "rag_results" (context_card_registry) and "claims" (timing cache)
        claims = segment.get("rag_results", segment.get("claims", []))
        
        for claim in claims:
            current_claim += 1
            
            # Skip if already has distilled_claim and not forcing regeneration
            if not force_regenerate and "distilled_claim" in claim:
                skipped_claims += 1
                continue
            
            # Create distillation input
            distill_input = create_distillation_input_from_claim(claim, papers_dir)
            
            if not distill_input:
                print(f"[{current_claim}/{total_claims}] ⊘ Missing required fields")
                failed_claims += 1
                continue
            
            # Generate distilled claim
            print(f"\n[{current_claim}/{total_claims}] Processing claim...")
            print(f"  Original: {claim.get('claim_text', '')[:80]}...")
            
            result = distiller.distill(distill_input)
            
            if result.success:
                claim["distilled_claim"] = result.distilled_claim
                claim["distilled_word_count"] = result.word_count
                processed_claims += 1
                print(f"  ✓ Distilled: {result.distilled_claim}")
                print(f"    ({result.word_count} words)")
            else:
                failed_claims += 1
                print(f"  ✗ Failed: {result.error}")
    
    # Save enriched cache
    output = output_path or cache_path
    print("\n" + "=" * 80)
    print(f"Saving enriched cache to: {output}")
    
    output.write_text(json.dumps(cache_data, indent=2, ensure_ascii=False))
    
    # Summary
    print("\n" + "=" * 80)
    print("ENRICHMENT SUMMARY")
    print("=" * 80)
    print(f"Total claims:     {total_claims}")
    print(f"Processed:        {processed_claims}")
    print(f"Skipped:          {skipped_claims}")
    print(f"Failed:           {failed_claims}")
    print(f"Success rate:     {processed_claims / max(total_claims - skipped_claims, 1) * 100:.1f}%")
    print("=" * 80)


def preview_distillations(
    cache_path: Path,
    papers_dir: Path,
    num_samples: int = 5,
) -> None:
    """
    Preview distillations for a few claims without saving.
    
    Useful for testing the prompt and seeing examples.
    """
    print(f"Loading claims from: {cache_path}")
    cache_data = json.loads(cache_path.read_text())
    
    # Initialize distiller
    print("Initializing ClaimDistiller with Gemini...")
    distiller = ClaimDistiller()
    
    # Collect sample claims
    segments = cache_data.get("segments", {})
    sample_claims = []
    
    for segment_id, segment in segments.items():
        # Try both "rag_results" (context_card_registry) and "claims" (timing cache)
        claims = segment.get("rag_results", segment.get("claims", []))
        for claim in claims:
            if len(sample_claims) >= num_samples:
                break
            sample_claims.append(claim)
        if len(sample_claims) >= num_samples:
            break
    
    print(f"\nPreviewing {len(sample_claims)} sample claims")
    print("=" * 80)
    
    # Process samples
    for i, claim in enumerate(sample_claims, 1):
        print(f"\nSample {i}/{len(sample_claims)}")
        print("-" * 80)
        
        # Show original
        print(f"Original transcript quote:")
        print(f"  {claim.get('claim_text', 'N/A')[:150]}...")
        print(f"\nMatched paper:")
        print(f"  {claim.get('paper_title', 'N/A')}")
        
        # Create distillation input
        distill_input = create_distillation_input_from_claim(claim, papers_dir)
        
        if not distill_input:
            print(f"\n⊘ Cannot distill - missing required fields")
            continue
        
        # Generate distilled claim
        result = distiller.distill(distill_input)
        
        if result.success:
            print(f"\n✓ Distilled claim:")
            print(f"  {result.distilled_claim}")
            print(f"  ({result.word_count} words)")
        else:
            print(f"\n✗ Failed: {result.error}")
    
    print("\n" + "=" * 80)


def main():
    """Main entry point for the script."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Enrich claims with distilled summaries for Live Research Stream"
    )
    parser.add_argument(
        "cache_file",
        type=str,
        help="Path to claims cache JSON file (e.g., cache/podcast_lex_325_claims_with_timing.json)",
    )
    parser.add_argument(
        "--papers-dir",
        type=str,
        default="data/cleaned_papers",
        help="Path to cleaned_papers directory (default: data/cleaned_papers)",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output path for enriched cache (default: overwrites input)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate distilled claims even if they already exist",
    )
    parser.add_argument(
        "--preview",
        type=int,
        metavar="N",
        help="Preview N sample distillations without saving (for testing)",
    )
    
    args = parser.parse_args()
    
    # Convert paths
    cache_path = Path(args.cache_file)
    papers_dir = Path(args.papers_dir)
    output_path = Path(args.output) if args.output else None
    
    # Validate paths
    if not cache_path.exists():
        print(f"Error: Cache file not found: {cache_path}")
        sys.exit(1)
    
    if not papers_dir.exists():
        print(f"Error: Papers directory not found: {papers_dir}")
        sys.exit(1)
    
    # Preview mode or full enrichment
    if args.preview:
        preview_distillations(cache_path, papers_dir, num_samples=args.preview)
    else:
        enrich_claims_in_cache(
            cache_path,
            papers_dir,
            output_path,
            force_regenerate=args.force,
        )


if __name__ == "__main__":
    main()

