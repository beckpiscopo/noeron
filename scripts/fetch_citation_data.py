#!/usr/bin/env python3
"""Fetch citation data from Semantic Scholar and update cleaned papers.

This script reads paper IDs from cleaned_papers/, fetches references and citations
from the Semantic Scholar API, and updates the JSON files with this data.

Usage:
    python scripts/fetch_citation_data.py

    # Skip papers that already have citation data:
    python scripts/fetch_citation_data.py --skip-existing

    # Limit number of papers to process:
    python scripts/fetch_citation_data.py --limit 10

    # Dry run (don't save changes):
    python scripts/fetch_citation_data.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)


# Semantic Scholar API configuration
S2_API_BASE = "https://api.semanticscholar.org/graph/v1"
S2_PAPER_FIELDS = "paperId,title,year,references.paperId,references.title,citations.paperId,citations.title"

# Rate limiting: S2 unauthenticated is very restrictive (~1 req/5 sec)
# With API key: 100 requests per 5 minutes
# Default: 6 seconds (safe for unauthenticated)
REQUEST_DELAY_SECONDS = 6.0


def fetch_paper_citations(paper_id: str, api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch references and citations for a paper from Semantic Scholar.

    Args:
        paper_id: Semantic Scholar paper ID
        api_key: Optional API key for higher rate limits

    Returns:
        Dict with 'references' and 'citations' lists, or None on error
    """
    url = f"{S2_API_BASE}/paper/{paper_id}"
    params = {"fields": S2_PAPER_FIELDS}
    headers = {}

    if api_key:
        headers["x-api-key"] = api_key

    try:
        response = requests.get(url, params=params, headers=headers, timeout=30)

        if response.status_code == 404:
            return {"error": "not_found", "references": [], "citations": []}

        if response.status_code == 429:
            return {"error": "rate_limited", "references": [], "citations": []}

        response.raise_for_status()
        data = response.json()

        # Extract reference paper IDs
        references = []
        for ref in data.get("references") or []:
            if ref and ref.get("paperId"):
                references.append({
                    "paperId": ref["paperId"],
                    "title": ref.get("title", "")
                })

        # Extract citation paper IDs
        citations = []
        for cit in data.get("citations") or []:
            if cit and cit.get("paperId"):
                citations.append({
                    "paperId": cit["paperId"],
                    "title": cit.get("title", "")
                })

        return {
            "references": references,
            "citations": citations,
            "s2_paper_id": data.get("paperId"),
            "s2_title": data.get("title"),
            "s2_year": data.get("year"),
        }

    except requests.exceptions.RequestException as e:
        return {"error": str(e), "references": [], "citations": []}


def load_cleaned_paper(path: Path) -> Dict[str, Any]:
    """Load a cleaned paper JSON file."""
    return json.loads(path.read_text())


def save_cleaned_paper(path: Path, data: Dict[str, Any]) -> None:
    """Save updated cleaned paper JSON file."""
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def has_citation_data(paper_data: Dict[str, Any]) -> bool:
    """Check if paper already has citation data."""
    refs = paper_data.get("references", [])
    cits = paper_data.get("citations", [])
    return bool(refs or cits)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch citation data from Semantic Scholar for cleaned papers."
    )
    parser.add_argument(
        "--cleaned-papers-dir",
        default="data/cleaned_papers",
        help="Directory containing cleaned paper JSONs (default: data/cleaned_papers)",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip papers that already have citation data",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of papers to process (0 = no limit)",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("S2_API_KEY") or os.environ.get("SEMANTIC_SCHOLAR_API_KEY"),
        help="Semantic Scholar API key (or set S2_API_KEY env var). Get free key at: https://www.semanticscholar.org/product/api",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch data but don't save changes to files",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=REQUEST_DELAY_SECONDS,
        help=f"Delay between API requests in seconds (default: {REQUEST_DELAY_SECONDS})",
    )

    args = parser.parse_args()

    cleaned_papers_dir = Path(args.cleaned_papers_dir)
    if not cleaned_papers_dir.exists():
        print(f"Error: Directory not found: {cleaned_papers_dir}")
        sys.exit(1)

    paper_files = sorted(cleaned_papers_dir.glob("*.json"))
    print(f"Found {len(paper_files)} papers in {cleaned_papers_dir}")

    if args.api_key:
        print(f"Using Semantic Scholar API key (faster rate limits)")
    else:
        print(f"No API key - using conservative rate limiting ({args.delay}s delay)")
        print(f"Get a free API key at: https://www.semanticscholar.org/product/api")

    # Stats
    stats = {
        "total": len(paper_files),
        "processed": 0,
        "skipped_existing": 0,
        "skipped_no_id": 0,
        "success": 0,
        "not_found": 0,
        "rate_limited": 0,
        "errors": 0,
    }

    papers_to_process = []

    for paper_file in paper_files:
        paper_data = load_cleaned_paper(paper_file)
        paper_id = paper_data.get("paper_id") or paper_data.get("paperId")

        if not paper_id:
            stats["skipped_no_id"] += 1
            continue

        if args.skip_existing and has_citation_data(paper_data):
            stats["skipped_existing"] += 1
            continue

        papers_to_process.append((paper_file, paper_data, paper_id))

        if args.limit and len(papers_to_process) >= args.limit:
            break

    print(f"\nPapers to process: {len(papers_to_process)}")
    if stats["skipped_existing"]:
        print(f"Skipped (already have data): {stats['skipped_existing']}")
    if stats["skipped_no_id"]:
        print(f"Skipped (no paper_id): {stats['skipped_no_id']}")

    if not papers_to_process:
        print("\nNo papers to process.")
        return

    # Estimate time
    estimated_seconds = len(papers_to_process) * args.delay
    estimated_minutes = estimated_seconds / 60
    print(f"Estimated time: ~{estimated_minutes:.1f} minutes")

    print(f"\nFetching citation data (delay: {args.delay}s between requests)...")
    print("=" * 60)

    for i, (paper_file, paper_data, paper_id) in enumerate(papers_to_process):
        stats["processed"] += 1

        title = paper_data.get("title", "Unknown")[:50]
        print(f"[{i+1}/{len(papers_to_process)}] {paper_id[:20]}... ({title}...)")

        # Fetch from Semantic Scholar
        result = fetch_paper_citations(paper_id, api_key=args.api_key)

        if result.get("error") == "not_found":
            print(f"  ⚠ Not found in Semantic Scholar")
            stats["not_found"] += 1
            continue

        if result.get("error") == "rate_limited":
            print(f"  ⚠ Rate limited! Waiting 60 seconds...")
            stats["rate_limited"] += 1
            time.sleep(60)
            # Retry once
            result = fetch_paper_citations(paper_id, api_key=args.api_key)
            if result.get("error"):
                print(f"  ✗ Still failed: {result.get('error')}")
                stats["errors"] += 1
                continue

        if result.get("error"):
            print(f"  ✗ Error: {result.get('error')}")
            stats["errors"] += 1
            continue

        refs = result.get("references", [])
        cits = result.get("citations", [])
        print(f"  ✓ Found {len(refs)} references, {len(cits)} citations")

        # Update paper data
        paper_data["references"] = refs
        paper_data["citations"] = cits
        paper_data["citation_data_fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")

        if not args.dry_run:
            save_cleaned_paper(paper_file, paper_data)

        stats["success"] += 1

        # Rate limiting delay (skip on last item)
        if i < len(papers_to_process) - 1:
            time.sleep(args.delay)

    # Print summary
    print("\n" + "=" * 60)
    print("FETCH SUMMARY")
    print("=" * 60)
    print(f"Total papers:        {stats['total']}")
    print(f"Processed:           {stats['processed']}")
    print(f"Success:             {stats['success']}")
    print(f"Not found in S2:     {stats['not_found']}")
    print(f"Rate limited:        {stats['rate_limited']}")
    print(f"Errors:              {stats['errors']}")
    print("=" * 60)

    if args.dry_run:
        print("\nDRY RUN: No files were modified.")
    else:
        print(f"\nUpdated {stats['success']} papers in {cleaned_papers_dir}")


if __name__ == "__main__":
    main()
