#!/usr/bin/env python3
"""
Batch generate deep dive summaries for claims without evidence threads.

This script generates summaries for claims that failed evidence thread eligibility,
allowing them to still have paper references for the Figures tab.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
EVIDENCE_THREADS_PATH = ROOT_DIR / "cache" / "evidence_threads.json"
DEEP_DIVE_CACHE_PATH = ROOT_DIR / "cache" / "deep_dive_summaries.json"

API_BASE = "http://127.0.0.1:8000"


def load_claims_without_threads() -> list[dict]:
    """Load claims that have no evidence threads."""
    with open(EVIDENCE_THREADS_PATH) as f:
        threads = json.load(f)

    claims = []
    for key, data in threads.items():
        if not data.get("threads"):
            claims.append({
                "claim_id": data.get("claim_id", key),
                "eligibility_reason": data.get("eligibility_reason", "unknown"),
            })

    return claims


def load_existing_summaries() -> set[str]:
    """Load claim IDs that already have summaries."""
    if not DEEP_DIVE_CACHE_PATH.exists():
        return set()

    with open(DEEP_DIVE_CACHE_PATH) as f:
        cache = json.load(f)

    # Keys are like "lex_325:lex_325|00:10:00.160|6-2:technical"
    claim_ids = set()
    for key in cache.keys():
        parts = key.split(":")
        if len(parts) >= 2:
            claim_ids.add(parts[1])

    return claim_ids


def generate_summary(claim_id: str, episode_id: str, style: str = "technical") -> dict:
    """Call the API to generate a deep dive summary."""
    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{API_BASE}/tools/generate_deep_dive_summary/execute",
            json={
                "claim_id": claim_id,
                "episode_id": episode_id,
                "style": style,
                "force_regenerate": False,
            },
        )
        response.raise_for_status()
        return response.json()


def main():
    parser = argparse.ArgumentParser(
        description="Generate deep dive summaries for claims without evidence threads"
    )
    parser.add_argument(
        "--episode-id",
        default="lex_325",
        help="Episode ID (default: lex_325)",
    )
    parser.add_argument(
        "--style",
        choices=["technical", "simplified"],
        default="technical",
        help="Summary style (default: technical)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of claims to process",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List claims to process without generating",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay between API calls in seconds (default: 0.5)",
    )
    args = parser.parse_args()

    # Load claims without threads
    claims = load_claims_without_threads()
    print(f"Found {len(claims)} claims without evidence threads")

    # Filter out claims that already have summaries
    existing = load_existing_summaries()
    claims_to_process = [c for c in claims if c["claim_id"] not in existing]
    print(f"Claims already with summaries: {len(claims) - len(claims_to_process)}")
    print(f"Claims to process: {len(claims_to_process)}")

    if args.limit:
        claims_to_process = claims_to_process[:args.limit]
        print(f"Limited to: {len(claims_to_process)}")

    if args.dry_run:
        print("\nDry run - claims that would be processed:")
        for c in claims_to_process:
            print(f"  {c['claim_id']} - {c['eligibility_reason']}")
        return

    if not claims_to_process:
        print("\nNo claims to process!")
        return

    print(f"\nGenerating summaries...")
    success = 0
    failed = 0

    for i, claim in enumerate(claims_to_process):
        claim_id = claim["claim_id"]
        print(f"[{i+1}/{len(claims_to_process)}] {claim_id}...", end=" ", flush=True)

        try:
            result = generate_summary(claim_id, args.episode_id, args.style)

            if "error" in result:
                print(f"ERROR: {result['error']}")
                failed += 1
            else:
                papers = len(result.get("papers", []))
                cached = result.get("cached", False)
                status = "cached" if cached else "generated"
                print(f"OK ({status}, {papers} papers)")
                success += 1

        except Exception as e:
            print(f"FAILED: {e}")
            failed += 1

        if args.delay and i < len(claims_to_process) - 1:
            time.sleep(args.delay)

    print(f"\nDone! Success: {success}, Failed: {failed}")


if __name__ == "__main__":
    main()
