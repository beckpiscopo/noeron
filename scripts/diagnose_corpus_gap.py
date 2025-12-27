#!/usr/bin/env python3
"""
Diagnostic script to understand why we have 450 scraped entries but only 70 papers.

Analyzes the raw scraped data and checks:
1. How many entries have DOIs vs titles only
2. Which entries fail to match in Semantic Scholar
3. Which entries match but have no PDFs
4. Overall success/failure breakdown
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx

# Adjust these paths to match your project structure
ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_SCRAPE_FILE = ROOT_DIR / "data" / "scraped" / "levin_publications_raw.json"

API_BASE = "https://api.semanticscholar.org/graph/v1"
HEADERS = {"Accept": "application/json"}
FIELDS = "paperId,title,authors,year,openAccessPdf,externalIds"

logger = logging.getLogger("corpus_diagnostics")


class DiagnosticResults:
    def __init__(self):
        self.total_entries = 0
        self.has_doi = 0
        self.has_title_only = 0
        self.doi_found = 0
        self.doi_not_found = 0
        self.title_found = 0
        self.title_not_found = 0
        self.has_pdf = 0
        self.no_pdf = 0
        self.failed_entries: List[Dict[str, Any]] = []
        self.no_pdf_entries: List[Dict[str, Any]] = []
        
    def print_summary(self):
        print("\n" + "="*80)
        print("CORPUS GAP DIAGNOSTIC SUMMARY")
        print("="*80)
        
        print(f"\n📊 SCRAPED DATA:")
        print(f"  Total entries: {self.total_entries}")
        print(f"  With DOI: {self.has_doi} ({self.has_doi/self.total_entries*100:.1f}%)")
        print(f"  Title only: {self.has_title_only} ({self.has_title_only/self.total_entries*100:.1f}%)")
        
        print(f"\n🔍 SEMANTIC SCHOLAR LOOKUP:")
        print(f"  DOI lookups successful: {self.doi_found}/{self.has_doi}")
        print(f"  DOI lookups failed: {self.doi_not_found}/{self.has_doi}")
        print(f"  Title searches successful: {self.title_found}/{self.has_title_only}")
        print(f"  Title searches failed: {self.title_not_found}/{self.has_title_only}")
        
        total_found = self.doi_found + self.title_found
        total_not_found = self.doi_not_found + self.title_not_found
        
        print(f"\n📄 PDF AVAILABILITY:")
        print(f"  Papers with open access PDF: {self.has_pdf}/{total_found}")
        print(f"  Papers WITHOUT PDF: {self.no_pdf}/{total_found}")
        
        print(f"\n🎯 SUCCESS RATE:")
        print(f"  Total matched in Semantic Scholar: {total_found}/{self.total_entries} ({total_found/self.total_entries*100:.1f}%)")
        print(f"  Total with downloadable PDFs: {self.has_pdf}/{self.total_entries} ({self.has_pdf/self.total_entries*100:.1f}%)")
        
        print(f"\n❌ FAILURES:")
        print(f"  Could not find in Semantic Scholar: {total_not_found}")
        print(f"  Found but no PDF available: {self.no_pdf}")
        
        if self.failed_entries:
            print(f"\n📋 Sample failed lookups (first 5):")
            for entry in self.failed_entries[:5]:
                print(f"  - {entry['title'][:80]}...")
                if entry.get('identifiers', {}).get('DOI'):
                    print(f"    DOI: {entry['identifiers']['DOI']}")
                    
        if self.no_pdf_entries:
            print(f"\n📋 Sample entries with no PDF (first 5):")
            for entry in self.no_pdf_entries[:5]:
                print(f"  - {entry['title'][:80]}...")
                print(f"    Year: {entry.get('year', 'unknown')}")
        
        print("\n" + "="*80)


def load_scraped_entries(path: Path) -> List[Dict[str, Any]]:
    with open(path, "r") as f:
        payload = json.load(f)
    return payload.get("publications", [])


async def check_doi_lookup(
    client: httpx.AsyncClient,
    doi: str,
    delay: float,
) -> Optional[Dict[str, Any]]:
    """Check if a DOI resolves in Semantic Scholar."""
    encoded = quote(doi, safe="")
    try:
        response = await client.get(
            f"{API_BASE}/paper/{encoded}",
            params={"fields": FIELDS},
            headers=HEADERS,
            timeout=30.0,
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        await asyncio.sleep(delay)
        return response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            logger.warning("Rate limited, sleeping longer...")
            await asyncio.sleep(delay * 10)
            return None
        raise


async def check_title_search(
    client: httpx.AsyncClient,
    title: str,
    delay: float,
) -> Optional[Dict[str, Any]]:
    """Search for a paper by title in Semantic Scholar."""
    try:
        response = await client.get(
            f"{API_BASE}/paper/search",
            params={"query": title, "limit": 1, "fields": FIELDS},
            headers=HEADERS,
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json().get("data", [])
        await asyncio.sleep(delay)
        return data[0] if data else None
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            logger.warning("Rate limited, sleeping longer...")
            await asyncio.sleep(delay * 10)
            return None
        raise


async def diagnose_entry(
    client: httpx.AsyncClient,
    entry: Dict[str, Any],
    results: DiagnosticResults,
    delay: float,
) -> None:
    """Diagnose a single scraped entry."""
    results.total_entries += 1
    
    title = entry.get("title")
    if not title:
        logger.warning("Entry has no title: %s", entry)
        return
    
    identifiers = entry.get("identifiers", {})
    doi = identifiers.get("DOI")
    
    paper_metadata: Optional[Dict[str, Any]] = None
    
    # Try DOI lookup first
    if doi:
        results.has_doi += 1
        logger.info("Checking DOI: %s", doi)
        paper_metadata = await check_doi_lookup(client, doi, delay)
        
        if paper_metadata:
            results.doi_found += 1
        else:
            results.doi_not_found += 1
            logger.warning("DOI not found: %s - %s", doi, title[:60])
    
    # Fall back to title search
    if not paper_metadata:
        if not doi:
            results.has_title_only += 1
        
        logger.info("Searching by title: %s", title[:60])
        paper_metadata = await check_title_search(client, title, delay)
        
        if paper_metadata:
            results.title_found += 1
        else:
            results.title_not_found += 1
            results.failed_entries.append(entry)
            logger.warning("Title search failed: %s", title[:60])
            return
    
    # Check for PDF availability
    open_access = paper_metadata.get("openAccessPdf")
    if open_access and open_access.get("url"):
        results.has_pdf += 1
    else:
        results.no_pdf += 1
        results.no_pdf_entries.append({
            "title": title,
            "year": paper_metadata.get("year"),
            "paperId": paper_metadata.get("paperId"),
        })
        logger.info("No PDF available: %s", title[:60])


async def main():
    parser = argparse.ArgumentParser(
        description="Diagnose corpus building gaps"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_SCRAPE_FILE,
        help="Path to scraped JSON file",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of entries to check (for testing)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay between API calls (seconds)",
    )
    parser.add_argument(
        "--save-report",
        type=Path,
        default=None,
        help="Save detailed report to JSON file",
    )
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    
    if not args.input.exists():
        raise SystemExit(f"Scraped file not found: {args.input}")
    
    entries = load_scraped_entries(args.input)
    if args.limit:
        entries = entries[:args.limit]
    
    logger.info("Loaded %d entries from %s", len(entries), args.input)
    
    results = DiagnosticResults()
    
    async with httpx.AsyncClient() as client:
        for idx, entry in enumerate(entries, 1):
            logger.info("\n[%d/%d] Processing: %s", idx, len(entries), entry.get("title", "")[:60])
            try:
                await diagnose_entry(client, entry, results, args.delay)
            except Exception:
                logger.exception("Error processing entry")
    
    results.print_summary()
    
    if args.save_report:
        report = {
            "summary": {
                "total_entries": results.total_entries,
                "has_doi": results.has_doi,
                "has_title_only": results.has_title_only,
                "doi_found": results.doi_found,
                "doi_not_found": results.doi_not_found,
                "title_found": results.title_found,
                "title_not_found": results.title_not_found,
                "has_pdf": results.has_pdf,
                "no_pdf": results.no_pdf,
            },
            "failed_entries": results.failed_entries,
            "no_pdf_entries": results.no_pdf_entries,
        }
        
        with open(args.save_report, "w") as f:
            json.dump(report, f, indent=2)
        
        logger.info("Detailed report saved to %s", args.save_report)


if __name__ == "__main__":
    asyncio.run(main())