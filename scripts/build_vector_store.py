import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from pathlib import Path
from typing import Dict, List

try:
    from chunk_papers import Chunk, PaperChunker
except ModuleNotFoundError:
    from chunking_papers import Chunk, PaperChunker
from prepare_texts import process_all_papers

class VectorStore:
    """Manage embedding and retrieval."""
    
    def __init__(self, persist_dir: str = "data/vectorstore"):
        """Initialize ChromaDB and embedding model."""
        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(path=str(self.persist_dir))
        
        # Create or get collection
        self.collection = self.client.get_or_create_collection(
            name="bioelectricity_papers",
            metadata={"description": "Michael Levin bioelectricity research papers"}
        )
        
        # Initialize embedding model
        print("Loading embedding model...")
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        print("✓ Model loaded")
    
    def clear_collection(self):
        """Drop existing entries so repeated builds don’t hit duplicate ids."""
        if self.collection.count():
            print("Clearing existing vector store before ingest...")
            self.collection.delete(delete_all=True)
            print("✓ Cleared collection")

    def _sanitize_value(self, value):
        """Return a Chroma-safe scalar so metadata has no None references."""
        if value is None:
            return ""
        if isinstance(value, (str, bool, int, float)):
            return value
        return str(value)

    def _build_metadata(self, chunk: Chunk) -> Dict[str, str]:
        """Prepare metadata dict without None entries."""
        raw = {
            'paper_id': chunk.paper_id,
            'paper_title': chunk.paper_title,
            'section_heading': chunk.section_heading,
            'chunk_index': chunk.chunk_index,
            'token_count': chunk.token_count,
            'year': chunk.metadata.get('year', '') if chunk.metadata else '',
            'source_path': chunk.metadata.get('source_path', '') if chunk.metadata else ''
        }

        return {k: self._sanitize_value(v) for k, v in raw.items()}

    def add_chunks(self, chunks: List[Chunk], batch_size: int = 100):
        """Add chunks to vector store."""
        print(f"Embedding and storing {len(chunks)} chunks...")
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            
            # Prepare data
            texts = [c.text for c in batch]
            ids = [f"{c.paper_id}_chunk_{c.chunk_index}" for c in batch]
            
            # Create metadata
            metadatas = [self._build_metadata(c) for c in batch]
            
            # Generate embeddings
            embeddings = self.model.encode(texts, show_progress_bar=False)
            
            # Add to collection
            self.collection.add(
                ids=ids,
                embeddings=embeddings.tolist(),
                documents=texts,
                metadatas=metadatas
            )
            
            print(f"  Processed {min(i+batch_size, len(chunks))}/{len(chunks)} chunks")
        
        print("✓ All chunks stored")
    
    def search(self, query: str, n_results: int = 5) -> Dict:
        """Search for relevant chunks."""
        # Embed query
        query_embedding = self.model.encode([query])[0]
        
        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=n_results
        )
        
        return results
    
    def get_stats(self):
        """Get collection statistics."""
        count = self.collection.count()
        return {
            'total_chunks': count,
            'persist_dir': str(self.persist_dir)
        }

def build_vectorstore():
    """Main pipeline: load papers → chunk → embed → store."""
    print("=== Building Vector Store ===\n")
    
    # Step 1: Load and clean papers
    print("Step 1: Loading papers...")
    papers = process_all_papers()
    print(f"✓ Loaded {len(papers)} papers\n")
    
    # Step 2: Chunk papers
    print("Step 2: Chunking papers...")
    chunker = PaperChunker(chunk_size=400, overlap=50)
    chunks = chunker.chunk_papers(papers)
    print(f"✓ Created {len(chunks)} chunks\n")
    
    # Step 3: Build vector store
    print("Step 3: Building vector store...")
    vectorstore = VectorStore()
    vectorstore.clear_collection()
    vectorstore.add_chunks(chunks)
    
    # Stats
    stats = vectorstore.get_stats()
    print(f"\n=== Complete ===")
    print(f"Total chunks indexed: {stats['total_chunks']}")
    print(f"Stored in: {stats['persist_dir']}")
    
    return vectorstore

if __name__ == '__main__':
    vectorstore = build_vectorstore()
    
    # Test search
    print("\n=== Testing Search ===")
    query = "bioelectric patterns control morphogenesis"
    results = vectorstore.search(query, n_results=3)
    
    print(f"\nQuery: '{query}'")
    documents = results.get("documents") or []
    metadatas = results.get("metadatas") or []
    hits = len(documents[0]) if documents and documents[0] else 0
    print(f"Found {hits} results:\n")

    if hits == 0:
        print("  No matches found.")
    else:
        docs = documents[0]
        metas = metadatas[0] if metadatas and metadatas[0] else [{} for _ in docs]
        for i, (doc, meta) in enumerate(zip(docs, metas)):
            title = meta.get("paper_title", "Untitled paper")
            heading = meta.get("section_heading", "Unknown section")
            print(f"{i+1}. {title[:60]}...")
            print(f"   Section: {heading}")
            print(f"   Preview: {doc[:150]}...")
            print()


