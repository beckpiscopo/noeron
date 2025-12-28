#!/usr/bin/env python3
"""Run verification on existing cached RAG results without re-running Gemini.

This script reads an existing podcast claims cache, runs the VerificationAgent
on each RAG match, and injects verification data into the cache.

Supports two verification layers:
1. Heuristic verification (free, fast) - temporal, citation, cross-reference checks
2. Semantic verification (LLM-powered) - deep content analysis via Gemini

Usage:
    # Heuristic only (free):
    python scripts/run_verification_on_cache.py \
        --podcast-id lex_325 \
        --podcast-date 2022-10-01

    # Add semantic verification (uses Gemini API):
    python scripts/run_verification_on_cache.py \
        --podcast-id lex_325 \
        --podcast-date 2022-10-01 \
        --semantic

    # Semantic only on heuristically verified matches (cost-effective):
    python scripts/run_verification_on_cache.py \
        --podcast-id lex_325 \
        --podcast-date 2022-10-01 \
        --semantic \
        --semantic-only-verified

    # Dry run (don't modify cache):
    python scripts/run_verification_on_cache.py \
        --podcast-id lex_325 \
        --podcast-date 2022-10-01 \
        --semantic \
        --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    # dotenv not installed, try manual loading
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        import os
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())

from agents.verification_agent import VerificationAgent, SemanticVerifier
from src.bioelectricity_research.vector_store import VectorStore


def extract_paper_id_from_source_link(source_link: str) -> Optional[str]:
    """Extract paper ID from Semantic Scholar URL."""
    if not source_link:
        return None
    # Format: https://semanticscholar.org/paper/{paper_id}
    parts = source_link.rstrip("/").split("/")
    if len(parts) >= 1:
        return parts[-1].lower()
    return None


def load_cache(cache_path: Path) -> Dict[str, Any]:
    """Load existing podcast claims cache."""
    if not cache_path.exists():
        raise FileNotFoundError(f"Cache file not found: {cache_path}")
    return json.loads(cache_path.read_text())


def save_cache(cache_path: Path, data: Dict[str, Any]) -> None:
    """Save updated cache back to disk."""
    cache_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def fetch_matched_text(
    claim_text: str,
    paper_id: str,
    vector_store: VectorStore,
) -> Optional[str]:
    """Fetch the matched text from vector store for a claim-paper pair."""
    results = vector_store.search(claim_text, n_results=10)
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    # Find the chunk that matches the paper_id
    for doc, meta in zip(documents, metadatas):
        chunk_paper_id = (meta.get("paper_id") or meta.get("paperId") or "").lower()
        if chunk_paper_id == paper_id.lower():
            return doc

    # If no exact match, return the first result as fallback
    return documents[0] if documents else None


def extract_claim_context(claim_text: str, transcript: str, context_chars: int = 300) -> str:
    """Extract surrounding context for a claim from the transcript.

    Returns text before and after the claim to help understand rhetorical structure.
    """
    if not transcript or not claim_text:
        return ""

    # Normalize whitespace for matching
    claim_normalized = " ".join(claim_text.split())
    transcript_normalized = " ".join(transcript.split())

    # Find position of claim in transcript (case-insensitive, partial match)
    claim_lower = claim_normalized.lower()[:50]
    transcript_lower = transcript_normalized.lower()

    pos = transcript_lower.find(claim_lower)
    if pos == -1:
        return ""

    # Extract context before and after
    start = max(0, pos - context_chars)
    end = min(len(transcript_normalized), pos + len(claim_normalized) + context_chars)

    context = transcript_normalized[start:end]

    # Format with markers
    claim_start = pos - start
    claim_end = claim_start + len(claim_normalized)

    before = context[:claim_start].strip()
    after = context[claim_end:].strip()

    formatted = ""
    if before:
        formatted += f"[BEFORE]: ...{before}\n"
    formatted += f"[CLAIM]: {claim_normalized}\n"
    if after:
        formatted += f"[AFTER]: {after}..."

    return formatted


def run_heuristic_verification(
    cache_data: Dict[str, Any],
    verification_agent: VerificationAgent,
    vector_store: VectorStore,
    podcast_date: datetime,
) -> Dict[str, Any]:
    """Run heuristic verification on all RAG results in the cache.

    Returns:
        Summary statistics about the verification run.
    """
    segments = cache_data.get("segments", {})

    stats = {
        "total_segments": len(segments),
        "total_matches": 0,
        "verified_count": 0,
        "flagged_count": 0,
        "flags_breakdown": {},
        "skipped_no_paper_id": 0,
    }

    context = {"podcast_date": podcast_date}

    for segment_key, segment_data in segments.items():
        rag_results = segment_data.get("rag_results", [])

        for rag_result in rag_results:
            stats["total_matches"] += 1

            # Extract paper_id from source_link
            source_link = rag_result.get("source_link", "")
            paper_id = extract_paper_id_from_source_link(source_link)

            if not paper_id:
                stats["skipped_no_paper_id"] += 1
                rag_result["verification"] = {
                    "verified": False,
                    "confidence": 0.0,
                    "flags": ["MISSING_PAPER_ID"],
                    "reasoning": "Could not extract paper ID from source link.",
                    "details": {},
                }
                continue

            # Build claim_data dict for verify_match
            claim_data = {
                "claim_text": rag_result.get("claim_text", ""),
            }

            # Run verification
            verification_result = verification_agent.verify_match(
                claim_data=claim_data,
                matched_paper_id=paper_id,
                vector_store=vector_store,
                context=context,
            )

            # Inject verification into rag_result
            rag_result["verification"] = verification_result

            # Update stats
            if verification_result.get("verified"):
                stats["verified_count"] += 1

            flags = verification_result.get("flags", [])
            if flags:
                stats["flagged_count"] += 1
                for flag in flags:
                    stats["flags_breakdown"][flag] = stats["flags_breakdown"].get(flag, 0) + 1

    return stats


async def run_semantic_verification(
    cache_data: Dict[str, Any],
    semantic_verifier: SemanticVerifier,
    vector_store: VectorStore,
    only_verified: bool = False,
    max_concurrent: int = 5,
) -> Dict[str, Any]:
    """Run semantic verification on RAG results.

    Args:
        cache_data: The cache data with heuristic verification already run
        semantic_verifier: The SemanticVerifier instance
        vector_store: Vector store for fetching matched text
        only_verified: If True, only run on heuristically verified matches
        max_concurrent: Maximum concurrent API calls

    Returns:
        Summary statistics about the semantic verification run.
    """
    segments = cache_data.get("segments", {})

    stats = {
        "total_candidates": 0,
        "processed": 0,
        "skipped_not_verified": 0,
        "skipped_no_text": 0,
        "verdict_breakdown": {},
        "errors": 0,
    }

    # Collect items to verify
    items_to_verify: List[Dict[str, Any]] = []

    for segment_key, segment_data in segments.items():
        rag_results = segment_data.get("rag_results", [])
        transcript = segment_data.get("transcript_text", "")

        for rag_result in rag_results:
            stats["total_candidates"] += 1

            # Skip if only_verified and not heuristically verified
            heuristic = rag_result.get("verification", {})
            if only_verified and not heuristic.get("verified"):
                stats["skipped_not_verified"] += 1
                continue

            # Get paper_id
            source_link = rag_result.get("source_link", "")
            paper_id = extract_paper_id_from_source_link(source_link)

            if not paper_id:
                continue

            # Fetch matched text from vector store
            claim_text = rag_result.get("claim_text", "")
            matched_text = fetch_matched_text(claim_text, paper_id, vector_store)

            if not matched_text:
                stats["skipped_no_text"] += 1
                continue

            # Extract surrounding context from transcript
            context_text = extract_claim_context(claim_text, transcript)

            items_to_verify.append({
                "rag_result": rag_result,
                "claim_text": claim_text,
                "paper_title": rag_result.get("paper_title", ""),
                "section": rag_result.get("section", ""),
                "matched_text": matched_text,
                "context_text": context_text,
            })

    print(f"  Running semantic verification on {len(items_to_verify)} matches...")

    # Process in batches with progress
    semaphore = asyncio.Semaphore(max_concurrent)
    processed = 0

    async def verify_one(item: Dict[str, Any]) -> None:
        nonlocal processed
        async with semaphore:
            result = await semantic_verifier.verify_async(
                claim_text=item["claim_text"],
                paper_title=item["paper_title"],
                section=item["section"],
                matched_text=item["matched_text"],
                context_text=item.get("context_text", ""),
            )

            # Inject semantic verification into rag_result
            item["rag_result"]["semantic_verification"] = result

            # Update stats
            verdict = result.get("verdict", "insufficient")
            stats["verdict_breakdown"][verdict] = stats["verdict_breakdown"].get(verdict, 0) + 1

            if result.get("error"):
                stats["errors"] += 1

            processed += 1
            if processed % 20 == 0:
                print(f"    Processed {processed}/{len(items_to_verify)}...")

    await asyncio.gather(*[verify_one(item) for item in items_to_verify])

    stats["processed"] = processed
    return stats


def print_heuristic_summary(stats: Dict[str, Any], podcast_id: str) -> None:
    """Print heuristic verification summary to console."""
    print("\n" + "=" * 60)
    print(f"HEURISTIC VERIFICATION SUMMARY: {podcast_id}")
    print("=" * 60)
    print(f"Total segments:     {stats['total_segments']}")
    print(f"Total RAG matches:  {stats['total_matches']}")
    print(f"Verified:           {stats['verified_count']} ({stats['verified_count']/max(1, stats['total_matches'])*100:.1f}%)")
    print(f"Flagged:            {stats['flagged_count']} ({stats['flagged_count']/max(1, stats['total_matches'])*100:.1f}%)")

    if stats.get("skipped_no_paper_id"):
        print(f"Skipped (no ID):    {stats['skipped_no_paper_id']}")

    if stats.get("flags_breakdown"):
        print("\nFlags breakdown:")
        for flag, count in sorted(stats["flags_breakdown"].items(), key=lambda x: -x[1]):
            print(f"  {flag}: {count}")

    print("=" * 60)


def print_semantic_summary(stats: Dict[str, Any]) -> None:
    """Print semantic verification summary to console."""
    print("\n" + "=" * 60)
    print("SEMANTIC VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"Total candidates:   {stats['total_candidates']}")
    print(f"Processed:          {stats['processed']}")

    if stats.get("skipped_not_verified"):
        print(f"Skipped (not verified): {stats['skipped_not_verified']}")
    if stats.get("skipped_no_text"):
        print(f"Skipped (no text):  {stats['skipped_no_text']}")
    if stats.get("errors"):
        print(f"Errors:             {stats['errors']}")

    if stats.get("verdict_breakdown"):
        print("\nVerdict breakdown:")
        for verdict, count in sorted(stats["verdict_breakdown"].items(), key=lambda x: -x[1]):
            pct = count / max(1, stats["processed"]) * 100
            print(f"  {verdict}: {count} ({pct:.1f}%)")

    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Run verification on existing cached RAG results."
    )
    parser.add_argument(
        "--podcast-id",
        required=True,
        help="Podcast ID (e.g., 'lex_325')",
    )
    parser.add_argument(
        "--podcast-date",
        required=True,
        help="Podcast publication date in YYYY-MM-DD format (e.g., '2022-10-01')",
    )
    parser.add_argument(
        "--cache-dir",
        default="cache",
        help="Directory containing cache files (default: cache)",
    )
    parser.add_argument(
        "--cleaned-papers-dir",
        default="data/cleaned_papers",
        help="Directory containing cleaned paper JSONs (default: data/cleaned_papers)",
    )
    parser.add_argument(
        "--vectorstore-dir",
        default="data/vectorstore",
        help="Directory containing ChromaDB vectorstore (default: data/vectorstore)",
    )
    parser.add_argument(
        "--semantic",
        action="store_true",
        help="Enable semantic verification using Gemini (requires GEMINI_API_KEY)",
    )
    parser.add_argument(
        "--semantic-only-verified",
        action="store_true",
        help="Only run semantic verification on heuristically verified matches (saves cost)",
    )
    parser.add_argument(
        "--semantic-model",
        default=None,
        help="Gemini model for semantic verification (default: gemini-2.0-flash)",
    )
    parser.add_argument(
        "--max-concurrent",
        type=int,
        default=5,
        help="Maximum concurrent API calls for semantic verification (default: 5)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run verification but don't save changes to cache",
    )

    args = parser.parse_args()

    # Parse podcast date
    try:
        podcast_date = datetime.strptime(args.podcast_date, "%Y-%m-%d")
    except ValueError:
        print(f"Error: Invalid date format '{args.podcast_date}'. Use YYYY-MM-DD.")
        sys.exit(1)

    # Build cache path
    cache_path = Path(args.cache_dir) / f"podcast_{args.podcast_id}_claims.json"

    print(f"Loading cache: {cache_path}")
    try:
        cache_data = load_cache(cache_path)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    print(f"Initializing VerificationAgent (corpus: {args.cleaned_papers_dir})...")
    verification_agent = VerificationAgent(cleaned_papers_dir=args.cleaned_papers_dir)
    print(f"  Loaded {len(verification_agent.papers)} papers into corpus")

    print(f"Initializing VectorStore ({args.vectorstore_dir})...")
    vector_store = VectorStore(persist_dir=args.vectorstore_dir)
    print(f"  Vector store has {vector_store.get_stats()['total_chunks']} chunks")

    # Run heuristic verification
    print(f"\nRunning heuristic verification (podcast date: {podcast_date.date()})...")
    heuristic_stats = run_heuristic_verification(
        cache_data=cache_data,
        verification_agent=verification_agent,
        vector_store=vector_store,
        podcast_date=podcast_date,
    )
    print_heuristic_summary(heuristic_stats, args.podcast_id)

    # Run semantic verification if requested
    semantic_stats = None
    if args.semantic:
        print("Initializing SemanticVerifier...")
        try:
            semantic_verifier = SemanticVerifier(model_name=args.semantic_model)
            print(f"  Model: {semantic_verifier.model_name}")

            semantic_stats = asyncio.run(
                run_semantic_verification(
                    cache_data=cache_data,
                    semantic_verifier=semantic_verifier,
                    vector_store=vector_store,
                    only_verified=args.semantic_only_verified,
                    max_concurrent=args.max_concurrent,
                )
            )
            print_semantic_summary(semantic_stats)

        except RuntimeError as e:
            print(f"Error initializing semantic verifier: {e}")
            print("Skipping semantic verification.")

    # Update verification metadata
    cache_data["verification_metadata"] = {
        "verified_at": datetime.now().isoformat(),
        "podcast_date": podcast_date.isoformat(),
        "heuristic_stats": heuristic_stats,
        "semantic_stats": semantic_stats,
    }

    if args.dry_run:
        print("DRY RUN: Cache not modified.")
    else:
        save_cache(cache_path, cache_data)
        print(f"Cache updated: {cache_path}")


if __name__ == "__main__":
    main()
