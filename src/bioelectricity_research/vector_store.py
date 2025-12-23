"""Vector store helpers shared across MCP server and scripts."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer


class VectorStore:
    """Manage embedding and retrieval for the Bioelectricity vector store."""

    def __init__(self, persist_dir: str = "data/vectorstore"):
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

