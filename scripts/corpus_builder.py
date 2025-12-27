#!/usr/bin/env python3
"""
Enrich Levin publication metadata with Semantic Scholar and save papers.

Loads the raw JSON produced by `scripts/scrape_levin_papers.py`, looks up each paper
via Semantic Scholar (prefer DOI when available, otherwise search by title),
and stores the enriched paper using the same flow as `bioelectricity_research.storage.fetch_and_store_paper`.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "src"))

from bioelectricity_research.server import API_BASE, HEADERS
from bioelectricity_research.storage import PaperStorage, fetch_and_store_paper

DEFAULT_SCRAPE_FILE = Path(__file__).resolve().parent.parent / "data" / "scraped" / "levin_publications_raw.json"
FIELDS = "paperId,title,abstract,authors,year,citationCount,venue,journal,openAccessPdf,externalIds"

logger = logging.getLogger("corpus_builder")


class CrossRefEnricher:
    """Enrich metadata via CrossRef when Semantic Scholar misses."""

    def __init__(self, email: str):
        self.base_url = "https://api.crossref.org/works"
        self.user_agent = f"BioelectricityCorpus/1.0 (mailto:{email})"

    async def get_metadata_by_doi(
        self,
        doi: str,
        client: httpx.AsyncClient,
    ) -> Optional[Dict[str, Any]]:
        try:
            url = f"{self.base_url}/{quote(doi, safe='')}"
            headers = {"User-Agent": self.user_agent}
            response = await client.get(url, headers=headers, timeout=10.0)
            if response.status_code == 404:
                logger.warning("DOI not found in CrossRef: %s", doi)
                return None
            response.raise_for_status()
            message = response.json().get("message", {})
            return self._normalize(message, doi)
        except httpx.HTTPError as exc:
            logger.error("CrossRef lookup failed for %s: %s", doi, exc)
            return None

    def _normalize(self, data: Dict[str, Any], doi: str) -> Dict[str, Any]:
        authors = []
        for author in data.get("author", []):
            name = " ".join(filter(None, [author.get("given"), author.get("family")])).strip()
            if name:
                authors.append({"name": name})

        published = data.get("published-print") or data.get("published-online") or {}
        year = None
        parts = published.get("date-parts") or []
        if parts and parts[0]:
            year = parts[0][0]

        titles = data.get("title", [])
        title = titles[0] if titles else "Untitled"

        pdf_url = None
        for link in data.get("link", []):
            if link.get("content-type") == "application/pdf":
                pdf_url = link.get("URL")
                break

        return {
            "paperId": f"crossref:{doi}",
            "title": title,
            "abstract": data.get("abstract"),
            "authors": authors,
            "year": year,
            "venue": data.get("container-title", [""])[0] if data.get("container-title") else None,
            "journal": {},
            "openAccessPdf": {"url": pdf_url} if pdf_url else None,
            "externalIds": {"DOI": doi},
            "citationCount": None,
            "source": "crossref",
        }


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "publication"


def load_scraped_entries(path: Path) -> List[Dict[str, Any]]:
    with open(path, "r") as f:
        payload = json.load(f)
    return payload.get("publications", [])


async def fetch_paper_by_identifier(
    client: httpx.AsyncClient,
    identifier: str,
    delay: float,
) -> Optional[Dict[str, Any]]:
    encoded = quote(identifier, safe="")
    response = await client.get(
        f"{API_BASE}/paper/{encoded}",
        params={"fields": FIELDS},
        headers=HEADERS,
        timeout=30.0,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    if delay:
        await asyncio.sleep(delay)
    return response.json()


async def search_paper(
    client: httpx.AsyncClient,
    query: str,
    delay: float,
) -> Optional[Dict[str, Any]]:
    response = await client.get(
        f"{API_BASE}/paper/search",
        params={"query": query, "limit": 1, "fields": FIELDS},
        headers=HEADERS,
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json().get("data", [])
    if delay:
        await asyncio.sleep(delay)
    return data[0] if data else None


async def enrich_entry(
    client: httpx.AsyncClient,
    storage: PaperStorage,
    entry: Dict[str, Any],
    force: bool,
    rate_limit_delay: float,
    rate_limit_backoff: float,
    crossref_enricher: Optional[CrossRefEnricher] = None,
) -> Optional[str]:
    title = entry.get("title")
    if not title:
        logger.warning("Skipping entry with no title: %s", entry)
        return None

    identifiers = entry.get("identifiers", {})
    doi = identifiers.get("DOI")
    paper_metadata: Optional[Dict[str, Any]] = None

    if doi:
        logger.info("Searching Semantic Scholar by DOI: %s", doi)
        try:
            paper_metadata = await fetch_paper_by_identifier(client, doi, rate_limit_delay)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning("Rate limited while fetching DOI; sleeping %.1fs", rate_limit_backoff)
                await asyncio.sleep(rate_limit_backoff)
                return None
            raise

    if not paper_metadata:
        search_query = doi or title
        logger.info("Searching Semantic Scholar by title/identifier: %s", search_query)
        try:
            paper_metadata = await search_paper(client, search_query, rate_limit_delay)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning("Rate limited while searching; sleeping %.1fs", rate_limit_backoff)
                await asyncio.sleep(rate_limit_backoff)
                return None
            raise

    if not paper_metadata and doi and crossref_enricher:
        logger.info("Trying CrossRef for DOI %s", doi)
        paper_metadata = await crossref_enricher.get_metadata_by_doi(doi, client)

    if not paper_metadata:
        logger.warning("No Semantic Scholar match for '%s'", title)
        return None

    paper_id = paper_metadata.get("paperId")
    if not paper_id:
        logger.warning("Matched paper had no ID: %s", paper_metadata)
        return None

    if storage.paper_exists(paper_id) and not force:
        logger.info("Paper %s already saved, skipping", paper_id)
        return paper_id

    stored = await fetch_and_store_paper(paper_id, paper_metadata, storage)
    logger.info(
        "Stored '%s' (%s): %s chars full-text",
        stored["metadata"]["title"],
        paper_id,
        len(stored["content"]["full_text"]),
    )
    return paper_id


async def main():
    parser = argparse.ArgumentParser(description="Build corpus from Levin scraped publications")
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_SCRAPE_FILE,
        help="Path to the raw scraped JSON file",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of entries to process (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-download of papers even if they already exist",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress info logs",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Seconds to wait between Semantic Scholar requests (default: 1.0)",
    )
    parser.add_argument(
        "--backoff",
        type=float,
        default=10.0,
        help="Seconds to wait after a 429 rate limit (default: 10.0)",
    )
    parser.add_argument(
        "--crossref-email",
        type=str,
        default="your.email@example.com",
        help="Email to identify CrossRef API requests",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    if not args.input.exists():
        raise SystemExit(f"No scraped file found at {args.input}")

    entries = load_scraped_entries(args.input)
    if not entries:
        raise SystemExit("No publications in the scraped payload")

    if args.limit:
        entries = entries[: args.limit]

    storage = PaperStorage()
    crossref_enricher = CrossRefEnricher(args.crossref_email)

    async with httpx.AsyncClient() as client:
        for idx, entry in enumerate(entries, 1):
            logger.info("Processing [%d/%d]: %s", idx, len(entries), entry.get("title"))
            try:
                await enrich_entry(
                    client,
                    storage,
                    entry,
                    args.force,
                    rate_limit_delay=args.delay,
                rate_limit_backoff=args.backoff,
                crossref_enricher=crossref_enricher,
                )
            except httpx.HTTPStatusError as exc:
                logger.error("Semantic Scholar error for '%s': %s", entry.get("title"), exc)
            except Exception:
                logger.exception("Unexpected error while processing '%s'", entry.get("title"))


def run():
    asyncio.run(main())


if __name__ == "__main__":
    run()


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "publication"


def load_scraped_entries(path: Path) -> List[Dict[str, Any]]:
    with open(path, "r") as f:
        payload = json.load(f)
    return payload.get("publications", [])


async def fetch_paper_by_identifier(
    client: httpx.AsyncClient,
    identifier: str,
    delay: float,
) -> Optional[Dict[str, Any]]:
    encoded = quote(identifier, safe="")
    response = await client.get(
        f"{API_BASE}/paper/{encoded}",
        params={"fields": FIELDS},
        headers=HEADERS,
        timeout=30.0,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    if delay:
        await asyncio.sleep(delay)
    return response.json()


async def search_paper(
    client: httpx.AsyncClient,
    query: str,
    delay: float,
) -> Optional[Dict[str, Any]]:
    response = await client.get(
        f"{API_BASE}/paper/search",
        params={"query": query, "limit": 1, "fields": FIELDS},
        headers=HEADERS,
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json().get("data", [])
    if delay:
        await asyncio.sleep(delay)
    return data[0] if data else None


async def enrich_entry(
    client: httpx.AsyncClient,
    storage: PaperStorage,
    entry: Dict[str, Any],
    force: bool,
    rate_limit_delay: float,
    rate_limit_backoff: float,
) -> Optional[str]:
    title = entry.get("title")
    if not title:
        logger.warning("Skipping entry with no title: %s", entry)
        return None

    identifiers = entry.get("identifiers", {})
    doi = identifiers.get("DOI")
    paper_metadata: Optional[Dict[str, Any]] = None

    if doi:
        logger.info("Searching Semantic Scholar by DOI: %s", doi)
        try:
            paper_metadata = await fetch_paper_by_identifier(client, doi, rate_limit_delay)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning("Rate limited while fetching DOI; sleeping %.1fs", rate_limit_backoff)
                await asyncio.sleep(rate_limit_backoff)
                return None
            raise

    if not paper_metadata:
        search_query = doi or title
        logger.info("Searching Semantic Scholar by title/identifier: %s", search_query)
        try:
            paper_metadata = await search_paper(client, search_query, rate_limit_delay)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning("Rate limited while searching; sleeping %.1fs", rate_limit_backoff)
                await asyncio.sleep(rate_limit_backoff)
                return None
            raise

    if not paper_metadata:
        logger.warning("No Semantic Scholar match for '%s'", title)
        return None

    paper_id = paper_metadata.get("paperId")
    if not paper_id:
        logger.warning("Matched paper had no ID: %s", paper_metadata)
        return None

    if storage.paper_exists(paper_id) and not force:
        logger.info("Paper %s already saved, skipping", paper_id)
        return paper_id

    stored = await fetch_and_store_paper(paper_id, paper_metadata, storage)
    logger.info("Stored '%s' (%s): %s chars full-text", stored["metadata"]["title"], paper_id, len(stored["content"]["full_text"]))
    return paper_id


async def main():
    parser = argparse.ArgumentParser(description="Build corpus from Levin scraped publications")
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_SCRAPE_FILE,
        help="Path to the raw scraped JSON file",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of entries to process (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-download of papers even if they already exist",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress info logs",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Seconds to wait between Semantic Scholar requests (default: 1.0)",
    )
    parser.add_argument(
        "--backoff",
        type=float,
        default=10.0,
        help="Seconds to wait after a 429 rate limit (default: 10.0)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    if not args.input.exists():
        raise SystemExit(f"No scraped file found at {args.input}")

    entries = load_scraped_entries(args.input)
    if not entries:
        raise SystemExit("No publications in the scraped payload")

    if args.limit:
        entries = entries[: args.limit]

    storage = PaperStorage()

    async with httpx.AsyncClient() as client:
        for idx, entry in enumerate(entries, 1):
            logger.info("Processing [%d/%d]: %s", idx, len(entries), entry.get("title"))
            try:
                await enrich_entry(
                    client,
                    storage,
                    entry,
                    args.force,
                    rate_limit_delay=args.delay,
                    rate_limit_backoff=args.backoff,
                )
            except httpx.HTTPStatusError as exc:
                logger.error("Semantic Scholar error for '%s': %s", entry.get("title"), exc)
            except Exception:
                logger.exception("Unexpected error while processing '%s'", entry.get("title"))


def run():
    asyncio.run(main())




def main():
    parser = argparse.ArgumentParser(
        description="Automated corpus builder for bioelectricity research"
    )
    parser.add_argument(
        "--target", 
        type=int, 
        default=500, 
        help="Target number of papers (default: 500)"
    )
    parser.add_argument(
        "--papers-per-search", 
        type=int, 
        default=5,
        help="Papers to save per search (default: 5)"
    )
    parser.add_argument(
        "--search-limit",
        type=int,
        default=15,
        help="Papers to retrieve per search (default: 15)"
    )
    parser.add_argument(
        "--op-delay",
        type=float,
        default=15.0,
        help="Delay between operations in seconds (default: 15)"
    )
    parser.add_argument(
        "--batch-delay",
        type=float,
        default=120.0,
        help="Delay between search batches in seconds (default: 120)"
    )
    parser.add_argument(
        "--rate-limit-backoff",
        type=float,
        default=300.0,
        help="Backoff time after rate limit in seconds (default: 300)"
    )
    
    args = parser.parse_args()
    
    builder = MCPCorpusBuilder(
        target_papers=args.target,
        papers_per_search=args.papers_per_search,
        search_limit=args.search_limit,
        operation_delay=args.op_delay,
        batch_delay=args.batch_delay,
        rate_limit_backoff=args.rate_limit_backoff,
    )
    
    builder.run()


if __name__ == "__main__":
    main()