import argparse
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import tiktoken

logger = logging.getLogger(__name__)

@dataclass
class Chunk:
    """A chunk of text with metadata."""
    text: str
    paper_id: str
    paper_title: str
    section_heading: str
    chunk_index: int
    token_count: int
    metadata: Dict
    page: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the chunk for export."""
        return {
            "text": self.text,
            "paper_id": self.paper_id,
            "paper_title": self.paper_title,
            "section_heading": self.section_heading,
            "chunk_index": self.chunk_index,
            "token_count": self.token_count,
            "metadata": self.metadata,
            "page": self.page,
        }

class PaperChunker:
    """Chunk papers intelligently using section boundaries."""
    
    def __init__(self, chunk_size: int = 400, overlap: int = 50):
        """
        Args:
            chunk_size: Target tokens per chunk
            overlap: Overlap tokens between chunks
        """
        self.chunk_size = chunk_size
        self.overlap = overlap
        # Using cl100k_base (GPT-4 tokenizer) for consistency
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return len(self.tokenizer.encode(text))
    
    def chunk_text(self, text: str, max_tokens: int) -> List[str]:
        """Split text into overlapping chunks."""
        tokens = self.tokenizer.encode(text)
        chunks = []
        
        start = 0
        while start < len(tokens):
            # Get chunk
            end = start + max_tokens
            chunk_tokens = tokens[start:end]
            chunk_text = self.tokenizer.decode(chunk_tokens)
            chunks.append(chunk_text)
            
            # Move window with overlap
            start = end - self.overlap
            if start >= len(tokens):
                break
        
        return chunks
    
    def chunk_paper(self, paper: Dict) -> List[Chunk]:
        """
        Chunk a paper using section boundaries when possible.
        Falls back to sliding window for long sections.
        Paper dict must include 'paper_id', 'title', 'authors', 'year', 'source_path', and a list of 'sections'
        where each section has 'heading' and 'text'.
        """
        chunks = []
        chunk_index = 0
        
        # Process each section
        for section in paper['sections']:
            section_text = section['text']
            section_heading = section['heading'] or 'Introduction'
            section_page = section.get('page')
            
            if not section_text.strip():
                logging.debug(
                    "Skipping empty section %r from %s", section_heading, paper['paper_id']
                )
                continue
            
            # If section fits in one chunk, use it as-is
            token_count = self.count_tokens(section_text)
            
            metadata = {
                'authors': paper['authors'],
                'year': paper['year'],
                'source_path': paper['source_path'],
            }
            if section_page:
                metadata['page'] = section_page

            if token_count <= self.chunk_size:
                chunks.append(Chunk(
                    text=section_text,
                    paper_id=paper['paper_id'],
                    paper_title=paper['title'],
                    section_heading=section_heading,
                    chunk_index=chunk_index,
                    token_count=token_count,
                    metadata=metadata,
                    page=section_page,
                ))
                chunk_index += 1
            else:
                # Split long section into overlapping chunks
                section_chunks = self.chunk_text(section_text, self.chunk_size)
                for sub_chunk in section_chunks:
                    chunks.append(Chunk(
                        text=sub_chunk,
                        paper_id=paper['paper_id'],
                        paper_title=paper['title'],
                        section_heading=section_heading,
                        chunk_index=chunk_index,
                        token_count=self.count_tokens(sub_chunk),
                        metadata=metadata,
                        page=section_page,
                    ))
                    chunk_index += 1
        
        return chunks
    
    def chunk_papers(self, papers: List[Dict]) -> List[Chunk]:
        """Chunk multiple papers."""
        all_chunks = []
        
        for paper in papers:
            paper_chunks = self.chunk_paper(paper)
            all_chunks.extend(paper_chunks)
            logger.info("✓ %s... → %d chunks", paper['title'][:50], len(paper_chunks))
        
        return all_chunks

def setup_logging(verbose: bool) -> None:
    """Configure module-level logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments exposing adjustable parameters."""
    parser = argparse.ArgumentParser(
        description="Chunk processed GROBID papers with configurable sizing."
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=400,
        help="Target token count per chunk (default: 400).",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=50,
        help="Token overlap between consecutive chunks (default: 50).",
    )
    parser.add_argument(
        "--papers-dir",
        type=Path,
        default=Path("data/cleaned_papers"),
        help="Directory with cleaned paper JSON to chunk.",
    )
    parser.add_argument(
        "--process-raw",
        action="store_true",
        help="Regenerate papers by running scripts.prepare_texts.process_all_papers before chunking.",
    )
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path("data/grobid_fulltext"),
        help="Source directory containing raw GROBID JSON (used when --process-raw is set).",
    )
    parser.add_argument(
        "--export-path",
        type=Path,
        help="Path to write chunk metadata (JSON or NDJSON) once chunking completes.",
    )
    parser.add_argument(
        "--output-format",
        choices=["ndjson", "json"],
        default="ndjson",
        help="Export format for chunks (default: ndjson).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logs.",
    )
    return parser.parse_args()

def load_cleaned_papers(papers_dir: Path) -> List[Dict]:
    """Load preprocessed paper JSON files created by prepare_texts."""
    papers: List[Dict] = []
    if not papers_dir.exists():
        logger.warning("Cleaned papers directory %s not found", papers_dir)
        return papers

    for path in sorted(papers_dir.glob("*.json")):
        try:
            with path.open("r", encoding="utf-8") as fh:
                papers.append(json.load(fh))
        except Exception as exc:
            logger.warning("Skipping %s: %s", path.name, exc)

    logger.info("Loaded %d cleaned papers from %s", len(papers), papers_dir)
    return papers

def export_chunks(chunks: Iterable[Chunk], output_path: Path, *, ndjson: bool = True) -> None:
    """Persist chunk metadata in the requested format."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mode = "w"
    if ndjson:
        with output_path.open(mode, encoding="utf-8") as out_f:
            for chunk in chunks:
                json.dump(chunk.to_dict(), out_f, ensure_ascii=False)
                out_f.write("\n")
    else:
        data = [chunk.to_dict() for chunk in chunks]
        with output_path.open(mode, encoding="utf-8") as out_f:
            json.dump(data, out_f, ensure_ascii=False, indent=2)

def main() -> None:
    args = parse_args()
    setup_logging(args.verbose)

    if args.process_raw:
        from prepare_texts import process_all_papers
        papers = process_all_papers(data_dir=args.raw_dir)
    else:
        papers = load_cleaned_papers(args.papers_dir)
        if not papers:
            logger.warning(
                "No cleaned papers found; falling back to raw GROBID data at %s",
                args.raw_dir,
            )
            from prepare_texts import process_all_papers
            papers = process_all_papers(data_dir=args.raw_dir)

    chunker = PaperChunker(chunk_size=args.chunk_size, overlap=args.overlap)
    chunks = chunker.chunk_papers(papers)

    total_chunks = len(chunks)
    avg_tokens = (
        sum(chunk.token_count for chunk in chunks) / total_chunks if total_chunks else 0
    )
    logger.info("Total chunks: %d", total_chunks)
    logger.info("Average tokens per chunk: %.0f", avg_tokens)

    if chunks:
        sample = chunks[0]
        logger.info("Sample chunk → paper=%s section=%s tokens=%d", sample.paper_title, sample.section_heading, sample.token_count)
        logger.debug("Sample chunk text preview: %s", sample.text[:200])
    else:
        logger.warning("Chunker produced zero chunks")

    if args.export_path and chunks:
        export_chunks(
            chunks,
            args.export_path,
            ndjson=(args.output_format == "ndjson"),
        )
        logger.info("Wrote chunks to %s in %s format", args.export_path, args.output_format)


if __name__ == "__main__":
    main()