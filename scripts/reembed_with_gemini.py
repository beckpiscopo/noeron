#!/usr/bin/env python3
"""
Re-embed paper chunks using Gemini text-embedding-004.

Run this AFTER applying the 013_upgrade_to_gemini_embeddings.sql migration.

Usage:
    python scripts/reembed_with_gemini.py
    python scripts/reembed_with_gemini.py --batch-size 50
    python scripts/reembed_with_gemini.py --dry-run
"""

import os
import sys
import time
import argparse
from pathlib import Path

# Add project root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

from scripts.supabase_client import get_db

# Gemini embedding config
GEMINI_EMBEDDING_MODEL = "text-embedding-004"
_GEMINI_CLIENT = None


def get_gemini_client():
    """Get or create the Gemini client."""
    global _GEMINI_CLIENT
    if _GEMINI_CLIENT is None:
        from google import genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is required")
        _GEMINI_CLIENT = genai.Client(api_key=api_key)
    return _GEMINI_CLIENT


def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts using Gemini."""
    client = get_gemini_client()
    result = client.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        contents=texts,
    )
    return [e.values for e in result.embeddings]


def main():
    parser = argparse.ArgumentParser(description="Re-embed paper chunks with Gemini")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for embedding")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of chunks to process (for testing)")
    args = parser.parse_args()

    print("=" * 60)
    print("Re-embedding paper chunks with Gemini text-embedding-004")
    print("=" * 60)

    # Connect to Supabase
    print("\nConnecting to Supabase...")
    db = get_db(use_service_key=True)

    if not db.test_connection():
        print("ERROR: Could not connect to Supabase")
        sys.exit(1)
    print("✓ Connected to Supabase")

    # Get all chunks
    print("\nFetching paper chunks...")
    query = db.client.table("paper_chunks").select("id, paper_id, chunk_index, text")

    if args.limit:
        query = query.limit(args.limit)

    response = query.execute()
    chunks = response.data

    print(f"✓ Found {len(chunks)} chunks to re-embed")

    if args.dry_run:
        print("\n[DRY RUN] Would process the following chunks:")
        for i, chunk in enumerate(chunks[:10]):
            print(f"  - {chunk['paper_id']} chunk {chunk['chunk_index']}: {len(chunk['text'])} chars")
        if len(chunks) > 10:
            print(f"  ... and {len(chunks) - 10} more")
        print("\nRun without --dry-run to actually process.")
        return

    # Process in batches
    print(f"\nProcessing in batches of {args.batch_size}...")
    total_processed = 0
    total_errors = 0
    start_time = time.time()

    for i in range(0, len(chunks), args.batch_size):
        batch = chunks[i:i + args.batch_size]
        batch_num = i // args.batch_size + 1
        total_batches = (len(chunks) + args.batch_size - 1) // args.batch_size

        print(f"\nBatch {batch_num}/{total_batches} ({len(batch)} chunks)...")

        try:
            # Extract texts
            texts = [c["text"] for c in batch]

            # Get embeddings
            embeddings = get_embeddings_batch(texts)

            # Update each chunk
            for chunk, embedding in zip(batch, embeddings):
                try:
                    db.client.table("paper_chunks").update({
                        "embedding": embedding
                    }).eq("id", chunk["id"]).execute()
                    total_processed += 1
                except Exception as e:
                    print(f"  ERROR updating chunk {chunk['id']}: {e}")
                    total_errors += 1

            print(f"  ✓ Processed {len(batch)} chunks")

            # Rate limiting - Gemini has limits
            if i + args.batch_size < len(chunks):
                time.sleep(0.5)  # Small delay between batches

        except Exception as e:
            print(f"  ERROR processing batch: {e}")
            total_errors += len(batch)
            # Continue with next batch
            continue

    elapsed = time.time() - start_time

    print("\n" + "=" * 60)
    print("Re-embedding complete!")
    print("=" * 60)
    print(f"Total processed: {total_processed}")
    print(f"Total errors: {total_errors}")
    print(f"Time elapsed: {elapsed:.1f}s")

    if total_errors == 0:
        print("\n✓ All chunks re-embedded successfully!")
        print("\nNext steps:")
        print("1. Run this SQL in Supabase to create the index:")
        print("   CREATE INDEX idx_paper_chunks_embedding ON paper_chunks")
        print("       USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);")
        print("2. Test vector search with a query")
        print("3. Deploy to Railway")
    else:
        print(f"\n⚠ {total_errors} errors occurred. Check logs above.")


if __name__ == "__main__":
    main()
