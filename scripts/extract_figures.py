#!/usr/bin/env python3
"""
Extract figure images from PDFs using GROBID coordinates.

Reads GROBID JSON files, parses TEI XML to extract figure metadata,
and uses pdf2image to crop figure regions from the source PDFs.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from xml.etree import ElementTree as ET

from pdf2image import convert_from_path
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "src"))

from bioelectricity_research.storage import PDF_CACHE_DIR  # noqa: E402

GROBID_DIR = ROOT_DIR / "data" / "grobid_fulltext"
FIGURE_OUTPUT_DIR = ROOT_DIR / "data" / "figure_images"
METADATA_PATH = ROOT_DIR / "data" / "figures_metadata.json"

TEI_NS = {"tei": "http://www.tei-c.org/ns/1.0"}

logger = logging.getLogger("figure_extractor")


@dataclass
class FigureCoords:
    """Parsed figure coordinates from GROBID."""
    page: int  # 1-indexed page number
    x: float   # x position in points (72 DPI)
    y: float   # y position in points (72 DPI)
    width: float   # width in points
    height: float  # height in points


@dataclass
class FigureMetadata:
    """Metadata for an extracted figure."""
    figure_id: str
    paper_id: str
    label: Optional[str]
    title: Optional[str]
    caption: Optional[str]
    coords: Optional[FigureCoords]
    image_path: Optional[str]


def parse_coords(coords_str: str) -> Optional[FigureCoords]:
    """
    Parse GROBID coordinate string.

    Format: "page,x,y,width,height" where coordinates are in points at 72 DPI.
    Page numbers are 1-indexed.
    """
    if not coords_str:
        return None

    parts = coords_str.split(",")
    if len(parts) < 5:
        logger.warning("Invalid coords format (expected 5 parts): %s", coords_str)
        return None

    try:
        return FigureCoords(
            page=int(parts[0]),
            x=float(parts[1]),
            y=float(parts[2]),
            width=float(parts[3]),
            height=float(parts[4]),
        )
    except ValueError as e:
        logger.warning("Failed to parse coords %s: %s", coords_str, e)
        return None


def extract_text(element: ET.Element | None) -> str:
    """Extract all text content from an XML element."""
    if element is None:
        return ""
    return "".join(element.itertext()).strip()


def extract_figures_from_tei(tei_xml: str, paper_id: str) -> List[FigureMetadata]:
    """
    Extract figure metadata from TEI XML.

    Parses <figure> elements to extract label, title, caption, and coordinates.
    """
    figures: List[FigureMetadata] = []

    try:
        root = ET.fromstring(tei_xml)
    except ET.ParseError as e:
        logger.error("Failed to parse TEI XML for %s: %s", paper_id, e)
        return figures

    for fig_elem in root.findall(".//tei:figure", TEI_NS):
        xml_id = fig_elem.get("{http://www.w3.org/XML/1998/namespace}id", "")

        # Skip table figures (they have type="table")
        fig_type = fig_elem.get("type", "")
        if fig_type == "table":
            continue

        # Extract label (e.g., "Fig. 1" or "Figure 2")
        head_elem = fig_elem.find("tei:head", TEI_NS)
        label_elem = fig_elem.find("tei:label", TEI_NS)

        label = extract_text(label_elem) or None
        title = extract_text(head_elem) or None

        # Extract caption from figDesc
        figdesc_elem = fig_elem.find("tei:figDesc", TEI_NS)
        caption = extract_text(figdesc_elem) or None

        # Extract coordinates from graphic element
        graphic_elem = fig_elem.find("tei:graphic", TEI_NS)
        coords_str = graphic_elem.get("coords", "") if graphic_elem is not None else ""
        coords = parse_coords(coords_str) if coords_str else None

        # Generate figure ID from xml:id or create one
        if xml_id:
            figure_id = xml_id
        elif label:
            # Create ID from label (e.g., "Fig. 2" -> "fig_2")
            figure_id = re.sub(r"[^a-zA-Z0-9]+", "_", label.lower()).strip("_")
        else:
            figure_id = f"fig_{len(figures)}"

        figures.append(FigureMetadata(
            figure_id=figure_id,
            paper_id=paper_id,
            label=label,
            title=title,
            caption=caption,
            coords=coords,
            image_path=None,
        ))

    return figures


def extract_figure_image(
    pdf_path: Path,
    coords: FigureCoords,
    output_path: Path,
    dpi: int = 150,
    padding: int = 10,
) -> bool:
    """
    Extract a figure region from a PDF page and save as PNG.

    Args:
        pdf_path: Path to the source PDF
        coords: Figure coordinates (page, x, y, width, height in 72 DPI points)
        output_path: Where to save the extracted image
        dpi: Output resolution (default 150)
        padding: Extra pixels to add around the crop region

    Returns:
        True if extraction succeeded, False otherwise
    """
    # Scale factor from 72 DPI points to target DPI pixels
    scale = dpi / 72.0

    try:
        # Convert just the page we need (1-indexed in GROBID, 0-indexed in pdf2image)
        pages = convert_from_path(
            pdf_path,
            dpi=dpi,
            first_page=coords.page,
            last_page=coords.page,
        )

        if not pages:
            logger.warning("No pages extracted from %s page %d", pdf_path, coords.page)
            return False

        page_image = pages[0]

        # Calculate crop box in pixels at target DPI
        # GROBID uses top-left origin, PIL uses top-left origin too
        x1 = int(coords.x * scale) - padding
        y1 = int(coords.y * scale) - padding
        x2 = int((coords.x + coords.width) * scale) + padding
        y2 = int((coords.y + coords.height) * scale) + padding

        # Clamp to image bounds
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(page_image.width, x2)
        y2 = min(page_image.height, y2)

        # Validate crop region
        if x2 <= x1 or y2 <= y1:
            logger.warning(
                "Invalid crop region for %s: (%d,%d,%d,%d)",
                output_path.name, x1, y1, x2, y2
            )
            return False

        # Crop and save
        cropped = page_image.crop((x1, y1, x2, y2))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output_path, "PNG")

        logger.debug(
            "Extracted figure to %s (size: %dx%d)",
            output_path.name, cropped.width, cropped.height
        )
        return True

    except Exception as e:
        logger.error("Failed to extract figure from %s: %s", pdf_path.name, e)
        return False


def process_paper(
    grobid_json_path: Path,
    output_dir: Path,
    dpi: int,
    padding: int,
    force: bool,
) -> List[FigureMetadata]:
    """
    Process a single paper's GROBID JSON to extract all figures.

    Returns list of figure metadata with updated image paths.
    """
    with open(grobid_json_path) as f:
        data = json.load(f)

    paper_id = data.get("paper_id", grobid_json_path.stem)
    tei_xml = data.get("raw_tei", "")
    pdf_path_str = data.get("pdf_path", "")

    if not tei_xml:
        logger.warning("No TEI XML in %s", grobid_json_path.name)
        return []

    # Find PDF path
    if pdf_path_str and Path(pdf_path_str).exists():
        pdf_path = Path(pdf_path_str)
    else:
        # Try default location
        pdf_path = PDF_CACHE_DIR / f"{paper_id}.pdf"
        if not pdf_path.exists():
            logger.warning("PDF not found for %s", paper_id)
            return []

    figures = extract_figures_from_tei(tei_xml, paper_id)
    logger.info("Found %d figures in %s", len(figures), paper_id)

    paper_output_dir = output_dir / paper_id
    extracted_figures: List[FigureMetadata] = []

    for fig in figures:
        if fig.coords is None:
            logger.debug("Skipping %s/%s - no coordinates", paper_id, fig.figure_id)
            # Still include in metadata but without image
            extracted_figures.append(fig)
            continue

        output_path = paper_output_dir / f"{fig.figure_id}.png"

        if output_path.exists() and not force:
            logger.debug("Skipping %s - already exists", output_path)
            fig.image_path = str(output_path.relative_to(ROOT_DIR))
            extracted_figures.append(fig)
            continue

        success = extract_figure_image(
            pdf_path=pdf_path,
            coords=fig.coords,
            output_path=output_path,
            dpi=dpi,
            padding=padding,
        )

        if success:
            fig.image_path = str(output_path.relative_to(ROOT_DIR))

        extracted_figures.append(fig)

    return extracted_figures


def main():
    parser = argparse.ArgumentParser(
        description="Extract figure images from PDFs using GROBID coordinates",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of papers to process",
    )
    parser.add_argument(
        "--paper-id",
        type=str,
        default=None,
        help="Process a single paper by ID",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=150,
        help="Output DPI for extracted figures (default: 150)",
    )
    parser.add_argument(
        "--padding",
        type=int,
        default=10,
        help="Padding in pixels around figure crops (default: 10)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-extract figures even if they already exist",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    # Collect GROBID JSON files to process
    if args.paper_id:
        grobid_files = [GROBID_DIR / f"{args.paper_id}.json"]
        if not grobid_files[0].exists():
            logger.error("GROBID JSON not found: %s", grobid_files[0])
            sys.exit(1)
    else:
        grobid_files = sorted(GROBID_DIR.glob("*.json"))
        if args.limit:
            grobid_files = grobid_files[:args.limit]

    if not grobid_files:
        logger.warning("No GROBID JSON files found in %s", GROBID_DIR)
        sys.exit(1)

    logger.info("Processing %d papers", len(grobid_files))

    # Load existing metadata if present
    all_figures: Dict[str, List[Dict]] = {}
    if METADATA_PATH.exists() and not args.force:
        with open(METADATA_PATH) as f:
            existing = json.load(f)
            all_figures = existing.get("figures_by_paper", {})

    # Process each paper
    total_figures = 0
    total_extracted = 0

    for grobid_path in grobid_files:
        paper_id = grobid_path.stem

        figures = process_paper(
            grobid_json_path=grobid_path,
            output_dir=FIGURE_OUTPUT_DIR,
            dpi=args.dpi,
            padding=args.padding,
            force=args.force,
        )

        if figures:
            all_figures[paper_id] = [
                {
                    "figure_id": f.figure_id,
                    "paper_id": f.paper_id,
                    "label": f.label,
                    "title": f.title,
                    "caption": f.caption,
                    "coords": {
                        "page": f.coords.page,
                        "x": f.coords.x,
                        "y": f.coords.y,
                        "width": f.coords.width,
                        "height": f.coords.height,
                    } if f.coords else None,
                    "image_path": f.image_path,
                }
                for f in figures
            ]
            total_figures += len(figures)
            total_extracted += sum(1 for f in figures if f.image_path)

    # Save metadata index
    metadata = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_papers": len(all_figures),
        "total_figures": sum(len(figs) for figs in all_figures.values()),
        "figures_with_images": sum(
            1 for figs in all_figures.values()
            for f in figs if f.get("image_path")
        ),
        "figures_by_paper": all_figures,
    }

    METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(
        "Processed %d papers, found %d figures, extracted %d images",
        len(grobid_files), total_figures, total_extracted
    )
    logger.info("Metadata saved to %s", METADATA_PATH)


if __name__ == "__main__":
    main()
