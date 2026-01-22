#!/usr/bin/env python3
"""
Inspect the metadata that Chromadb persisted so you can compare chunk counts to
`data/cleaned_papers/` and spot duplicate paper_ids.
"""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
import sys

import chromadb


def main() -> None:
    parser = argparse.ArgumentParser(
        description="List paper_id statistics from the saved vector store."
    )
    parser.add_argument(
        "--persist-dir",
        type=Path,
        default=Path("data/vectorstore"),
        help="Directory where chroma stores its files (default: data/vectorstore)",
    )
    parser.add_argument(
        "--show-duplicates",
        action="store_true",
        help="Print every paper_id that appears in more than one chunk.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        help="How many duplicates to show when --show-duplicates is set.",
    )
    args = parser.parse_args()

    persist_dir = args.persist_dir
    if not persist_dir.exists():
        raise SystemExit(f"{persist_dir} does not exist.")

    client = chromadb.PersistentClient(path=str(persist_dir))
    try:
        collection = client.get_collection(name="bioelectricity_papers")
    except chromadb.errors.NoCollectionError:
        raise SystemExit("The 'bioelectricity_papers' collection is not present yet.")

    response = collection.get(include=["metadatas"])
    metadatas = response.get("metadatas", [])

    if not metadatas:
        raise SystemExit("No metadata entries found (did you build the vector store?).")

    paper_ids = [
        meta.get("paper_id", "")
        for meta in metadatas
        if isinstance(meta, dict)
    ]

    total_chunks = len(paper_ids)
    counter = Counter(pid for pid in paper_ids if pid)
    unique_papers = len(counter)

    print(f"Total stored chunks: {total_chunks}")
    print(f"Unique paper_ids: {unique_papers}")

    duplicates = [(pid, count) for pid, count in counter.items() if count > 1]
    if duplicates:
        print(f"Paper_ids with >1 chunk: {len(duplicates)}")
        duplicates.sort(key=lambda item: item[1], reverse=True)
        if args.show_duplicates:
            for pid, count in duplicates[: args.top]:
                print(f"  {pid}: {count} chunks")
    else:
        print("No duplicate paper_ids detected.")


if __name__ == "__main__":
    main()








