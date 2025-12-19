#!/usr/bin/env python3
"""
Run a quick quality audit of `data/grobid_fulltext/*.json`.

The script verifies that each JSON payload contains the expected metadata,
checks for non-empty full text / sections, and compares the extracted text
length against the PDF page count (via `pypdf`) to flag suspiciously short
outputs.
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import pypdf

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_JSON_DIR = ROOT_DIR / "data" / "grobid_fulltext"
DEFAULT_PDF_DIR = ROOT_DIR / "data" / "pdfs"

logger = logging.getLogger("grobid_quality")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def summarize_issues(full_text: str, sections: Dict[str, str], metadata: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    if not metadata.get("title") or not metadata.get("title").strip():
        issues.append("missing metadata.title")
    if not full_text.strip():
        issues.append("empty content.full_text")
    if not sections or all(not section.strip() for section in sections.values()):
        issues.append("sections empty")
    if metadata.get("abstract") is None:
        issues.append("metadata.abstract null")
    if not metadata.get("authors"):
        issues.append("metadata.authors empty")
    if not metadata.get("venue") and not metadata.get("journal"):
        issues.append("venue/journal missing")
    return issues


def assess_document(
    json_path: Path,
    pdf_dir: Path,
    min_chars_per_page: int,
) -> Dict[str, Any]:
    payload = load_json(json_path)
    paper_id = payload.get("paper_id", json_path.stem)
    content = payload.get("content", {})
    metadata = payload.get("metadata", {})

    full_text = content.get("full_text", "") or ""
    sections = content.get("sections", {}) or {}

    pdf_path = Path(payload.get("pdf_path") or (pdf_dir / f"{paper_id}.pdf")).resolve()

    pdf_exists = pdf_path.exists()
    page_count: int | None = None
    if pdf_exists:
        try:
            reader = pypdf.PdfReader(pdf_path)
            page_count = len(reader.pages)
        except Exception as exc:  # pragma: no cover - best-effort
            logger.warning("Unable to read PDF %s: %s", pdf_path, exc)

    issues = summarize_issues(full_text, sections, metadata)

    if not pdf_exists:
        issues.append("pdf missing")
    elif page_count and len(full_text) < page_count * min_chars_per_page:
        issues.append(
            f"extracted text is suspiciously short ({len(full_text)} chars vs {page_count} pages)"
        )

    return {
        "paper_id": paper_id,
        "json_path": str(json_path),
        "pdf_path": str(pdf_path),
        "issues": issues,
        "full_text_chars": len(full_text),
        "pages": page_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit GROBID JSON payloads.")
    parser.add_argument(
        "--json-dir",
        type=Path,
        default=DEFAULT_JSON_DIR,
        help="Directory containing the GROBID JSON output",
    )
    parser.add_argument(
        "--pdf-dir",
        type=Path,
        default=DEFAULT_PDF_DIR,
        help="Fallback directory for cached PDFs",
    )
    parser.add_argument(
        "--min-chars-per-page",
        type=int,
        default=250,
        help="Minimum characters per page to consider the extraction complete",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=ROOT_DIR / "data" / "grobid_quality_report.json",
        help="Path to write the quality report (JSON)",
    )
    parser.add_argument(
        "--fail-on-issues",
        action="store_true",
        help="Exit with 1 if any flagged issues are found",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    json_files = sorted(args.json_dir.glob("*.json"))
    if not json_files:
        raise SystemExit(f"No JSON files found in {args.json_dir}")

    results = [assess_document(path, args.pdf_dir, args.min_chars_per_page) for path in json_files]

    total_issues = sum(bool(entry["issues"]) for entry in results)
    report = {
        "checked_at": datetime.utcnow().isoformat() + "Z",
        "json_dir": str(args.json_dir.resolve()),
        "pdf_dir": str(args.pdf_dir.resolve()),
        "documents": results,
        "summary": {
            "total_documents": len(results),
            "documents_with_issues": total_issues,
        },
    }

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    logger.info(
        "Checked %d documents (%d with issues) -> %s",
        len(results),
        total_issues,
        args.report,
    )

    if args.fail_on_issues and total_issues:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

