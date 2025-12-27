#!/usr/bin/env python3
"""
Filters the DOI list from a scraped source before feeding it into the corpus builder.

This script loads the scraped publication list (default: Levin publications), compares
each DOI/title against `data/papers_collection.json`, and only runs Semantic Scholar lookups
for the missing entries. It reuses the same `enrich_entry` logic so rate limiting and storage
behaviors remain consistent.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, Iterable, List

import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "src"))
sys.path.insert(0, str(ROOT_DIR))

from scripts.corpus_builder import enrich_entry, load_scraped_entries
from bioelectricity_research.storage import PaperStorage

DEFAULT_SCRAPED = ROOT_DIR / "data" / "scraped" / "levin_publications_raw.json"
DEFAULT_BACKOFF = 10.0
DEFAULT_DELAY = 1.0


def load_existing_metadata(storage: PaperStorage) -> tuple[set[str], set[str]]:
    """Return saved DOIs and titles (case-insensitive) from the collection."""
    saved = storage.load().get("papers", {})
    dois: set[str] = set()
    titles: set[str] = set()
    for paper in saved.values():
        metadata = paper.get("metadata", {})
        doi = metadata.get("doi", "")
        title = metadata.get("title", "")
        if doi:
            dois.add(doi.lower().strip())
        if title:
            titles.add(title.lower().strip())
    return dois, titles


def filter_entries(
    entries: List[Dict[str, any]],
    saved_dois: set[str],
    saved_titles: set[str],
) -> List[Dict[str, any]]:
    filtered: List[Dict[str, any]] = []
    for entry in entries:
        doi = entry.get("identifiers", {}).get("DOI")
        title = entry.get("title", "").lower().strip()
        if doi and doi.lower().strip() in saved_dois:
            continue
        if title and title in saved_titles:
            continue
        filtered.append(entry)
    return filtered


async def enrich_batch(
    entries: Iterable[Dict[str, any]],
    storage: PaperStorage,
    rate_limit_delay: float,
    rate_limit_backoff: float,
) -> None:
    async with httpx.AsyncClient() as client:
        for entry in entries:
            await enrich_entry(
                client=client,
                storage=storage,
                entry=entry,
                force=False,
                rate_limit_delay=rate_limit_delay,
                rate_limit_backoff=rate_limit_backoff,
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the corpus builder only on DOIs not already saved."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SCRAPED,
        help="Scraped JSON file with publication metadata",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N filtered entries",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help="Seconds to wait between Semantic Scholar requests",
    )
    parser.add_argument(
        "--backoff",
        type=float,
        default=DEFAULT_BACKOFF,
        help="Seconds to wait after a 429 response",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress informational logging",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    if not args.source.exists():
        raise SystemExit(f"No scraped file found at {args.source}")

    entries = load_scraped_entries(args.source)
    if not entries:
        raise SystemExit("No publications in the scraped payload")

    storage = PaperStorage()
    saved_dois, saved_titles = load_existing_metadata(storage)
    filtered = filter_entries(entries, saved_dois, saved_titles)

    if args.limit:
        filtered = filtered[: args.limit]

    logging.info("Filtered down to %d entries to fetch", len(filtered))
    if not filtered:
        logging.info("Nothing new to do.")
        return

    await enrich_batch(
        filtered,
        storage,
        rate_limit_delay=args.delay,
        rate_limit_backoff=args.backoff,
    )


def run() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    run()

