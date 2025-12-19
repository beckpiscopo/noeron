import json
from pathlib import Path
from typing import Dict, List
import re

def load_paper(json_path: Path) -> Dict:
    """Load a single GROBID JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def clean_text(text: str) -> str:
    """Basic cleaning: collapse whitespace, remove artifacts."""
    # Collapse multiple spaces/newlines
    text = re.sub(r'\s+', ' ', text)
    # Remove common PDF artifacts
    text = re.sub(r'(\w)-\s+(\w)', r'\1\2', text)  # Fix hyphenation
    return text.strip()


def ensure_heading_separator(text: str, heading: str) -> str:
    """Guarantee there is whitespace between the heading and the body text."""
    if not text or not heading:
        return text

    heading = heading.strip()
    if not heading:
        return text

    prefix = text[: len(heading)]
    if prefix.lower() != heading.lower():
        return text

    rest = text[len(prefix) :]
    if rest and not rest[0].isspace():
        rest = " " + rest
    return prefix + rest

def extract_paper_text(paper_data: Dict) -> Dict:
    """
    Extract and clean text from GROBID JSON.
    Returns dict with full_text and sections.
    """
    content = paper_data.get('content', {})
    
    # Get full text
    full_text = content.get('full_text', '')
    full_text = clean_text(full_text)
    
    # Get sections for logical boundaries
    sections = []
    raw_sections = content.get('sections') or {}
    if isinstance(raw_sections, dict):
        iterator = raw_sections.items()
        for heading, text in iterator:
            text = ensure_heading_separator(text, heading)
            sections.append({
                'heading': heading,
                'text': clean_text(text)
            })
    elif isinstance(raw_sections, list):
        for section in raw_sections:
            heading = section.get('heading') or section.get('name') or ''
            text = section.get('text', '')
            text = ensure_heading_separator(text, heading)
            sections.append({
                'heading': heading,
                'text': clean_text(text)
            })
    
    # Get metadata for tracking
    metadata = paper_data.get('metadata', {})
    
    return {
        'paper_id': paper_data.get('paper_id'),
        'title': metadata.get('title', ''),
        'authors': metadata.get('authors', []),
        'year': metadata.get('year'),
        'full_text': full_text,
        'sections': sections,
        'source_path': paper_data.get('source_pdf')
    }

def process_all_papers(
    data_dir: Path = Path('data/grobid_fulltext'),
    output_dir: Path | None = None,
) -> List[Dict]:
    """Process all GROBID JSON files in directory."""
    papers = []
    json_files = list(data_dir.glob('*.json'))
    
    print(f"Found {len(json_files)} papers to process")
    
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    for json_path in json_files:
        try:
            paper_data = load_paper(json_path)
            extracted = extract_paper_text(paper_data)
            papers.append(extracted)
            if output_dir:
                (output_dir / f"{extracted['paper_id']}.json").write_text(
                    json.dumps(extracted, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
            print(f"✓ Processed: {extracted['title'][:60]}...")
        except Exception as e:
            print(f"✗ Error processing {json_path.name}: {e}")
    
    return papers

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description="Clean GROBID JSON and optionally persist the results."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/grobid_fulltext"),
        help="Source directory with raw GROBID JSON",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/cleaned_papers"),
        help="Directory to save cleaned JSON per paper (optional)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Skip saving cleaned files (process in memory only)",
    )
    args = parser.parse_args()

    papers = process_all_papers(
        data_dir=args.input_dir, output_dir=None if args.no_save else args.output_dir
    )
    print(f"\nSuccessfully processed {len(papers)} papers")
    
    # Preview first paper
    if papers:
        p = papers[0]
        print(f"\nSample paper:")
        print(f"Title: {p['title']}")
        print(f"Sections: {len(p['sections'])}")
        print(f"Full text length: {len(p['full_text'])} chars")