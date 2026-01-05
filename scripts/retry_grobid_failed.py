#!/usr/bin/env python3
"""
Generate a list of PDFs that still lack GROBID output so you can retry them.

The script compares `data/pdfs/*.pdf` against `data/grobid_fulltext/*.json`
and writes any mismatches to stdout or a file so you can feed them back to
`scripts/grobid_extract.py`.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def find_missing_json(pdf_dir: Path, json_dir: Path) -> list[Path]:
    missing: list[Path] = []
    for pdf in sorted(pdf_dir.glob("*.pdf")):
        json_path = json_dir / f"{pdf.stem}.json"
        if not json_path.exists():
            missing.append(pdf)
    return missing


def main() -> None:
    parser = argparse.ArgumentParser(description="List PDFs that still need GROBID JSON.")
    parser.add_argument(
        "--pdf-dir",
        type=Path,
        default=Path("data/pdfs"),
        help="Directory containing cached PDFs",
    )
    parser.add_argument(
        "--json-dir",
        type=Path,
        default=Path("data/grobid_fulltext"),
        help="Directory containing existing GROBID JSON output",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional file to save the list",
    )
    args = parser.parse_args()

    missing = find_missing_json(args.pdf_dir, args.json_dir)
    if not missing:
        print("All PDFs already have GROBID JSON.")
        return

    if args.output:
        args.output.write_text("\n".join(str(p) for p in missing))
        print(f"Wrote {len(missing)} filenames to {args.output}")
    else:
        print(f"{len(missing)} PDFs still need GROBID output:")
        for pdf in missing:
            print(pdf)


if __name__ == "__main__":
    main()


