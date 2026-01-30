#!/usr/bin/env python3
"""
Upload paper figures to Supabase storage.

Prerequisites:
1. Create "paper-figures" bucket in Supabase Dashboard
2. Enable "Public bucket" setting
3. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env

Usage:
    python scripts/upload_figures_to_supabase.py [--force] [--limit N]
"""

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.supabase_client import get_db

BUCKET_NAME = "paper-figures"
FIGURES_DIR = REPO_ROOT / "data" / "figure_images"
METADATA_PATH = REPO_ROOT / "data" / "figures_metadata.json"


def upload_figure(db, paper_id: str, figure_id: str, local_path: Path) -> str | None:
    """Upload a figure to Supabase storage and return the public URL."""
    if not local_path.exists():
        return None

    # Storage path: paper_id/figure_id.png
    storage_path = f"{paper_id}/{figure_id}.png"

    try:
        # Read file bytes
        with open(local_path, "rb") as f:
            file_bytes = f.read()

        # Check if already exists by trying to get URL
        try:
            # Upload to Supabase
            db.client.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": "image/png"}
            )
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                pass  # File already exists, just get the URL
            else:
                raise

        # Get public URL
        public_url = db.client.storage.from_(BUCKET_NAME).get_public_url(storage_path)
        return public_url

    except Exception as e:
        print(f"    [ERROR] Upload failed for {figure_id}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Upload figures to Supabase storage")
    parser.add_argument("--force", action="store_true", help="Re-upload all figures")
    parser.add_argument("--limit", type=int, default=None, help="Limit papers to process")
    parser.add_argument("--paper-id", type=str, help="Process single paper")
    args = parser.parse_args()

    print("=" * 60)
    print("PAPER FIGURES UPLOAD TO SUPABASE")
    print("=" * 60)
    print()

    # Load metadata
    if not METADATA_PATH.exists():
        print("[ERROR] figures_metadata.json not found. Run extract_figures.py first.")
        return 1

    with open(METADATA_PATH) as f:
        metadata = json.load(f)

    figures_by_paper = metadata.get("figures_by_paper", {})
    print(f"Found {metadata.get('total_figures', 0)} figures across {len(figures_by_paper)} papers")

    # Connect to Supabase
    print("\nConnecting to Supabase...")
    try:
        db = get_db(use_service_key=True)
        print("[OK] Connected\n")
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        print("\nMake sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env")
        return 1

    # Filter papers
    if args.paper_id:
        if args.paper_id in figures_by_paper:
            papers_to_process = {args.paper_id: figures_by_paper[args.paper_id]}
        else:
            print(f"[ERROR] Paper {args.paper_id} not found")
            return 1
    else:
        papers_to_process = dict(list(figures_by_paper.items())[:args.limit] if args.limit else figures_by_paper.items())

    # Upload figures
    total_uploaded = 0
    total_skipped = 0
    updated_figures = {}

    for i, (paper_id, figures) in enumerate(papers_to_process.items()):
        print(f"\n[{i+1}/{len(papers_to_process)}] {paper_id}")
        updated_paper_figures = []

        for fig in figures:
            fig_copy = fig.copy()

            # Skip if already has URL and not forcing
            if fig.get("image_url") and not args.force:
                print(f"    {fig['figure_id']}: already uploaded (skipped)")
                total_skipped += 1
                updated_paper_figures.append(fig_copy)
                continue

            # Skip if no local image
            if not fig.get("image_path"):
                updated_paper_figures.append(fig_copy)
                continue

            local_path = REPO_ROOT / fig["image_path"]
            url = upload_figure(db, paper_id, fig["figure_id"], local_path)

            if url:
                fig_copy["image_url"] = url
                print(f"    {fig['figure_id']}: uploaded")
                total_uploaded += 1
            else:
                print(f"    {fig['figure_id']}: failed")

            updated_paper_figures.append(fig_copy)

        updated_figures[paper_id] = updated_paper_figures

    # Merge updates back into metadata
    for paper_id, figures in updated_figures.items():
        figures_by_paper[paper_id] = figures

    # Recalculate stats
    metadata["figures_by_paper"] = figures_by_paper
    metadata["figures_with_urls"] = sum(
        1 for figs in figures_by_paper.values()
        for f in figs if f.get("image_url")
    )

    # Save updated metadata
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Uploaded: {total_uploaded}")
    print(f"  Skipped:  {total_skipped}")
    print(f"  Total with URLs: {metadata['figures_with_urls']}")
    print(f"\nMetadata updated: {METADATA_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
