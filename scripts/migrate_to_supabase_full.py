#!/usr/bin/env python3
"""
Full Supabase Migration Script
Migrates JSON files + ChromaDB to Supabase with pgvector.

Usage:
    python scripts/migrate_to_supabase_full.py --all           # Full migration
    python scripts/migrate_to_supabase_full.py --episodes      # Episodes only
    python scripts/migrate_to_supabase_full.py --windows       # Temporal windows only
    python scripts/migrate_to_supabase_full.py --cards         # Evidence cards only
    python scripts/migrate_to_supabase_full.py --papers        # Papers only
    python scripts/migrate_to_supabase_full.py --chunks        # Paper chunks with embeddings
    python scripts/migrate_to_supabase_full.py --dry-run       # Print what would be migrated
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add project root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Load environment
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

from supabase import create_client, Client

# Configuration
DATA_DIR = REPO_ROOT / "data"
BATCH_SIZE = 100
EMBEDDING_BATCH_SIZE = 50
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def get_supabase_client() -> Client:
    """Get authenticated Supabase client with service key."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


def load_json(filename: str) -> Any:
    """Load a JSON file from the data directory."""
    filepath = DATA_DIR / filename
    if filepath.exists():
        with open(filepath) as f:
            return json.load(f)
    return None


def timestamp_to_ms(timestamp: str) -> int:
    """Convert 'HH:MM:SS.mmm' or 'HH:MM:SS' to milliseconds."""
    if not timestamp:
        return 0

    # Clean up timestamp (remove formatting artifacts)
    timestamp = timestamp.split(" ")[0]  # Remove any trailing info

    # Handle various formats
    parts = timestamp.split(".")
    time_part = parts[0]
    ms = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0

    time_parts = time_part.split(":")
    if len(time_parts) == 3:
        h, m, s = map(int, time_parts)
        return (h * 3600 + m * 60 + s) * 1000 + ms
    elif len(time_parts) == 2:
        m, s = map(int, time_parts)
        return (m * 60 + s) * 1000 + ms
    return 0


def parse_segment_key(segment_key: str) -> tuple:
    """Parse 'podcast_id|timestamp|window_id' format."""
    parts = segment_key.split("|")
    if len(parts) >= 3:
        return parts[0], parts[1], parts[2]
    elif len(parts) == 2:
        return parts[0], parts[1], "general"
    return "unknown", "", "general"


def sanitize_text(text: str) -> str:
    """Remove null characters and other problematic Unicode from text."""
    if not text:
        return text
    # Remove null characters that PostgreSQL doesn't support
    return text.replace('\x00', '').replace('\u0000', '')


# =============================================================================
# Migration Functions
# =============================================================================

def migrate_episodes(client: Client, dry_run: bool = False) -> int:
    """
    Migrate episodes.json + episode_summaries.json -> episodes table.
    Maps 'id' from JSON to 'podcast_id' in Supabase.
    """
    print("\n=== Migrating Episodes ===")

    episodes = load_json("episodes.json")
    if not episodes:
        print("  No episodes.json found")
        return 0

    summaries = load_json("episode_summaries.json") or {}

    count = 0
    for episode in episodes:
        episode_id = episode.get("id")
        summary_data = summaries.get(episode_id, {})

        row = {
            "podcast_id": episode_id,
            "title": episode.get("title"),
            "podcast_series": episode.get("podcast"),
            "host": episode.get("host"),
            "guest_name": episode.get("guest"),
            "duration_ms": None,  # Could parse duration string
            "description": episode.get("description"),
            "summary": episode.get("summary"),
            "papers_linked": episode.get("papersLinked", 0),
            "topics": episode.get("key_topics", []),
            "narrative_arc": summary_data.get("narrative_arc"),
            "major_themes": summary_data.get("major_themes"),
            "key_moments": summary_data.get("key_moments"),
            "guest_thesis": summary_data.get("guest_thesis"),
            "conversation_dynamics": summary_data.get("conversation_dynamics"),
        }

        # Parse date
        date_str = episode.get("date")
        if date_str:
            row["published_date"] = date_str

        if dry_run:
            print(f"  [DRY RUN] Would upsert episode: {episode_id}")
        else:
            try:
                client.table("episodes").upsert(row, on_conflict="podcast_id").execute()
                print(f"  Migrated episode: {episode_id}")
                count += 1
            except Exception as e:
                print(f"  ERROR migrating {episode_id}: {e}")

    print(f"  Total: {count} episodes migrated")
    return count


def migrate_temporal_windows(client: Client, dry_run: bool = False) -> int:
    """
    Migrate window_segments.json -> temporal_windows table.
    Handles per-episode window files if they exist.
    """
    print("\n=== Migrating Temporal Windows ===")

    # Get list of episodes to process
    episodes = load_json("episodes.json") or []
    episode_ids = [ep.get("id") for ep in episodes]

    total_count = 0

    for episode_id in episode_ids:
        # Try episode-specific file first
        segments = load_json(f"window_segments_{episode_id}.json")
        if not segments:
            # Fall back to default (only for first episode typically)
            if episode_id == "lex_325":
                segments = load_json("window_segments.json")

        if not segments:
            print(f"  No window segments found for {episode_id}")
            continue

        print(f"  Processing {len(segments)} windows for {episode_id}")

        batch = []
        for window in segments:
            row = {
                "podcast_id": episode_id,
                "window_id": window.get("window_id"),
                "start_timestamp": window.get("start_timestamp"),
                "end_timestamp": window.get("end_timestamp"),
                "start_ms": window.get("start_ms"),
                "end_ms": window.get("end_ms"),
                "text": window.get("text"),
                "utterances": window.get("utterances", []),
            }
            batch.append(row)

            if len(batch) >= BATCH_SIZE:
                if not dry_run:
                    try:
                        client.table("temporal_windows").upsert(
                            batch, on_conflict="podcast_id,window_id"
                        ).execute()
                        total_count += len(batch)
                    except Exception as e:
                        print(f"    ERROR: {e}")
                else:
                    print(f"    [DRY RUN] Would upsert {len(batch)} windows")
                batch = []

        # Final batch
        if batch:
            if not dry_run:
                try:
                    client.table("temporal_windows").upsert(
                        batch, on_conflict="podcast_id,window_id"
                    ).execute()
                    total_count += len(batch)
                except Exception as e:
                    print(f"    ERROR: {e}")
            else:
                print(f"    [DRY RUN] Would upsert {len(batch)} windows")

    print(f"  Total: {total_count} temporal windows migrated")
    return total_count


def migrate_evidence_cards(client: Client, dry_run: bool = False) -> int:
    """
    Migrate context_card_registry.json -> evidence_cards table.
    Parses segment keys and extracts podcast_id/timestamp/window_id.
    """
    print("\n=== Migrating Evidence Cards ===")

    registry = load_json("context_card_registry.json")
    if not registry:
        print("  No context_card_registry.json found")
        return 0

    segments = registry.get("segments", registry)
    if isinstance(segments, dict) and "segments" in segments:
        segments = segments["segments"]

    print(f"  Found {len(segments)} segments to process")

    # Deduplicate by composite key before batching
    seen_keys = set()
    unique_rows = []

    for segment_key, segment_data in segments.items():
        # Parse the segment key
        podcast_id, timestamp, window_id = parse_segment_key(segment_key)

        # Skip invalid entries
        if podcast_id == "unknown" or podcast_id == "unknown_podcast":
            # Try to get from segment data
            podcast_id = segment_data.get("podcast_id", "lex_325")

        if not timestamp:
            timestamp = segment_data.get("timestamp", "")

        # Create composite key for deduplication
        composite_key = f"{podcast_id}|{timestamp}|{window_id}"
        if composite_key in seen_keys:
            continue
        seen_keys.add(composite_key)

        timestamp_ms = timestamp_to_ms(timestamp)

        row = {
            "podcast_id": podcast_id,
            "timestamp": timestamp,
            "timestamp_ms": timestamp_ms,
            "window_id": window_id,
            "speaker": segment_data.get("speaker"),
            "transcript_text": sanitize_text(segment_data.get("transcript_text")),
            "note": segment_data.get("note"),
            "claims": segment_data.get("claims", []),
            "research_queries": segment_data.get("research_queries", []),
            "rag_results": segment_data.get("rag_results", []),
            "card_count": segment_data.get("card_count", 0),
            "context_tags": segment_data.get("context_tags"),
            "gemini_metadata": segment_data.get("gemini_metadata"),
            "last_processed": segment_data.get("last_processed"),
        }
        unique_rows.append(row)

    print(f"  After deduplication: {len(unique_rows)} unique segments")

    count = 0
    skipped = 0
    batch = []

    for row in unique_rows:
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            if not dry_run:
                try:
                    client.table("evidence_cards").upsert(
                        batch, on_conflict="podcast_id,timestamp,window_id"
                    ).execute()
                    count += len(batch)
                    print(f"    Migrated {count} evidence cards...")
                except Exception as e:
                    print(f"    ERROR: {e}")
                    skipped += len(batch)
            else:
                print(f"    [DRY RUN] Would upsert {len(batch)} evidence cards")
            batch = []

    # Final batch
    if batch:
        if not dry_run:
            try:
                client.table("evidence_cards").upsert(
                    batch, on_conflict="podcast_id,timestamp,window_id"
                ).execute()
                count += len(batch)
            except Exception as e:
                print(f"    ERROR: {e}")
                skipped += len(batch)
        else:
            print(f"    [DRY RUN] Would upsert {len(batch)} evidence cards")

    print(f"  Total: {count} evidence cards migrated, {skipped} skipped")
    return count


def migrate_papers(client: Client, dry_run: bool = False) -> int:
    """
    Migrate papers_collection.json -> papers table.
    """
    print("\n=== Migrating Papers ===")

    collection = load_json("papers_collection.json")
    if not collection:
        print("  No papers_collection.json found")
        return 0

    papers = collection.get("papers", {})
    print(f"  Found {len(papers)} papers to process")

    batch = []
    count = 0

    for paper_id, paper_data in papers.items():
        metadata = paper_data.get("metadata", {})
        content = paper_data.get("content", {})
        sections = paper_data.get("sections", {})

        # Extract author names as array
        authors = metadata.get("authors", [])
        author_names = [a.get("name", "") for a in authors if isinstance(a, dict)]

        # Sanitize all text fields to remove null characters
        abstract = metadata.get("abstract") or content.get("abstract")
        full_text = content.get("full_text")

        # Sanitize sections dict values
        if sections:
            sections = {k: sanitize_text(v) if isinstance(v, str) else v
                       for k, v in sections.items()}

        row = {
            "paper_id": paper_id,
            "title": sanitize_text(metadata.get("title", "Unknown")),
            "abstract": sanitize_text(abstract),
            "year": metadata.get("year"),
            "citation_count": metadata.get("citationCount", 0),
            "venue": sanitize_text(metadata.get("venue")),
            "journal": sanitize_text(metadata.get("journal")),
            "doi": metadata.get("doi"),
            "arxiv_id": metadata.get("arxiv"),
            "authors": author_names,
            "url": metadata.get("url"),
            "full_text": sanitize_text(full_text),
            "full_text_available": content.get("full_text_available", False),
            "content_source": content.get("source"),
            "sections": sections if sections else None,
        }
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            if not dry_run:
                try:
                    client.table("papers").upsert(
                        batch, on_conflict="paper_id"
                    ).execute()
                    count += len(batch)
                    print(f"    Migrated {count} papers...")
                except Exception as e:
                    print(f"    ERROR: {e}")
            else:
                print(f"    [DRY RUN] Would upsert {len(batch)} papers")
            batch = []

    # Final batch
    if batch:
        if not dry_run:
            try:
                client.table("papers").upsert(
                    batch, on_conflict="paper_id"
                ).execute()
                count += len(batch)
            except Exception as e:
                print(f"    ERROR: {e}")
        else:
            print(f"    [DRY RUN] Would upsert {len(batch)} papers")

    print(f"  Total: {count} papers migrated")
    return count


def migrate_paper_chunks(client: Client, dry_run: bool = False) -> int:
    """
    Generate embeddings and migrate chunks -> paper_chunks table.
    Uses sentence-transformers model for 384-dim embeddings.
    """
    print("\n=== Migrating Paper Chunks with Embeddings ===")

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("  ERROR: sentence-transformers not installed. Run: pip install sentence-transformers")
        return 0

    # Load papers collection
    collection = load_json("papers_collection.json")
    if not collection:
        print("  No papers_collection.json found")
        return 0

    papers = collection.get("papers", {})

    # Check for existing chunks file (from previous build_vector_store run)
    chunks_file = DATA_DIR / "chunks.json"
    if chunks_file.exists():
        print(f"  Loading existing chunks from {chunks_file}")
        chunks = []
        with open(chunks_file) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        chunks.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        print(f"    Loaded {len(chunks)} chunks from JSONL file")
    else:
        # Import chunker and generate chunks
        print("  No chunks.json found, generating chunks from papers...")
        try:
            from src.chunking_papers import PaperChunker
            chunker = PaperChunker(chunk_size=400, overlap=50)
            chunks = []
            for paper_id, paper_data in papers.items():
                content = paper_data.get("content", {})
                sections = paper_data.get("sections", {})
                title = paper_data.get("metadata", {}).get("title", "Unknown")

                # Get text to chunk
                text = content.get("full_text", "")
                if not text:
                    text = content.get("abstract", "")

                if text:
                    paper_chunks = chunker.chunk_text(
                        text=text,
                        paper_id=paper_id,
                        paper_title=title,
                        sections=sections
                    )
                    chunks.extend([c.__dict__ for c in paper_chunks])

            # Save for reuse (JSONL format)
            with open(chunks_file, "w") as f:
                for chunk in chunks:
                    f.write(json.dumps(chunk) + "\n")
            print(f"    Generated {len(chunks)} chunks")
        except ImportError as e:
            print(f"  ERROR importing chunker: {e}")
            return 0

    print(f"  Processing {len(chunks)} chunks...")

    if dry_run:
        print(f"  [DRY RUN] Would generate embeddings for {len(chunks)} chunks")
        return len(chunks)

    # First, get the list of paper_ids that exist in the database
    print("  Fetching existing paper IDs from database...")
    existing_papers_response = client.table("papers").select("paper_id").execute()
    existing_paper_ids = {p["paper_id"] for p in existing_papers_response.data}
    print(f"    Found {len(existing_paper_ids)} papers in database")

    # Filter chunks to only those with existing papers
    valid_chunks = [c for c in chunks if c.get("paper_id") in existing_paper_ids]
    skipped_chunks = len(chunks) - len(valid_chunks)
    if skipped_chunks > 0:
        print(f"    Skipping {skipped_chunks} chunks with missing paper references")

    print(f"  Will process {len(valid_chunks)} valid chunks")

    # Load embedding model
    print(f"  Loading embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)

    batch = []
    count = 0
    errors = 0

    for i, chunk in enumerate(valid_chunks):
        # Generate embedding
        text = sanitize_text(chunk.get("text", ""))
        if not text:
            continue

        embedding = model.encode(text).tolist()

        row = {
            "paper_id": chunk.get("paper_id"),
            "chunk_index": chunk.get("chunk_index", i),
            "section_heading": chunk.get("section_heading"),
            "token_count": chunk.get("token_count"),
            "text": text,
            "embedding": embedding,
        }
        batch.append(row)

        if len(batch) >= EMBEDDING_BATCH_SIZE:
            try:
                client.table("paper_chunks").upsert(
                    batch, on_conflict="paper_id,chunk_index"
                ).execute()
                count += len(batch)
                print(f"    Migrated {count}/{len(valid_chunks)} chunks...")
            except Exception as e:
                print(f"    ERROR at batch {count}: {e}")
                errors += len(batch)
            batch = []

    # Final batch
    if batch:
        try:
            client.table("paper_chunks").upsert(
                batch, on_conflict="paper_id,chunk_index"
            ).execute()
            count += len(batch)
        except Exception as e:
            print(f"    ERROR at final batch: {e}")
            errors += len(batch)

    print(f"  Total: {count} paper chunks migrated, {errors} errors, {skipped_chunks} skipped (missing papers)")
    return count


def run_full_migration(client: Client, dry_run: bool = False):
    """Run all migration steps in order."""
    print("=" * 60)
    print("FULL SUPABASE MIGRATION")
    print(f"Dry run: {dry_run}")
    print("=" * 60)

    results = {
        "episodes": migrate_episodes(client, dry_run),
        "temporal_windows": migrate_temporal_windows(client, dry_run),
        "evidence_cards": migrate_evidence_cards(client, dry_run),
        "papers": migrate_papers(client, dry_run),
        "paper_chunks": migrate_paper_chunks(client, dry_run),
    }

    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    for table, count in results.items():
        print(f"  {table}: {count} rows")

    return results


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Migrate data to Supabase with pgvector")
    parser.add_argument("--all", action="store_true", help="Run full migration")
    parser.add_argument("--episodes", action="store_true", help="Migrate episodes only")
    parser.add_argument("--windows", action="store_true", help="Migrate temporal windows only")
    parser.add_argument("--cards", action="store_true", help="Migrate evidence cards only")
    parser.add_argument("--papers", action="store_true", help="Migrate papers only")
    parser.add_argument("--chunks", action="store_true", help="Migrate paper chunks with embeddings")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without executing")

    args = parser.parse_args()

    # Check if any action specified
    if not any([args.all, args.episodes, args.windows, args.cards, args.papers, args.chunks]):
        parser.print_help()
        sys.exit(1)

    # Get client
    try:
        client = get_supabase_client()
        print("Connected to Supabase")
    except Exception as e:
        print(f"ERROR: Could not connect to Supabase: {e}")
        sys.exit(1)

    # Run migrations
    if args.all:
        run_full_migration(client, args.dry_run)
    else:
        if args.episodes:
            migrate_episodes(client, args.dry_run)
        if args.windows:
            migrate_temporal_windows(client, args.dry_run)
        if args.cards:
            migrate_evidence_cards(client, args.dry_run)
        if args.papers:
            migrate_papers(client, args.dry_run)
        if args.chunks:
            migrate_paper_chunks(client, args.dry_run)


if __name__ == "__main__":
    main()
