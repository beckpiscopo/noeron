#!/usr/bin/env python3
"""
Extract full text JSON from cached PDFs using a running GROBID service.

The script walks the PDF cache, posts each file to GROBID's
`/api/processFulltextDocument`, and normalizes the TEI XML into a compact
JSON payload that contains metadata + extracted sections for downstream use.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from xml.etree import ElementTree as ET
TEI_NS = {"tei": "http://www.tei-c.org/ns/1.0"}
TEI_PREFIX = TEI_NS["tei"]
PB_TAG = f"{{{TEI_PREFIX}}}pb"
DIV_TAG = f"{{{TEI_PREFIX}}}div"
from typing import Dict, Iterable, Optional
from xml.etree import ElementTree as ET

import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "src"))

from bioelectricity_research.storage import PDF_CACHE_DIR, PaperStorage  # noqa: E402

TEI_NS = {"tei": "http://www.tei-c.org/ns/1.0"}

logger = logging.getLogger("grobid_extractor")


def extract_text(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return "".join(element.itertext()).strip()


def tangent_sections(root: ET.Element) -> Dict[str, str]:
    sections: Dict[str, str] = OrderedDict()
    for div in root.findall(".//tei:text/tei:body//tei:div", TEI_NS):
        heading = extract_text(div.find(".//tei:head", TEI_NS))
        section_label = (heading or div.get("type") or div.get("n") or "section").lower()
        body_text = extract_text(div)
        if not body_text:
            continue

        key = section_label
        suffix = 1
        while key in sections:
            suffix += 1
            key = f"{section_label}_{suffix}"
        sections[key] = body_text
    return sections


def parse_tei(tei_xml: str) -> Dict[str, object]:
    root = ET.fromstring(tei_xml)
    title = extract_text(root.find(".//tei:titleStmt/tei:title", TEI_NS))
    abstract = extract_text(root.find(".//tei:abstract", TEI_NS))

    authors = []
    for author in root.findall(".//tei:titleStmt/tei:author", TEI_NS):
        name = extract_text(author.find(".//tei:persName", TEI_NS)) or extract_text(author)
        if name:
            authors.append(name)

    body = root.find(".//tei:text", TEI_NS)
    full_text = extract_text(body)
    sections = tangent_sections(root)

    return {
        "title": title,
        "abstract": abstract,
        "authors": authors,
        "full_text": full_text,
        "sections": sections,
        "raw_tei": tei_xml,
    }


def iter_pdfs(
    directory: Path, paper_ids: Iterable[str] | None, limit: int | None
) -> Iterable[Path]:
    pdfs = sorted(directory.glob("*.pdf"))
    if paper_ids:
        pdfs = [pdf for pdf in pdfs if pdf.stem in paper_ids]
    if limit:
        pdfs = pdfs[:limit]
    return pdfs


def call_grobid(
    pdf_path: Path, grobid_url: str, client: httpx.Client
) -> str:
    logger.info("Posting %s to GROBID", pdf_path.name)
    with pdf_path.open("rb") as fh:
        response = client.post(
            grobid_url,
            files={"input": ("document", fh, "application/pdf")},
            timeout=httpx.Timeout(120.0),
            follow_redirects=True,
        )
        response.raise_for_status()
        return response.text


def ensure_output_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def main():
    parser = argparse.ArgumentParser(
        description="Extract structured JSON via GROBID",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=PDF_CACHE_DIR,
        help="Directory containing cached PDFs",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT_DIR / "data" / "grobid_fulltext",
        help="Directory to write structured JSON files",
    )
    parser.add_argument(
        "--grobid-url",
        type=str,
        default="http://localhost:8070/api/processFulltextDocument",
        help="Endpoint for the running GROBID service",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of PDFs to process",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess PDFs even if JSON already exists",
    )
    parser.add_argument(
        "--paper-ids",
        nargs="*",
        default=None,
        help="Optional subset of paper IDs (stem of PDF filenames) to process",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    storage = PaperStorage()
    collection = storage.load().get("papers", {})
    ensure_output_dir(args.output_dir)

    pdf_paths = iter_pdfs(args.input_dir, args.paper_ids, args.limit)
    if not pdf_paths:
        logger.warning("No PDFs found in %s", args.input_dir)
        return

    with httpx.Client(timeout=httpx.Timeout(120.0)) as client:
        for pdf_path in pdf_paths:
            paper_id = pdf_path.stem
            output_path = args.output_dir / f"{paper_id}.json"
            if output_path.exists() and not args.force:
                logger.info("Skipping %s because JSON already exists", paper_id)
                continue

            try:
                tei_xml = call_grobid(pdf_path, args.grobid_url, client)
                parsed = parse_tei(tei_xml)
                payload = {
                    "paper_id": paper_id,
                    "pdf_path": str(pdf_path),
                    "metadata": collection.get(paper_id, {}).get("metadata", {}),
                    "extracted_at": datetime.utcnow().isoformat() + "Z",
                    "grobid_url": args.grobid_url,
                    "content": {
                        "title": parsed["title"],
                        "authors": parsed["authors"],
                        "abstract": parsed["abstract"],
                        "full_text": parsed["full_text"],
                        "sections": parsed["sections"],
                    },
                    "raw_tei": parsed["raw_tei"],
                }
                output_path.write_text(json.dumps(payload, indent=2))
                logger.info("Saved structured JSON to %s", output_path)
            except httpx.HTTPStatusError as exc:
                logger.warning("GROBID rejected %s: %s", pdf_path.name, exc)
            except Exception as exc:  # pragma: no cover - best-effort extraction
                logger.exception("Failed to process %s: %s", pdf_path.name, exc)


if __name__ == "__main__":
    main()

