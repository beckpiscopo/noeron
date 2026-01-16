"""Vector store helpers shared across MCP server and scripts.

Supports both ChromaDB (local) and Supabase pgvector (cloud) backends.
Set USE_SUPABASE=true to use Supabase pgvector.

Production (Supabase) uses Gemini text-embedding-004 for embeddings.
Local dev (ChromaDB) uses sentence-transformers all-MiniLM-L6-v2.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional

# Data source toggle - set to True to use Supabase pgvector
USE_SUPABASE = os.getenv("USE_SUPABASE", "true").lower() == "true"

# Gemini embedding model - 768 dimensions
GEMINI_EMBEDDING_MODEL = "text-embedding-004"

# Lazy-loaded Gemini client
_GEMINI_CLIENT = None


def _get_gemini_client():
    """Get or create the Gemini client for embeddings."""
    global _GEMINI_CLIENT
    if _GEMINI_CLIENT is None:
        from google import genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is required for embeddings")
        _GEMINI_CLIENT = genai.Client(api_key=api_key)
    return _GEMINI_CLIENT


def get_gemini_embedding(text: str) -> List[float]:
    """Generate embedding for a single text using Gemini."""
    client = _get_gemini_client()
    result = client.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        contents=text,
    )
    return result.embeddings[0].values


def get_gemini_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for multiple texts using Gemini."""
    client = _get_gemini_client()
    embeddings = []
    # Gemini has a limit on batch size, process in chunks
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        result = client.models.embed_content(
            model=GEMINI_EMBEDDING_MODEL,
            contents=batch,
        )
        embeddings.extend([e.values for e in result.embeddings])
    return embeddings


class VectorStore:
    """Manage embedding and retrieval for the Bioelectricity vector store (ChromaDB)."""

    def __init__(self, persist_dir: str = "data/vectorstore"):
        import chromadb
        from sentence_transformers import SentenceTransformer

        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)

        self.client = chromadb.PersistentClient(path=str(self.persist_dir))
        self.collection = self.client.get_or_create_collection(
            name="bioelectricity_papers",
            metadata={"description": "Michael Levin bioelectricity research papers"},
        )

        print("Loading embedding model...")
        self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        print("✓ Model loaded")

    def clear_collection(self):
        if self.collection.count():
            print("Clearing existing vector store before ingest...")
            name = self.collection.name
            self.client.delete_collection(name=name)
            self.collection = self.client.get_or_create_collection(
                name=name,
                metadata={"description": "Michael Levin bioelectricity research papers"},
            )
            print("✓ Cleared collection")

    def _sanitize_value(self, value):
        if value is None:
            return ""
        if isinstance(value, (str, bool, int, float)):
            return value
        return str(value)

    def _build_metadata(self, chunk) -> Dict[str, str]:
        raw = {
            "paper_id": chunk.paper_id,
            "paper_title": chunk.paper_title,
            "section_heading": chunk.section_heading,
            "chunk_index": chunk.chunk_index,
            "token_count": chunk.token_count,
            "year": chunk.metadata.get("year", "")
            if chunk.metadata
            else "",
            "source_path": chunk.metadata.get("source_path", "")
            if chunk.metadata
            else "",
        }
        return {k: self._sanitize_value(v) for k, v in raw.items()}

    def add_chunks(self, chunks: List, batch_size: int = 100):
        print(f"Embedding and storing {len(chunks)} chunks...")

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            texts = [c.text for c in batch]
            ids = [f"{c.paper_id}_chunk_{c.chunk_index}" for c in batch]
            metadatas = [self._build_metadata(c) for c in batch]

            embeddings = self.model.encode(texts, show_progress_bar=False)

            self.collection.add(
                ids=ids,
                embeddings=embeddings.tolist(),
                documents=texts,
                metadatas=metadatas,
            )

            print(f"  Processed {min(i + batch_size, len(chunks))}/{len(chunks)} chunks")

        print("✓ All chunks stored")

    def search(self, query: str, n_results: int = 5):
        query_embedding = self.model.encode([query])[0]
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()], n_results=n_results
        )
        return results

    def get_stats(self):
        return {
            "total_chunks": self.collection.count(),
            "persist_dir": str(self.persist_dir),
        }


class SupabaseVectorStore:
    """Manage embedding and retrieval using Supabase pgvector.

    This class provides the same interface as VectorStore but uses
    Supabase's pgvector extension for vector similarity search.
    Uses Gemini text-embedding-004 for embeddings (768 dimensions).
    """

    def __init__(self):
        from scripts.supabase_client import get_db

        self.db = get_db(use_service_key=True)
        print("✓ Supabase pgvector mode (Gemini embeddings)")

    def search(self, query: str, n_results: int = 5, threshold: float = 0.3):
        """Search for similar paper chunks using pgvector.

        Args:
            query: Search query text
            n_results: Maximum number of results to return
            threshold: Minimum similarity threshold (0.0-1.0)

        Returns:
            Results in ChromaDB-compatible format for backward compatibility
        """
        # Generate embedding for query using Gemini
        query_embedding = get_gemini_embedding(query)

        # Call Supabase RPC function
        results = self.db.match_papers(
            query_embedding=query_embedding,
            threshold=threshold,
            count=n_results
        )

        # Transform to ChromaDB-compatible format
        documents = []
        metadatas = []
        distances = []

        for r in results:
            documents.append(r.get("chunk_text", ""))
            metadatas.append({
                "paper_id": r.get("paper_id", ""),
                "paper_title": r.get("paper_title", ""),
                "section_heading": r.get("section_heading", ""),
                "chunk_index": r.get("chunk_index", 0),
                "year": r.get("year", ""),
            })
            # Convert similarity to distance (ChromaDB uses distance, pgvector returns similarity)
            distances.append(1 - r.get("similarity", 0))

        return {
            "documents": [documents],
            "metadatas": [metadatas],
            "distances": [distances],
        }

    def get_stats(self):
        """Get vector store statistics from Supabase."""
        try:
            # Count total chunks
            response = self.db.client.table("paper_chunks").select("id", count="exact").execute()
            total_chunks = response.count if hasattr(response, 'count') else len(response.data)

            return {
                "total_chunks": total_chunks,
                "backend": "supabase_pgvector",
            }
        except Exception as e:
            return {
                "total_chunks": 0,
                "backend": "supabase_pgvector",
                "error": str(e),
            }

    def add_chunks(self, chunks: List, batch_size: int = 50):
        """Add chunks to Supabase (mainly for consistency with VectorStore interface).

        Note: For bulk ingestion, use the migration script instead.
        """
        print(f"Adding {len(chunks)} chunks to Supabase using Gemini embeddings...")

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]

            # Extract texts for batch embedding
            texts = [c.text if hasattr(c, 'text') else c.get('text', '') for c in batch]

            # Get embeddings for entire batch
            embeddings = get_gemini_embeddings_batch(texts)

            rows = []
            for c, text, embedding in zip(batch, texts, embeddings):
                rows.append({
                    "paper_id": c.paper_id if hasattr(c, 'paper_id') else c.get('paper_id'),
                    "chunk_index": c.chunk_index if hasattr(c, 'chunk_index') else c.get('chunk_index'),
                    "section_heading": c.section_heading if hasattr(c, 'section_heading') else c.get('section_heading'),
                    "token_count": c.token_count if hasattr(c, 'token_count') else c.get('token_count'),
                    "text": text,
                    "embedding": embedding,
                })

            try:
                self.db.client.table("paper_chunks").upsert(
                    rows, on_conflict="paper_id,chunk_index"
                ).execute()
                print(f"  Added {min(i + batch_size, len(chunks))}/{len(chunks)} chunks")
            except Exception as e:
                print(f"  Error adding batch: {e}")

        print("✓ All chunks added to Supabase")


def get_vectorstore(persist_dir: str = "data/vectorstore") -> VectorStore | SupabaseVectorStore:
    """Factory function to get the appropriate vector store based on configuration.

    Returns SupabaseVectorStore if USE_SUPABASE is True, otherwise VectorStore (ChromaDB).
    """
    if USE_SUPABASE:
        try:
            return SupabaseVectorStore()
        except Exception as e:
            print(f"Warning: Failed to initialize Supabase vector store: {e}")
            print("Falling back to ChromaDB...")
            return VectorStore(persist_dir)
    return VectorStore(persist_dir)

