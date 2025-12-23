import sys
from pathlib import Path
from typing import Dict, List

import json

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from bioelectricity_research.vector_store import VectorStore

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

try:
    from chunk_papers import Chunk, PaperChunker
except ModuleNotFoundError:
    from chunking_papers import Chunk, PaperChunker

from prepare_texts import process_all_papers


def load_cleaned_papers(cleaned_dir: Path) -> List[Dict]:
    """Load any pre-cleaned JSON files (transcripts, other manual entries)."""
    papers = []
    seen_ids = set()
    if not cleaned_dir.exists():
        return papers

    for file in cleaned_dir.glob("*.json"):
        try:
            payload = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            continue
        paper_id = payload.get("paper_id")
        if not paper_id or paper_id in seen_ids:
            continue
        seen_ids.add(paper_id)
        papers.append(payload)
    return papers

def build_vectorstore():
    """Main pipeline: load papers → chunk → embed → store."""
    print("=== Building Vector Store ===\n")
    
    # Step 1: Load and clean papers
    print("Step 1: Loading papers...")
    papers = process_all_papers()
    cleaned_dir = Path("data/cleaned_papers")
    cleaned_papers = load_cleaned_papers(cleaned_dir)
    if cleaned_papers:
        print(f"✓ Loaded {len(cleaned_papers)} pre-cleaned transcripts from {cleaned_dir}")
        papers.extend(cleaned_papers)
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


