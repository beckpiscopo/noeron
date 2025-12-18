#!/usr/bin/env python3
"""
Scrape Michael Levin's lab publications for the MCP corpus.

This script downloads the publications listing at https://drmichaellevin.org/publications/,
extracts the available metadata, and saves a raw JSON dump for inspection.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://drmichaellevin.org"
PUBLICATIONS_PATH = "/publications/"
HEADERS = {"User-Agent": "BioelectricityResearchMCP/1.5 (Scraper)"}

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
SCRAPED_DIR = DATA_DIR / "scraped"
SCRAPED_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_OUTPUT = SCRAPED_DIR / "levin_publications_raw.json"

DEFAULT_DELAY_SECONDS = 1.5
DEFAULT_MAX_PAGES = 10

logger = logging.getLogger("scrape_levin_papers")


def slugify(text: str) -> str:
    """Create a filesystem-safe identifier."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "publication"


def normalize_url(base_url: str, link: Optional[str]) -> Optional[str]:
    if not link:
        return None
    return urljoin(base_url, link)


def parse_authors(meta_text: str) -> List[str]:
    """Heuristic split of author list from free text."""
    first_sentence = meta_text.split(".", 1)[0]
    if "," in first_sentence or ";" in first_sentence or " and " in first_sentence.lower():
        parts = re.split(r",|;| and ", first_sentence)
    else:
        parts = [first_sentence]
    return [part.strip() for part in parts if part.strip()]


def extract_year(meta_text: str) -> Optional[int]:
    match = re.search(r"\b(19|20)\d{2}\b", meta_text)
    return int(match.group()) if match else None


def extract_venue(meta_text: str) -> Optional[str]:
    cleaned = re.split(r"\.|\||\n", meta_text)
    if len(cleaned) > 1:
        return cleaned[-1].strip()
    return cleaned[0].strip() if cleaned else None


def parse_publication_block(block, base_url: str) -> Optional[Dict]:
    heading = block.find(["h2", "h3", "h4"])
    if not heading:
        return None

    title = heading.get_text(" ", strip=True)
    if not title:
        return None

    detail_link_tag = heading.find("a") or (heading if heading.name == "a" else None)
    detail_url = normalize_url(
        base_url,
        detail_link_tag.get("href") if detail_link_tag else None,
    )

    assays = []
    pdf_url: Optional[str] = None
    identifiers: Dict[str, str] = {}

    for anchor in block.find_all("a", href=True):
        href = normalize_url(base_url, anchor["href"])
        if not href:
            continue
        if "doi.org" in href.lower():
            doi_value = href.split("doi.org/")[-1]
            identifiers["DOI"] = doi_value
        elif href.lower().endswith(".pdf"):
            pdf_url = href
        else:
            assays.append(href)

    paragraphs = [p.get_text(" ", strip=True) for p in block.find_all("p") if p.get_text(strip=True)]
    meta_text = " ".join(paragraphs[:2]) if paragraphs else ""

    authors = parse_authors(meta_text) if meta_text else []
    year = extract_year(meta_text)
    venue = extract_venue(meta_text) if meta_text else None

    return {
        "title": title,
        "detail_url": detail_url,
        "pdf_url": pdf_url,
        "meta_text": meta_text,
        "authors": authors,
        "year": year,
        "venue": venue,
        "identifiers": identifiers,
        "related_links": assays,
        "source": "drmichaellevin.org",
    }


def parse_publication_paragraph(paragraph, base_url: str) -> Optional[Dict]:
    title_tag = paragraph.find("strong")
    if not title_tag:
        return None

    title = title_tag.get_text(" ", strip=True)
    if not title:
        return None

    text_content = paragraph.get_text(" ", strip=True)
    pre_title = text_content.split(title, 1)[0]
    authors = parse_authors(pre_title)
    year = extract_year(text_content)

    venue_tag = paragraph.find("em")
    venue = venue_tag.get_text(" ", strip=True) if venue_tag else None

    identifiers: Dict[str, str] = {}
    match = re.search(r"doi[:\s]*([^\s,<]+)", text_content, flags=re.I)
    if match:
        identifiers["DOI"] = match.group(1)

    pdf_url: Optional[str] = None
    related = []
    for anchor in paragraph.find_all("a", href=True):
        href = normalize_url(base_url, anchor["href"])
        if not href:
            continue
        if href.lower().endswith(".pdf"):
            pdf_url = href
        else:
            related.append(href)

    return {
        "title": title,
        "detail_url": None,
        "pdf_url": pdf_url,
        "meta_text": text_content,
        "authors": authors,
        "year": year,
        "venue": venue,
        "identifiers": identifiers,
        "related_links": related,
        "source": "drmichaellevin.org",
    }


def extract_publications_from_soup(soup: BeautifulSoup, base_url: str) -> List[Dict]:
    container = soup.select_one("div.content") or soup
    publications = []

    cards = container.find_all(["article", "div"], recursive=False)
    if not cards:
        cards = container.find_all("article")

    for card in cards:
        entry = parse_publication_block(card, base_url)
        if entry:
            publications.append(entry)

    # Fallback for paragraph-based listings (Levin's page)
    for paragraph in container.find_all("p"):
        entry = parse_publication_paragraph(paragraph, base_url)
        if entry:
            publications.append(entry)

    return publications


def find_next_page(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    candidates = soup.find_all("a", string=re.compile(r"next", re.I))
    if candidates:
        return normalize_url(base_url, candidates[0].get("href"))

    pagination = soup.select("nav a, .pagination a")
    for link in pagination:
        text = link.get_text(" ", strip=True).lower()
        if "next" in text or "older" in text:
            return normalize_url(base_url, link.get("href"))
    return None


def fetch_html(client: httpx.Client, url: str) -> Optional[str]:
    try:
        response = client.get(url, headers=HEADERS, timeout=30.0)
        response.raise_for_status()
        return response.text
    except Exception as exc:
        logger.warning("Skipping %s: %s", url, exc)
        return None


def extract_detail_info(
    client: httpx.Client,
    detail_url: str,
    delay: float,
) -> Dict[str, Optional[str]]:
    time.sleep(delay)
    html = fetch_html(client, detail_url)
    if not html:
        return {}

    soup = BeautifulSoup(html, "html.parser")
    paragraphs = [
        p.get_text(" ", strip=True)
        for p in soup.select("article p, div.entry-content p")
        if p.get_text(strip=True)
    ]

    abstract = None
    for paragraph in paragraphs:
        if paragraph and "abstract" in paragraph.lower():
            abstract = re.sub(r"^abstract[:\s]*", "", paragraph, flags=re.I).strip()
            break

    if not abstract and paragraphs:
        abstract = paragraphs[0]

    snippet = " ".join(paragraphs[:3]) if paragraphs else None

    return {"abstract": abstract, "detail_snippet": snippet}


def dedupe_publications(entries: List[Dict]) -> List[Dict]:
    seen: Dict[str, Dict] = {}
    for entry in entries:
        key = entry["identifiers"].get("DOI") or entry.get("detail_url") or f"{entry['title']}_{entry.get('year')}"
        slug_key = slugify(key)
        entry["local_id"] = slug_key
        seen.setdefault(slug_key, entry)
    return list(seen.values())


def main():
    parser = argparse.ArgumentParser(description="Scrape Michael Levin lab publications")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Path to the raw JSON output file",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY_SECONDS,
        help="Seconds to wait between requests",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help="Maximum number of publication pages to crawl",
    )
    parser.add_argument(
        "--skip-details",
        action="store_true",
        help="Skip visiting individual publication detail pages",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress info logs",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    publications: List[Dict] = []
    visited_pages = set()
    current_url = normalize_url(BASE_URL, PUBLICATIONS_PATH)
    pages = 0

    with httpx.Client() as client:
        while current_url and pages < args.max_pages:
            if current_url in visited_pages:
                break

            logger.info("Fetching %s", current_url)
            html = fetch_html(client, current_url)
            if not html:
                break

            soup = BeautifulSoup(html, "html.parser")
            entries = extract_publications_from_soup(soup, BASE_URL)
            logger.info("Found %d entries on page %s", len(entries), current_url)

            for entry in entries:
                if not args.skip_details and entry.get("detail_url"):
                    logger.info("Visiting detail page for %s", entry["title"])
                    detail_info = extract_detail_info(client, entry["detail_url"], args.delay)
                    entry.update({k: v for k, v in detail_info.items() if v})

                publications.append(entry)

            visited_pages.add(current_url)
            pages += 1
            next_page = find_next_page(soup, BASE_URL)
            if not next_page:
                break

            current_url = next_page
            time.sleep(max(0, args.delay))

    deduped = dedupe_publications(publications)
    payload = {
        "scraped_at": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "page_count": pages,
        "publication_count": len(deduped),
        "publications": deduped,
    }

    output_path.write_text(json.dumps(payload, indent=2))
    logger.info("Saved %d publications to %s", len(deduped), output_path)


if __name__ == "__main__":
    main()

