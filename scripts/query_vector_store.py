"""CLI helper for querying the embedded vector store.

Usage: python scripts/query_vector_store.py --query "your question" --top-k 5
"""

import argparse
from pathlib import Path
from typing import Dict, List

from build_vector_store import VectorStore


def format_metadata(metadata: Dict[str, str]) -> List[str]:
    """Convert metadata dict into printable lines."""
    lines = []
    for key in ["paper_title", "section_heading", "paper_id", "year", "source_path"]:
        value = metadata.get(key)
        if value:
            lines.append(f"{key.replace('_', ' ').title()}: {value}")
    return lines


def print_results(results: Dict, top_k: int) -> None:
    documents = results.get("documents") or []
    metadatas = results.get("metadatas") or []
    if not documents or not documents[0]:
        print("No matches found.")
        return

    docs = documents[0]
    metas = metadatas[0] if metadatas and metadatas[0] else [{} for _ in docs]
    for index, (doc, meta) in enumerate(zip(docs, metas), start=1):
        print(f"\nResult {index}/{top_k}")
        for entry in format_metadata(meta):
            print(f"  {entry}")
        print(f"  Preview: {doc[:280]}...")


def main() -> None:
    parser = argparse.ArgumentParser(description="Query the ChromaDB-powered vector store.")
    parser.add_argument("--query", "-q", required=True, help="Natural language query string.")
    parser.add_argument("--top-k", "-k", type=int, default=5, help="Number of chunks to display.")
    parser.add_argument(
        "--persist-dir",
        "-p",
        default=Path("data/vectorstore"),
        help="Path where the vectorstore persists.",
    )

    args = parser.parse_args()

    persist_path = Path(args.persist_dir)
    if not persist_path.exists():
        raise SystemExit(f"Persisted vector store not found at {persist_path}")

    vectorstore = VectorStore(persist_dir=str(persist_path))
    results = vectorstore.search(args.query, n_results=args.top_k)

    print(f"\nQuery: {args.query}")
    print_results(results, args.top_k)


if __name__ == "__main__":
    main()

