"""
Storage module for bioelectricity research papers.

Handles:
- JSON persistence
- PDF downloading and parsing
- ArXiv integration
- Section detection
- Paper retrieval and querying
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

import httpx
import pypdf
import arxiv

# Storage file path
STORAGE_DIR = Path(__file__).parent.parent.parent / "data"
STORAGE_FILE = STORAGE_DIR / "papers_collection.json"
PDF_CACHE_DIR = STORAGE_DIR / "pdfs"


class PaperStorage:
    """Manages the paper collection storage."""
    
    def __init__(self):
        """Initialize storage, creating directories and file if needed."""
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        if not STORAGE_FILE.exists():
            self._initialize_storage()
    
    def _initialize_storage(self):
        """Create empty storage file."""
        initial_data = {
            "papers": {},
            "metadata": {
                "total_papers": 0,
                "last_updated": datetime.now().isoformat(),
                "version": "1.5.0"
            }
        }
        with open(STORAGE_FILE, 'w') as f:
            json.dump(initial_data, f, indent=2)
    
    def load(self) -> dict:
        """Load the paper collection."""
        with open(STORAGE_FILE, 'r') as f:
            return json.load(f)
    
    def save(self, data: dict):
        """Save the paper collection."""
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        data["metadata"]["total_papers"] = len(data["papers"])
        
        with open(STORAGE_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    
    def paper_exists(self, paper_id: str) -> bool:
        """Check if paper is already in collection."""
        data = self.load()
        return paper_id in data["papers"]
    
    def get_paper(self, paper_id: str) -> Optional[dict]:
        """Retrieve a specific paper from collection."""
        data = self.load()
        return data["papers"].get(paper_id)
    
    def add_paper(self, paper_id: str, paper_data: dict):
        """Add or update a paper in the collection."""
        data = self.load()
        data["papers"][paper_id] = paper_data
        self.save(data)
    
    def list_papers(
        self,
        min_citations: Optional[int] = None,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        has_full_text: Optional[bool] = None
    ) -> list[dict]:
        """List papers with optional filters."""
        data = self.load()
        papers = []
        
        for paper_id, paper in data["papers"].items():
            # Apply filters
            if min_citations and paper["metadata"].get("citationCount", 0) < min_citations:
                continue
            
            if year_from and paper["metadata"].get("year", 0) < year_from:
                continue
            
            if year_to and paper["metadata"].get("year", 9999) > year_to:
                continue
            
            if has_full_text is not None:
                has_text = paper["content"].get("full_text_available", False)
                if has_text != has_full_text:
                    continue
            
            papers.append({
                "paper_id": paper_id,
                **paper["metadata"]
            })
        
        return papers


class MultiSourcePDFGetter:
    """Resolve PDF URLs from multiple providers."""

    def __init__(self, email: str):
        self.unpaywall_base = "https://api.unpaywall.org/v2"
        self.email = email

    async def get_pdf_url(self, paper_metadata: dict, client: httpx.AsyncClient) -> Optional[str]:
        open_access = paper_metadata.get("openAccessPdf")
        if open_access and open_access.get("url"):
            return open_access["url"]

        doi = paper_metadata.get("externalIds", {}).get("DOI")
        if doi:
            pdf = await self._check_unpaywall(doi, client)
            if pdf:
                return pdf

        arxiv_id = paper_metadata.get("externalIds", {}).get("ArXiv")
        if arxiv_id:
            arxiv_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
            if await self._verify_url(arxiv_url, client):
                return arxiv_url

        pmc_id = paper_metadata.get("externalIds", {}).get("PubMedCentral")
        if pmc_id:
            pmc_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/pdf/"
            if await self._verify_url(pmc_url, client):
                return pmc_url

        doi_url = f"https://doi.org/{doi}" if doi else None
        if doi_url and await self._verify_url(doi_url, client):
            return doi_url

        return None

    async def _check_unpaywall(self, doi: str, client: httpx.AsyncClient) -> Optional[str]:
        try:
            url = f"{self.unpaywall_base}/{quote(doi, safe='')}"
            response = await client.get(
                url,
                params={"email": self.email},
                timeout=10.0,
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            best_oa = data.get("best_oa_location")
            if best_oa and best_oa.get("url_for_pdf"):
                return best_oa["url_for_pdf"]
            for location in data.get("oa_locations", []):
                if location.get("url_for_pdf"):
                    return location["url_for_pdf"]
            return None
        except httpx.HTTPError:
            return None

    async def _verify_url(self, url: str, client: httpx.AsyncClient) -> bool:
        try:
            response = await client.head(url, timeout=5.0, follow_redirects=True)
            return response.status_code == 200
        except httpx.HTTPError:
            return False


class PDFParser:
    """Handles PDF downloading and text extraction."""
    
    def __init__(self):
        email = os.getenv("UNPAYWALL_EMAIL", "your.email@example.com")
        self.multi_source = MultiSourcePDFGetter(email)
    
    async def download_pdf(self, url: str, paper_id: str) -> Optional[Path]:
        """Download PDF to cache directory."""
        try:
            pdf_path = PDF_CACHE_DIR / f"{paper_id}.pdf"
            if pdf_path.exists():
                return pdf_path
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                pdf_path.write_bytes(response.content)
                return pdf_path
        except Exception:
            return None

    @staticmethod
    def extract_text(pdf_path: Path) -> Optional[str]:
        try:
            reader = pypdf.PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n\n"
            return text.strip()
        except Exception:
            return None

    @staticmethod
    def detect_sections(text: str) -> dict[str, str]:
        sections = {
            "introduction": "",
            "methods": "",
            "results": "",
            "discussion": "",
            "conclusion": "",
        }
        patterns = {
            "introduction": r"(?i)\n\s*(introduction|background)\s*\n",
            "methods": r"(?i)\n\s*(methods?|materials?\s+and\s+methods?|methodology)\s*\n",
            "results": r"(?i)\n\s*(results?|findings?)\s*\n",
            "discussion": r"(?i)\n\s*(discussion)\s*\n",
            "conclusion": r"(?i)\n\s*(conclusions?|summary)\s*\n",
        }
        boundaries = {}
        for section, pattern in patterns.items():
            match = re.search(pattern, text)
            if match:
                boundaries[section] = match.start()
        sorted_sections = sorted(boundaries.items(), key=lambda x: x[1])
        for i, (section, start) in enumerate(sorted_sections):
            end = sorted_sections[i + 1][1] if i + 1 < len(sorted_sections) else len(text)
            sections[section] = text[start:end].strip()
        return sections


class ArxivClient:
    """Handles ArXiv API interactions."""
    
    @staticmethod
    async def search_by_title(title: str) -> Optional[dict]:
        """Search ArXiv for a paper by title."""
        try:
            # Clean title for search
            search_query = arxiv.Search(
                query=f'ti:"{title}"',
                max_results=1,
                sort_by=arxiv.SortCriterion.Relevance
            )
            
            results = list(search_query.results())
            
            if results:
                paper = results[0]
                return {
                    "arxiv_id": paper.entry_id.split("/")[-1],
                    "pdf_url": paper.pdf_url,
                    "title": paper.title,
                    "abstract": paper.summary,
                    "authors": [author.name for author in paper.authors],
                    "published": paper.published.isoformat(),
                }
            
            return None
        
        except Exception as e:
            print(f"ArXiv search failed: {e}")
            return None
    
    @staticmethod
    async def download_pdf(arxiv_id: str, paper_id: str) -> Optional[Path]:
        """Download PDF from ArXiv."""
        try:
            pdf_path = PDF_CACHE_DIR / f"{paper_id}_arxiv.pdf"
            
            if pdf_path.exists():
                return pdf_path
            
            paper = next(arxiv.Search(id_list=[arxiv_id]).results())
            paper.download_pdf(filename=str(pdf_path))
            
            return pdf_path
        
        except Exception as e:
            print(f"ArXiv PDF download failed: {e}")
            return None


async def fetch_and_store_paper(
    paper_id: str,
    paper_metadata: dict,
    storage: PaperStorage
) -> dict:
    """
    Fetch full paper content and store it.
    
    Tries in order:
    1. Open access PDF from Semantic Scholar
    2. ArXiv (if available)
    3. Abstract only
    
    Returns stored paper data.
    """
    paper_data = {
        "metadata": {
            "paperId": paper_id,
            "title": paper_metadata.get("title", ""),
            "abstract": paper_metadata.get("abstract", ""),
            "year": paper_metadata.get("year"),
            "citationCount": paper_metadata.get("citationCount", 0),
            "authors": [
                {"name": a.get("name", ""), "authorId": a.get("authorId")}
                for a in paper_metadata.get("authors", [])
            ],
            "venue": paper_metadata.get("venue", ""),
        "journal": (paper_metadata.get("journal") or {}).get("name", ""),
            "doi": paper_metadata.get("externalIds", {}).get("DOI"),
            "arxiv": paper_metadata.get("externalIds", {}).get("ArXiv"),
        },
        "content": {
            "abstract": paper_metadata.get("abstract", ""),
            "full_text": "",
            "full_text_available": False,
            "source": "abstract_only"
        },
        "sections": {
            "introduction": "",
            "methods": "",
            "results": "",
            "discussion": "",
            "conclusion": ""
        },
        "saved_at": datetime.now().isoformat()
    }
    
    pdf_parser = PDFParser()
    arxiv_client = ArxivClient()
    
    async with httpx.AsyncClient() as http_client:
        pdf_url = await pdf_parser.multi_source.get_pdf_url(paper_metadata, http_client)
        if pdf_url:
            pdf_path = await pdf_parser.download_pdf(pdf_url, paper_id)
            if pdf_path:
                full_text = pdf_parser.extract_text(pdf_path)
                if full_text:
                    paper_data["content"]["full_text"] = full_text
                    paper_data["content"]["full_text_available"] = True
                    paper_data["content"]["source"] = "open_access_pdf"
                    paper_data["sections"] = pdf_parser.detect_sections(full_text)
    
    # Try ArXiv if no full text yet
    if not paper_data["content"]["full_text_available"]:
        arxiv_id = paper_data["metadata"].get("arxiv")
        if arxiv_id:
            pdf_path = await arxiv_client.download_pdf(arxiv_id, paper_id)
            if pdf_path:
                full_text = pdf_parser.extract_text(pdf_path)
                if full_text:
                    paper_data["content"]["full_text"] = full_text
                    paper_data["content"]["full_text_available"] = True
                    paper_data["content"]["source"] = "arxiv"
                    paper_data["sections"] = pdf_parser.detect_sections(full_text)
    
    # Store the paper
    storage.add_paper(paper_id, paper_data)
    
    return paper_data
