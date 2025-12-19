#!/usr/bin/env python3
"""
Backfill missing abstracts by hitting the Semantic Scholar Graph API.

Scan the GROBID quality report for papers whose metadata still lack an
abstract, query Semantic Scholar for each (preferring the stored Semantic Scholar
paperId, otherwise falling back to DOI), and update the JSON payloads and the
core storage metadata when a non-empty abstract is returned.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import time
from pathlib import Path
from typing import Iterable, List, Optional

import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_REPORT = ROOT_DIR / "data" / "grobid_quality_report.json"
DEFAULT_JSON_DIR = ROOT_DIR / "data" / "grobid_fulltext"

logger = logging.getLogger("semantic_scholar_abstracts")


def load_quality_report(report_path: Path) -> Iterable[Path]:
    if not report_path.exists():
        raise SystemExit(f"Report not found: {report_path}")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    for doc in report.get("documents", []):
        if "metadata.abstract null" in doc.get("issues", []):
            yield Path(doc["json_path"])


def fetch_abstract(
    paper_id: Optional[str],
    doi: Optional[str],
    client: httpx.Client,
    api_key: Optional[str],
) -> Optional[str]:
    identifier = None
    if paper_id:
        identifier = paper_id
    elif doi:
        identifier = f"DOI:{doi}"

    if not identifier:
        return None

    headers = {}
    if api_key:
        headers["x-api-key"] = api_key

    response = client.get(
        f"https://api.semanticscholar.org/graph/v1/paper/{identifier}",
        params={"fields": "paperId,abstract"},
        headers=headers,
        timeout=httpx.Timeout(20.0),
    )
    response.raise_for_status()
    json_payload = response.json()
    abstract = json_payload.get("abstract")
    if abstract:
        return abstract.strip()
    return None


def update_payload(path: Path, abstract: str) -> bool:
    payload = json.loads(path.read_text(encoding="utf-8"))
    metadata = payload.setdefault("metadata", {})
    if metadata.get("abstract"):
        return False
    metadata["abstract"] = abstract
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return True


def update_storage(paper_id: str, abstract: str) -> bool:
    try:
        from bioelectricity_research.storage import PaperStorage
    except ImportError:
        return False

    storage = PaperStorage()
    stored = storage.get_paper(paper_id)
    if not stored:
        return False
    metadata = stored.setdefault("metadata", {})
    if metadata.get("abstract"):
        return False
    metadata["abstract"] = abstract
    storage.add_paper(paper_id, stored)
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill abstracts with Semantic Scholar data.")
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="Quality report pointing to JSON payloads",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=os.environ.get("SEMANTIC_SCHOLAR_API_KEY"),
        help="Optional Semantic Scholar API key (env SEMANTIC_SCHOLAR_API_KEY)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.3,
        help="Delay between Semantic Scholar calls (seconds)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    json_paths = list(load_quality_report(args.report))
    if not json_paths:
        logger.info("No documents with missing abstracts found in %s", args.report)
        return

    updated: List[str] = []
    with httpx.Client() as client:
        for json_path in json_paths:
            try:
                payload = json.loads(json_path.read_text(encoding="utf-8"))
            except FileNotFoundError:
                logger.warning("Missing JSON payload %s", json_path)
                continue

            metadata = payload.get("metadata", {})
            s2_id = metadata.get("paperId")
            doi = metadata.get("doi")
            abstract = fetch_abstract(s2_id, doi, client, args.api_key)
            if not abstract:
                logger.info("No abstract returned for %s (paper_id=%s doi=%s)", json_path.name, s2_id, doi)
                continue

            if update_payload(json_path, abstract):
                updated.append(json_path.stem)
                update_storage(json_path.stem, abstract)
            time.sleep(args.delay)

    if updated:
        logger.info("Updated abstracts for %d documents: %s", len(updated), ", ".join(updated))
        logger.info("Rerun scripts/grobid_quality_check.py to refresh the report")
    else:
        logger.info("No abstracts were updated")


if __name__ == "__main__":
    main()

