#!/usr/bin/env python3
"""
Batch generator for deep dive summaries and evidence threads.

This script iterates through all claims and pre-generates:
1. Deep dive summaries (simplified and technical styles)
2. Evidence threads (narrative research arcs)

Results are cached in:
- cache/deep_dive_summaries.json
- cache/evidence_threads.json

Usage:
    # Generate both summaries and threads for all claims
    python scripts/batch_generate_deep_dives.py --podcast-id lex_325

    # Only generate deep dive summaries
    python scripts/batch_generate_deep_dives.py --podcast-id lex_325 --summaries-only

    # Only generate evidence threads
    python scripts/batch_generate_deep_dives.py --podcast-id lex_325 --threads-only

    # Force regeneration (skip cache)
    python scripts/batch_generate_deep_dives.py --podcast-id lex_325 --force

    # Limit number of claims to process
    python scripts/batch_generate_deep_dives.py --podcast-id lex_325 --limit 10

    # Start from a specific claim index
    python scripts/batch_generate_deep_dives.py --podcast-id lex_325 --start-index 50

    # Use Supabase claims instead of local cache
    python scripts/batch_generate_deep_dives.py --podcast-id lex_325 --use-supabase
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent
CLAIMS_CACHE_PATH = REPO_ROOT / "cache" / "podcast_lex_325_claims_with_timing.json"
DEEP_DIVE_CACHE_PATH = REPO_ROOT / "cache" / "deep_dive_summaries.json"
EVIDENCE_THREADS_CACHE_PATH = REPO_ROOT / "cache" / "evidence_threads.json"

# HTTP server URL (assumes local server running)
DEFAULT_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8000")


def load_claims_from_cache(podcast_id: str) -> list[dict[str, Any]]:
    """Load claims from local JSON cache."""
    # Try podcast-specific cache first
    podcast_cache = REPO_ROOT / "cache" / f"podcast_{podcast_id}_claims_with_timing.json"
    if podcast_cache.exists():
        cache_path = podcast_cache
    elif CLAIMS_CACHE_PATH.exists():
        cache_path = CLAIMS_CACHE_PATH
    else:
        raise FileNotFoundError(f"No claims cache found for {podcast_id}")

    with cache_path.open() as f:
        data = json.load(f)

    claims = []
    segments = data.get("segments", {})

    for segment_key, segment_data in segments.items():
        if not segment_key.startswith(f"{podcast_id}|"):
            continue

        for idx, claim_data in enumerate(segment_data.get("claims", [])):
            claim_id = f"{segment_key}-{idx}"
            claims.append({
                "claim_id": claim_id,
                "segment_key": segment_key,
                "claim_index": idx,
                "claim_text": claim_data.get("claim_text", ""),
                "timestamp": segment_data.get("timestamp", ""),
            })

    # Sort by timestamp
    claims.sort(key=lambda c: c["timestamp"])
    return claims


def load_claims_from_supabase(podcast_id: str) -> list[dict[str, Any]]:
    """Load claims from Supabase."""
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

        client = create_client(supabase_url, supabase_key)

        # Query claims table
        response = client.table("claims").select("*").eq("episode_id", podcast_id).execute()

        claims = []
        for row in response.data:
            claim_id = row.get("segment_claim_id")
            if claim_id:
                claims.append({
                    "claim_id": claim_id,
                    "segment_key": claim_id.rsplit("-", 1)[0] if "-" in claim_id else claim_id,
                    "claim_text": row.get("claim_text", ""),
                    "timestamp": row.get("timestamp", ""),
                })

        claims.sort(key=lambda c: c.get("start_ms", 0))
        return claims

    except ImportError:
        print("Warning: supabase package not installed. Install with: pip install supabase")
        raise


def load_existing_cache(cache_path: Path) -> dict[str, Any]:
    """Load existing cache to check what's already generated."""
    if cache_path.exists():
        with cache_path.open() as f:
            return json.load(f)
    return {}


def call_generate_deep_dive(
    server_url: str,
    claim_id: str,
    episode_id: str,
    style: str = "technical",
    force_regenerate: bool = False,
    n_results: int = 7,
) -> dict[str, Any]:
    """Call the generate_deep_dive_summary endpoint."""
    url = f"{server_url}/tools/generate_deep_dive_summary/execute"
    payload = {
        "claim_id": claim_id,
        "episode_id": episode_id,
        "style": style,
        "force_regenerate": force_regenerate,
        "n_results": n_results,
    }

    response = requests.post(url, json=payload, timeout=120)
    response.raise_for_status()
    return response.json()


def call_generate_evidence_threads(
    server_url: str,
    claim_id: str,
    episode_id: str,
    force_regenerate: bool = False,
    n_results: int = 10,
) -> dict[str, Any]:
    """Call the generate_evidence_threads endpoint."""
    url = f"{server_url}/tools/generate_evidence_threads/execute"
    payload = {
        "claim_id": claim_id,
        "episode_id": episode_id,
        "force_regenerate": force_regenerate,
        "n_results": n_results,
    }

    response = requests.post(url, json=payload, timeout=120)
    response.raise_for_status()
    return response.json()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch generate deep dive summaries and evidence threads for claims."
    )
    parser.add_argument(
        "--podcast-id",
        required=True,
        help="Podcast identifier (e.g., 'lex_325')",
    )
    parser.add_argument(
        "--server-url",
        default=DEFAULT_SERVER_URL,
        help=f"MCP HTTP server URL (default: {DEFAULT_SERVER_URL})",
    )
    parser.add_argument(
        "--summaries-only",
        action="store_true",
        help="Only generate deep dive summaries (skip evidence threads)",
    )
    parser.add_argument(
        "--threads-only",
        action="store_true",
        help="Only generate evidence threads (skip deep dive summaries)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration even if cached",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Zero-based index of the claim to start processing",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of claims to process",
    )
    parser.add_argument(
        "--use-supabase",
        action="store_true",
        help="Load claims from Supabase instead of local cache",
    )
    parser.add_argument(
        "--style",
        choices=["technical", "simplified", "both"],
        default="both",
        help="Style for deep dive summaries (default: both)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay in seconds between API calls to avoid rate limiting (default: 1.0)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List claims that would be processed without actually calling the API",
    )

    args = parser.parse_args()

    # Validate mutually exclusive options
    if args.summaries_only and args.threads_only:
        parser.error("Cannot use both --summaries-only and --threads-only")

    # Load claims
    print(f"Loading claims for podcast: {args.podcast_id}")
    try:
        if args.use_supabase:
            claims = load_claims_from_supabase(args.podcast_id)
            print(f"Loaded {len(claims)} claims from Supabase")
        else:
            claims = load_claims_from_cache(args.podcast_id)
            print(f"Loaded {len(claims)} claims from local cache")
    except Exception as e:
        print(f"Error loading claims: {e}")
        sys.exit(1)

    if not claims:
        print("No claims found!")
        sys.exit(1)

    # Load existing caches to show progress
    deep_dive_cache = load_existing_cache(DEEP_DIVE_CACHE_PATH)
    threads_cache = load_existing_cache(EVIDENCE_THREADS_CACHE_PATH)

    # Count existing entries
    existing_summaries = sum(
        1 for c in claims
        if f"{args.podcast_id}:{c['claim_id']}:technical" in deep_dive_cache
        or f"{args.podcast_id}:{c['claim_id']}:simplified" in deep_dive_cache
    )
    existing_threads = sum(
        1 for c in claims
        if f"{args.podcast_id}:{c['claim_id']}" in threads_cache
    )

    print(f"\nExisting cache status:")
    print(f"  Deep dive summaries: {existing_summaries}/{len(claims)} claims")
    print(f"  Evidence threads: {existing_threads}/{len(claims)} claims")

    # Apply start index and limit
    claims_to_process = claims[args.start_index:]
    if args.limit:
        claims_to_process = claims_to_process[:args.limit]

    total = len(claims_to_process)
    print(f"\nWill process {total} claims (starting at index {args.start_index})")

    if args.dry_run:
        print("\n[DRY RUN] Claims that would be processed:")
        for i, claim in enumerate(claims_to_process):
            print(f"  [{i+1}/{total}] {claim['claim_id']}")
            print(f"           Text: {claim['claim_text'][:80]}...")
        print("\n[DRY RUN] No API calls made.")
        return

    # Check server health
    try:
        health = requests.get(f"{args.server_url}/health", timeout=5)
        health.raise_for_status()
        print(f"\nServer at {args.server_url} is healthy")
    except Exception as e:
        print(f"\nError: Cannot connect to server at {args.server_url}")
        print(f"Make sure the HTTP server is running: python -m src.bioelectricity_research.http_server")
        print(f"Error details: {e}")
        sys.exit(1)

    # Process claims
    processed = 0
    errors = 0
    skipped = 0

    styles_to_generate = []
    if not args.threads_only:
        if args.style == "both":
            styles_to_generate = ["technical", "simplified"]
        else:
            styles_to_generate = [args.style]

    for i, claim in enumerate(claims_to_process):
        claim_id = claim["claim_id"]
        claim_text_preview = claim["claim_text"][:60] + "..." if len(claim["claim_text"]) > 60 else claim["claim_text"]

        print(f"\n[{i+1}/{total}] Processing: {claim_id}")
        print(f"           Claim: {claim_text_preview}")

        # Generate deep dive summaries
        if not args.threads_only:
            for style in styles_to_generate:
                cache_key = f"{args.podcast_id}:{claim_id}:{style}"

                if not args.force and cache_key in deep_dive_cache:
                    print(f"           [SKIP] {style} summary already cached")
                    skipped += 1
                    continue

                try:
                    print(f"           Generating {style} summary...")
                    result = call_generate_deep_dive(
                        args.server_url,
                        claim_id,
                        args.podcast_id,
                        style=style,
                        force_regenerate=args.force,
                    )

                    if result.get("error"):
                        print(f"           [ERROR] {style}: {result['error']}")
                        errors += 1
                    else:
                        papers_count = result.get("papers_retrieved", 0)
                        print(f"           [OK] {style} summary generated ({papers_count} papers)")
                        processed += 1

                    time.sleep(args.delay)

                except requests.exceptions.Timeout:
                    print(f"           [TIMEOUT] {style} summary timed out")
                    errors += 1
                except Exception as e:
                    print(f"           [ERROR] {style}: {e}")
                    errors += 1

        # Generate evidence threads
        if not args.summaries_only:
            threads_cache_key = f"{args.podcast_id}:{claim_id}"

            if not args.force and threads_cache_key in threads_cache:
                print(f"           [SKIP] Evidence threads already cached")
                skipped += 1
            else:
                try:
                    print(f"           Generating evidence threads...")
                    result = call_generate_evidence_threads(
                        args.server_url,
                        claim_id,
                        args.podcast_id,
                        force_regenerate=args.force,
                    )

                    if result.get("error"):
                        print(f"           [ERROR] threads: {result['error']}")
                        errors += 1
                    else:
                        thread_count = len(result.get("threads", []))
                        eligible = result.get("eligible", False)
                        if eligible:
                            print(f"           [OK] {thread_count} evidence threads generated")
                        else:
                            reason = result.get("eligibility_reason", "unknown")
                            print(f"           [OK] Not eligible for threads: {reason}")
                        processed += 1

                    time.sleep(args.delay)

                except requests.exceptions.Timeout:
                    print(f"           [TIMEOUT] Evidence threads timed out")
                    errors += 1
                except Exception as e:
                    print(f"           [ERROR] threads: {e}")
                    errors += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"BATCH COMPLETE")
    print(f"{'='*60}")
    print(f"  Claims processed: {i+1}/{total}")
    print(f"  Successful generations: {processed}")
    print(f"  Skipped (cached): {skipped}")
    print(f"  Errors: {errors}")


if __name__ == "__main__":
    main()
