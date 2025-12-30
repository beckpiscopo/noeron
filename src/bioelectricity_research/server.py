"""Bioelectricity Research MCP Server - Main implementation"""

from pathlib import Path
import sys

import httpx
import json as json_module
from enum import Enum
from typing import Any, Literal, Optional, Sequence
from pydantic import BaseModel, Field
from fastmcp import FastMCP

from .storage import PaperStorage, fetch_and_store_paper

scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

from .vector_store import VectorStore

mcp = FastMCP("bioelectricity-research")

API_BASE = "https://api.semanticscholar.org/graph/v1"
HEADERS = {"User-Agent": "BioelectricityResearchMCP/1.5 (Educational Research Tool)"}

storage = PaperStorage()

vectorstore: Optional[VectorStore] = None


def get_vectorstore():
    global vectorstore
    if vectorstore is None:
        vectorstore = VectorStore()
    return vectorstore


EPISODES_FILE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "episodes.json"
CLAIMS_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "cache" / "podcast_lex_325_claims_with_timing.json"


class EpisodeMetadata(BaseModel):
    id: str
    title: str
    podcast: str
    host: str
    guest: str
    duration: str
    date: str
    papersLinked: int
    description: Optional[str] = None


def load_episode_catalog() -> list[EpisodeMetadata]:
    if not EPISODES_FILE_PATH.exists():
        return []

    try:
        with EPISODES_FILE_PATH.open() as fh:
            raw_episodes = json_module.load(fh)
    except json_module.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse episodes catalog: {exc}") from exc

    episodes = []
    for entry in raw_episodes:
        try:
            episodes.append(EpisodeMetadata(**entry))
        except Exception:
            continue

    return episodes


def _parse_timestamp_seconds(timestamp: str) -> float:
    if not timestamp:
        return 0.0

    timestamp = timestamp.strip()
    decimal = 0.0

    if "." in timestamp:
        main, frac = timestamp.split(".", 1)
        try:
            decimal = float(f"0.{frac}")
        except ValueError:
            decimal = 0.0
        timestamp = main

    parts = [part for part in timestamp.split(":") if part]
    numeric_parts = []
    for part in parts:
        try:
            numeric_parts.append(int(part))
        except ValueError:
            numeric_parts.append(0)

    while len(numeric_parts) < 3:
        numeric_parts.insert(0, 0)

    hours, minutes, seconds = numeric_parts[-3], numeric_parts[-2], numeric_parts[-1]
    return hours * 3600 + minutes * 60 + seconds + decimal


def _load_claims_cache() -> dict[str, Any]:
    if not CLAIMS_CACHE_PATH.exists():
        return {}

    try:
        with CLAIMS_CACHE_PATH.open() as fh:
            return json_module.load(fh)
    except json_module.JSONDecodeError:
        return {}

class ResponseFormat(str, Enum):
    markdown = "markdown"
    json = "json"

# Input Models
class SearchPapersInput(BaseModel):
    query: str = Field(min_length=2, max_length=500, description="Search query")
    limit: int = Field(default=10, ge=1, le=100)
    year_from: Optional[int] = Field(default=None, ge=1900, le=2025)
    year_to: Optional[int] = Field(default=None, ge=1900, le=2025)
    min_citations: Optional[int] = Field(default=None, ge=0)
    open_access_only: bool = Field(default=False)
    response_format: ResponseFormat = Field(default=ResponseFormat.markdown)

class GetPaperDetailsInput(BaseModel):
    paper_id: str = Field(min_length=1, max_length=100)
    include_citations: bool = Field(default=False)
    include_references: bool = Field(default=False)
    response_format: ResponseFormat = Field(default=ResponseFormat.markdown)

class GetAuthorPapersInput(BaseModel):
    author_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    author_id: Optional[str] = Field(default=None, min_length=1, max_length=50)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: str = Field(default="citations")
    response_format: ResponseFormat = Field(default=ResponseFormat.markdown)

class SavePaperInput(BaseModel):
    paper_id: str = Field(min_length=1, max_length=100)
    force_redownload: bool = Field(default=False)

class SaveAuthorPapersInput(BaseModel):
    author_name: Optional[str] = Field(default=None)
    author_id: Optional[str] = Field(default=None)
    limit: int = Field(default=20, ge=1, le=100)
    skip_existing: bool = Field(default=True)

class ListSavedPapersInput(BaseModel):
    min_citations: Optional[int] = Field(default=None)
    year_from: Optional[int] = Field(default=None)
    year_to: Optional[int] = Field(default=None)
    has_full_text: Optional[bool] = Field(default=None)
    response_format: ResponseFormat = Field(default=ResponseFormat.markdown)

class EpisodeMetadata(BaseModel):
    id: str
    title: str
    podcast: str
    host: str
    guest: str
    duration: str
    date: str
    papersLinked: int
    description: Optional[str] = None

# Phase 1 Tools
@mcp.tool()
async def bioelectricity_search_papers(params: SearchPapersInput) -> str:
    """Search for bioelectricity research papers."""
    try:
        query_params = {
            "query": params.query,
            "limit": params.limit,
            "fields": "paperId,title,abstract,authors,year,citationCount,venue,openAccessPdf,externalIds"
        }
        
        if params.year_from or params.year_to:
            year_filter = f"{params.year_from or ''}-{params.year_to or ''}"
            query_params["year"] = year_filter
        
        if params.min_citations:
            query_params["minCitationCount"] = params.min_citations
        
        if params.open_access_only:
            query_params["openAccessPdf"] = ""
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/paper/search",
                params=query_params,
                headers=HEADERS
            )
            response.raise_for_status()
            data = response.json()
        
        papers = data.get("data", [])
        
        if not papers:
            return "No papers found matching your search criteria."
        
        if params.response_format == ResponseFormat.json:
            return json_module.dumps(papers, indent=2)
        
        result = f"# Search Results: {params.query}\n\nFound {len(papers)} papers\n\n"
        
        for i, paper in enumerate(papers, 1):
            result += f"## {i}. {paper.get('title', 'No title')}\n\n"
            
            authors = paper.get('authors', [])
            if authors:
                author_names = [a.get('name', 'Unknown') for a in authors[:3]]
                if len(authors) > 3:
                    author_names.append(f"et al. ({len(authors)} total)")
                result += f"**Authors:** {', '.join(author_names)}\n\n"
            
            year = paper.get('year', 'N/A')
            citations = paper.get('citationCount', 0)
            result += f"**Year:** {year} | **Citations:** {citations}\n\n"
            
            if paper.get('venue'):
                result += f"**Venue:** {paper['venue']}\n\n"
            
            abstract = paper.get('abstract', 'No abstract available')
            if abstract and len(abstract) > 300:
                abstract = abstract[:300] + "..."
            result += f"**Abstract:** {abstract}\n\n"
            
            result += f"**Paper ID:** `{paper['paperId']}`\n\n"
            
            if paper.get('openAccessPdf'):
                result += "**Open Access PDF:** Available\n\n"
            
            result += "---\n\n"
        
        return result
    
    except Exception as e:
        return f"Error searching papers: {str(e)}"

@mcp.tool()
async def bioelectricity_get_paper_details(params: GetPaperDetailsInput) -> str:
    """Get comprehensive details about a specific paper."""
    try:
        fields = [
            "paperId", "title", "abstract", "authors", "year", "citationCount",
            "referenceCount", "venue", "journal", "openAccessPdf", "externalIds"
        ]
        
        if params.include_citations:
            fields.extend(["citations.paperId", "citations.title", "citations.year"])
        
        if params.include_references:
            fields.extend(["references.paperId", "references.title", "references.year"])
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/paper/{params.paper_id}",
                params={"fields": ",".join(fields)},
                headers=HEADERS
            )
            response.raise_for_status()
            paper = response.json()
        
        if params.response_format == ResponseFormat.json:
            return json_module.dumps(paper, indent=2)
        
        result = f"# {paper.get('title', 'No title')}\n\n## Authors\n\n"
        for author in paper.get('authors', []):
            result += f"- {author.get('name', 'Unknown')}\n"
        
        result += f"\n## Metadata\n\n**Year:** {paper.get('year', 'N/A')}\n\n"
        result += f"**Citations:** {paper.get('citationCount', 0)}\n\n"
        result += f"**References:** {paper.get('referenceCount', 0)}\n\n"
        
        if paper.get('venue'):
            result += f"**Venue:** {paper['venue']}\n\n"
        
        if paper.get('journal'):
            result += f"**Journal:** {paper['journal'].get('name', 'N/A')}\n\n"
        
        external_ids = paper.get('externalIds', {})
        if external_ids.get('DOI'):
            result += f"**DOI:** {external_ids['DOI']}\n\n"
        if external_ids.get('ArXiv'):
            result += f"**ArXiv:** {external_ids['ArXiv']}\n\n"
        
        result += f"## Abstract\n\n{paper.get('abstract', 'No abstract available')}\n\n"
        
        if paper.get('openAccessPdf'):
            result += f"## Open Access\n\n**PDF URL:** {paper['openAccessPdf'].get('url')}\n\n"
        
        return result
    
    except Exception as e:
        return f"Error fetching paper details: {str(e)}"

@mcp.tool()
async def bioelectricity_get_author_papers(params: GetAuthorPapersInput) -> str:
    """Find papers by a specific author."""
    try:
        author_id = params.author_id
        
        if not author_id:
            if not params.author_name:
                return "Error: Must provide either author_name or author_id"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{API_BASE}/author/search",
                    params={"query": params.author_name, "limit": 1},
                    headers=HEADERS
                )
                response.raise_for_status()
                search_data = response.json()
            
            if not search_data.get("data"):
                return f"No author found matching '{params.author_name}'"
            
            author_id = search_data["data"][0]["authorId"]
            author_actual_name = search_data["data"][0]["name"]
        else:
            author_actual_name = params.author_name or "Author"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/author/{author_id}/papers",
                params={
                    "limit": params.limit,
                    "fields": "paperId,title,abstract,year,citationCount,venue,openAccessPdf"
                },
                headers=HEADERS
            )
            response.raise_for_status()
            data = response.json()
        
        papers = data.get("data", [])
        
        if not papers:
            return f"No papers found for {author_actual_name}"
        
        if params.sort_by == "citations":
            papers.sort(key=lambda p: p.get("citationCount", 0), reverse=True)
        elif params.sort_by == "year":
            papers.sort(key=lambda p: p.get("year", 0), reverse=True)
        
        if params.response_format == ResponseFormat.json:
            return json_module.dumps(papers, indent=2)
        
        result = f"# Papers by {author_actual_name}\n\nFound {len(papers)} papers (sorted by {params.sort_by})\n\n"
        
        for i, paper in enumerate(papers, 1):
            result += f"## {i}. {paper.get('title', 'No title')}\n\n"
            result += f"**Year:** {paper.get('year', 'N/A')} | **Citations:** {paper.get('citationCount', 0)}\n\n"
            
            if paper.get('venue'):
                result += f"**Venue:** {paper['venue']}\n\n"
            
            abstract = paper.get('abstract', 'No abstract available')
            if abstract and len(abstract) > 200:
                abstract = abstract[:200] + "..."
            result += f"**Abstract:** {abstract}\n\n"
            result += f"**Paper ID:** `{paper['paperId']}`\n\n"
            
            if paper.get('openAccessPdf'):
                result += "**Open Access:** Available\n\n"
            
            result += "---\n\n"
        
        return result
    
    except Exception as e:
        return f"Error fetching author papers: {str(e)}"

# Phase 1.5 Storage Tools
@mcp.tool()
async def save_paper(params: SavePaperInput) -> str:
    """Save a paper to your local collection with full text extraction."""
    try:
        if not params.force_redownload and storage.paper_exists(params.paper_id):
            existing = storage.get_paper(params.paper_id)
            return f"Paper already in collection: {existing['metadata']['title']}\nFull text available: {existing['content']['full_text_available']}\nUse force_redownload=true to update."
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{API_BASE}/paper/{params.paper_id}",
                params={
                    "fields": "paperId,title,abstract,authors,year,citationCount,venue,journal,openAccessPdf,externalIds"
                },
                headers=HEADERS
            )
            response.raise_for_status()
            paper_metadata = response.json()
        
        paper_data = await fetch_and_store_paper(params.paper_id, paper_metadata, storage)
        
        result = f"✓ Saved: {paper_data['metadata']['title']}\n\n"
        result += f"**Year:** {paper_data['metadata']['year']}\n"
        result += f"**Citations:** {paper_data['metadata']['citationCount']}\n"
        result += f"**Full text:** {paper_data['content']['full_text_available']}\n"
        
        if paper_data['content']['full_text_available']:
            result += f"**Source:** {paper_data['content']['source']}\n"
            result += f"**Text length:** {len(paper_data['content']['full_text'])} characters\n"
            detected = [s for s, text in paper_data['sections'].items() if text]
            if detected:
                result += f"**Sections detected:** {', '.join(detected)}\n"
        
        return result
    
    except Exception as e:
        return f"Error saving paper: {str(e)}"

@mcp.tool()
async def save_author_papers(params: SaveAuthorPapersInput) -> str:
    """Bulk save all papers by a specific author."""
    try:
        author_params = GetAuthorPapersInput(
            author_name=params.author_name,
            author_id=params.author_id,
            limit=params.limit,
            response_format=ResponseFormat.json
        )
        
        papers_json = await bioelectricity_get_author_papers(author_params)
        papers = json_module.loads(papers_json)
        
        saved_count = 0
        skipped_count = 0
        failed_count = 0
        
        for paper in papers:
            paper_id = paper.get('paperId')
            if not paper_id:
                failed_count += 1
                continue
            
            if params.skip_existing and storage.paper_exists(paper_id):
                skipped_count += 1
                continue
            
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        f"{API_BASE}/paper/{paper_id}",
                        params={"fields": "paperId,title,abstract,authors,year,citationCount,venue,journal,openAccessPdf,externalIds"},
                        headers=HEADERS
                    )
                    response.raise_for_status()
                    paper_metadata = response.json()
                
                await fetch_and_store_paper(paper_id, paper_metadata, storage)
                saved_count += 1
            except Exception as e:
                print(f"Failed to save {paper_id}: {e}")
                failed_count += 1
        
        result = f"# Bulk Save Complete\n\n**Saved:** {saved_count} papers\n"
        result += f"**Skipped (already in collection):** {skipped_count} papers\n"
        result += f"**Failed:** {failed_count} papers\n"
        return result
    
    except Exception as e:
        return f"Error in bulk save: {str(e)}"

@mcp.tool()
async def list_saved_papers(params: ListSavedPapersInput) -> str:
    """List papers in your collection with optional filters."""
    try:
        papers = storage.list_papers(
            min_citations=params.min_citations,
            year_from=params.year_from,
            year_to=params.year_to,
            has_full_text=params.has_full_text
        )
        
        if not papers:
            return "No papers found matching your criteria."
        
        if params.response_format == ResponseFormat.json:
            return json_module.dumps(papers, indent=2)
        
        result = f"# Saved Papers ({len(papers)} found)\n\n"
        
        for i, paper in enumerate(papers, 1):
            result += f"## {i}. {paper.get('title', 'No title')}\n\n"
            result += f"**Year:** {paper.get('year', 'N/A')} | **Citations:** {paper.get('citationCount', 0)}\n\n"
            result += f"**Paper ID:** `{paper['paper_id']}`\n\n---\n\n"
        
        return result
    
    except Exception as e:
        return f"Error listing papers: {str(e)}"

@mcp.tool()
async def get_saved_paper(paper_id: str) -> str:
    """Retrieve complete data for a saved paper including full text and sections."""
    try:
        paper = storage.get_paper(paper_id)
        if not paper:
            return f"Paper {paper_id} not found in collection. Use save_paper first."
        return json_module.dumps(paper, indent=2)
    except Exception as e:
        return f"Error retrieving paper: {str(e)}"


@mcp.tool()
async def list_episodes() -> Sequence[EpisodeMetadata]:
    """Return a catalog of curated episodes for the UI."""
    return load_episode_catalog()


@mcp.tool()
async def get_episode_claims(episode_id: str, limit: int = 30) -> Sequence[dict[str, Any]]:
    """
    Return the contextual claims associated with a specific episode.
    """
    cache = _load_claims_cache()
    segments = cache.get("segments", {})
    parsed_segments: list[tuple[float, str, dict[str, Any]]] = []

    for segment_key, segment_data in segments.items():
        if not segment_key.startswith(f"{episode_id}|"):
            continue
        timestamp = _parse_timestamp_seconds(segment_data.get("timestamp", ""))
        parsed_segments.append((timestamp, segment_key, segment_data))

    parsed_segments.sort(key=lambda item: item[0])
    claims: list[dict[str, Any]] = []

    for timestamp_seconds, segment_key, segment_data in parsed_segments:
        for idx, claim_data in enumerate(segment_data.get("claims", [])):
            if len(claims) >= limit:
                break

            claim_id = f"{segment_key}-{idx}"
            title = claim_data.get("claim_text") or "Insight"
            description = (
                claim_data.get("rationale")
                or claim_data.get("needs_backing_because")
                or claim_data.get("claim_text")
                or ""
            )
            category = claim_data.get("claim_type") or claim_data.get("speaker_stance") or "Insight"
            source = (
                claim_data.get("paper_title")
                or claim_data.get("source_link")
                or f"Segment {segment_key}"
            )
            
            # Get timing data if available
            timing_data = claim_data.get("timing", {})
            claim_timestamp = timestamp_seconds
            if timing_data:
                # Convert milliseconds to seconds for timestamp
                claim_timestamp = timing_data.get("start_ms", 0) / 1000.0

            claims.append(
                {
                    "id": claim_id,
                    "timestamp": claim_timestamp,
                    "category": category,
                    "title": title,
                    "description": description,
                    "source": source,
                    "status": "past",
                    "timing": timing_data if timing_data else None,
                }
            )

        if len(claims) >= limit:
            break

    return claims


@mcp.tool()
async def rag_search(
    query: str,
    n_results: int = 5,
    response_format: Literal["markdown", "json"] = "markdown"
) -> str:
    """Search your local corpus of saved papers using semantic similarity."""
    try:
        vs = get_vectorstore()
        results = vs.search(query, n_results=n_results)
        documents = results.get("documents", [])
        metadatas = results.get("metadatas", [])

        if not documents or not metadatas or not documents[0]:
            return "No matching chunks found in vector store. Consider re-building it."

        docs = documents[0]
        metas = metadatas[0]

        if response_format == "json":
            return json_module.dumps(
                {
                    "query": query,
                    "results": [
                        {
                            "text": doc,
                            "paper_title": meta.get("paper_title"),
                            "section": meta.get("section_heading"),
                            "paper_id": meta.get("paper_id"),
                            "year": meta.get("year"),
                        }
                        for doc, meta in zip(docs, metas)
                    ],
                },
                indent=2,
            )

        output = [f"# RAG Search Results\n\n**Query**: {query}\n"]
        for i, (doc, meta) in enumerate(zip(docs, metas), 1):
            paper_title = meta.get("paper_title", "Unknown paper")
            section_heading = meta.get("section_heading", "Unknown section")
            year = meta.get("year", "Unknown")
            output.append(f"\n## Result {i}: {paper_title}")
            output.append(f"**Section**: {section_heading}")
            output.append(f"**Year**: {year}")
            output.append(f"\n{doc}\n")
            paper_id = meta.get("paper_id")
            if paper_id:
                output.append(
                    f"[View full paper](https://semanticscholar.org/paper/{paper_id})\n"
                )
            output.append("---\n")

        return "\n".join(output)

    except Exception as e:
        return f"Error searching vector store: {str(e)}\n\nMake sure you've built the vector store with: python scripts/build_vector_store.py"


@mcp.tool()
async def rag_stats() -> str:
    """Get statistics about your local RAG corpus."""
    try:
        vs = get_vectorstore()
        stats = vs.get_stats()
        return f"""# RAG Corpus Statistics

- **Total chunks indexed**: {stats['total_chunks']:,}
- **Storage location**: {stats['persist_dir']}

Your corpus is ready for semantic search using the `rag_search` tool.
"""
    except Exception as e:
        return f"Error getting stats: {str(e)}"

if __name__ == "__main__":
    mcp.run()

