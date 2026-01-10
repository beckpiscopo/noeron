#!/usr/bin/env python3
"""
Generate keywords for claims using Gemini.

Extracts 2-4 key terms from each claim's distilled_claim for visualization
in the concept density graph.

Usage:
    python scripts/generate_claim_keywords.py [--episode EPISODE_ID] [--batch-size 50] [--dry-run]
"""

import os
import sys
import json
import argparse
import time
from typing import Optional

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from supabase_client import get_db

import google.generativeai as genai

# Configure Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable required")
    sys.exit(1)

genai.configure(api_key=GEMINI_API_KEY)

# Use Gemini Flash for speed and cost efficiency
MODEL_NAME = "gemini-2.0-flash"


def extract_keywords_batch(claims: list[dict]) -> dict[int, list[str]]:
    """
    Extract keywords for a batch of claims using Gemini.

    Returns a dict mapping claim ID to list of keywords.
    """
    if not claims:
        return {}

    # Build prompt with all claims
    claims_text = "\n".join([
        f"[{c['id']}] {c.get('distilled_claim') or c.get('claim_text', '')[:200]}"
        for c in claims
    ])

    prompt = f"""Extract 2-4 key scientific/technical terms from each claim below.
Focus on: organisms, phenomena, mechanisms, techniques, concepts.
Skip common words like "research", "study", "shows", "suggests".

Return JSON format: {{"claim_id": ["keyword1", "keyword2", ...]}}

Claims:
{claims_text}

JSON response:"""

    model = genai.GenerativeModel(MODEL_NAME)

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=2000,
            )
        )

        # Parse JSON from response
        text = response.text.strip()
        # Handle markdown code blocks
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        result = json.loads(text)
        # Convert string keys to int
        return {int(k): v for k, v in result.items()}

    except Exception as e:
        print(f"  Error extracting keywords: {e}")
        return {}


def generate_keywords_for_episode(
    episode_id: str,
    batch_size: int = 50,
    dry_run: bool = False
) -> int:
    """
    Generate keywords for all claims in an episode.

    Returns the number of claims updated.
    """
    db = get_db(use_service_key=True)
    client = db.client

    # Fetch claims without keywords
    query = client.table("claims").select("id, distilled_claim, claim_text").eq("podcast_id", episode_id)

    # Only get claims that don't have keywords yet
    response = query.is_("keywords", "null").execute()
    claims = response.data

    if not claims:
        print(f"  No claims without keywords found for {episode_id}")
        return 0

    print(f"  Found {len(claims)} claims to process")

    updated_count = 0

    # Process in batches
    for i in range(0, len(claims), batch_size):
        batch = claims[i:i + batch_size]
        print(f"  Processing batch {i // batch_size + 1} ({len(batch)} claims)...")

        keywords_map = extract_keywords_batch(batch)

        if dry_run:
            for claim_id, keywords in keywords_map.items():
                print(f"    [{claim_id}] -> {keywords}")
            updated_count += len(keywords_map)
        else:
            # Update each claim with its keywords
            for claim_id, keywords in keywords_map.items():
                if keywords:
                    try:
                        client.table("claims").update({
                            "keywords": keywords
                        }).eq("id", claim_id).execute()
                        updated_count += 1
                    except Exception as e:
                        print(f"    Error updating claim {claim_id}: {e}")

        # Rate limiting
        if i + batch_size < len(claims):
            time.sleep(1)

    return updated_count


def generate_keywords_all_episodes(batch_size: int = 50, dry_run: bool = False) -> int:
    """Generate keywords for all episodes."""
    db = get_db(use_service_key=True)
    client = db.client

    # Get all episodes
    response = client.table("episodes").select("podcast_id, title").execute()
    episodes = response.data

    print(f"Found {len(episodes)} episodes")

    total_updated = 0

    for episode in episodes:
        episode_id = episode["podcast_id"]
        print(f"\nProcessing: {episode.get('title', episode_id)}")

        updated = generate_keywords_for_episode(episode_id, batch_size, dry_run)
        total_updated += updated
        print(f"  Updated {updated} claims")

    return total_updated


def main():
    parser = argparse.ArgumentParser(description="Generate keywords for claims using Gemini")
    parser.add_argument("--episode", type=str, help="Process only this episode ID")
    parser.add_argument("--batch-size", type=int, default=50, help="Claims per Gemini request")
    parser.add_argument("--dry-run", action="store_true", help="Print keywords without saving")

    args = parser.parse_args()

    print("=" * 60)
    print("Claim Keyword Generator")
    print("=" * 60)
    print(f"Model: {MODEL_NAME}")
    print(f"Batch size: {args.batch_size}")
    print(f"Dry run: {args.dry_run}")
    print()

    if args.episode:
        updated = generate_keywords_for_episode(args.episode, args.batch_size, args.dry_run)
    else:
        updated = generate_keywords_all_episodes(args.batch_size, args.dry_run)

    print()
    print("=" * 60)
    print(f"Total claims {'would be ' if args.dry_run else ''}updated: {updated}")
    print("=" * 60)


if __name__ == "__main__":
    main()
