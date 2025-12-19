from typing import List, Dict
from dataclasses import dataclass
import tiktoken

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
        """
        chunks = []
        chunk_index = 0
        
        # Process each section
        for section in paper['sections']:
            section_text = section['text']
            section_heading = section['heading'] or 'Introduction'
            
            # If section fits in one chunk, use it as-is
            token_count = self.count_tokens(section_text)
            
            if token_count <= self.chunk_size:
                chunks.append(Chunk(
                    text=section_text,
                    paper_id=paper['paper_id'],
                    paper_title=paper['title'],
                    section_heading=section_heading,
                    chunk_index=chunk_index,
                    token_count=token_count,
                    metadata={
                        'authors': paper['authors'],
                        'year': paper['year'],
                        'source_path': paper['source_path']
                    }
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
                        metadata={
                            'authors': paper['authors'],
                            'year': paper['year'],
                            'source_path': paper['source_path']
                        }
                    ))
                    chunk_index += 1
        
        return chunks
    
    def chunk_papers(self, papers: List[Dict]) -> List[Chunk]:
        """Chunk multiple papers."""
        all_chunks = []
        
        for paper in papers:
            paper_chunks = self.chunk_paper(paper)
            all_chunks.extend(paper_chunks)
            print(f"✓ {paper['title'][:50]}... → {len(paper_chunks)} chunks")
        
        return all_chunks

if __name__ == '__main__':
    from prepare_texts import process_all_papers
    
    # Load papers
    papers = process_all_papers()
    
    # Chunk them
    chunker = PaperChunker(chunk_size=400, overlap=50)
    chunks = chunker.chunk_papers(papers)
    
    print(f"\nTotal chunks: {len(chunks)}")
    print(f"Average tokens per chunk: {sum(c.token_count for c in chunks) / len(chunks):.0f}")
    
    # Preview
    print(f"\nSample chunk:")
    c = chunks[0]
    print(f"Paper: {c.paper_title}")
    print(f"Section: {c.section_heading}")
    print(f"Tokens: {c.token_count}")
    print(f"Text preview: {c.text[:200]}...")