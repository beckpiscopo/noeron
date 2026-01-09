"""Bioelectricity Research MCP Server - Main implementation"""

from pathlib import Path
import os
import sys
import asyncio

import httpx
import json as json_module
from enum import Enum
from typing import Any, Literal, Optional, Sequence
from pydantic import BaseModel, Field
from fastmcp import FastMCP

from .storage import PaperStorage, fetch_and_store_paper

# Gemini imports
try:
    from google import genai  # type: ignore[import]
except ImportError:
    genai = None

# Gemini configuration
GEMINI_API_KEY_ENV = "GEMINI_API_KEY"
GEMINI_MODEL_DEFAULT = os.environ.get("GEMINI_MODEL", "gemini-3-pro-preview")
_GENAI_CLIENT = None

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
DEEP_DIVE_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "cache" / "deep_dive_summaries.json"
EVIDENCE_THREADS_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "cache" / "evidence_threads.json"
KNOWLEDGE_GRAPH_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "knowledge_graph" / "knowledge_graph.json"
CLAIM_RELEVANCE_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "knowledge_graph" / "claim_entity_relevance.json"


# ============================================================================
# Gemini Deep Dive Summary Generation
# ============================================================================

def _ensure_gemini_client_ready() -> None:
    """Initialize the Gemini client if not already done."""
    global _GENAI_CLIENT
    if _GENAI_CLIENT is not None:
        return
    if genai is None:
        raise RuntimeError("google.genai is not installed. Run: pip install google-genai")
    api_key = os.environ.get(GEMINI_API_KEY_ENV)
    if not api_key:
        raise RuntimeError(f"{GEMINI_API_KEY_ENV} environment variable is required.")
    _GENAI_CLIENT = genai.Client(api_key=api_key)


DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL = """You are a scientific reviewer writing for a technically literate audience (graduate-level biology/biophysics).

Given a podcast claim and supporting research papers, produce a concise but technical synthesis that foregrounds mechanisms, quantitative findings, and study design quality.

## CLAIM FROM PODCAST
"{claim_text}"

Speaker's stance: {speaker_stance}
Why this needs backing: {needs_backing}

## SUPPORTING EVIDENCE FROM RAG RETRIEVAL
{evidence_summary}

## YOUR TASK
Write a 250-400 word synthesis with this exact structure:

**Finding (technical)**: 2-3 sentences stating what the evidence shows. Include quantitative effects (with units) and directionality when present.

**Mechanism / Pathway**: 2-4 sentences describing the mechanistic model. Name relevant pathways, molecules, tissues, model systems, and causal links proposed or demonstrated.

**Evidence Appraisal**: 3-5 bullet points. Each bullet must note study design (e.g., RCT, observational, in vitro, in vivo), model/organism, sample size (n or replicates), key result (magnitude/direction), and whether it is a replication/extension.

**Limitations & Open Questions**: 2-4 bullet points on uncertainties, conflicting findings, methodological gaps, or external validity issues.

**Implications**: 1-2 sentences on what the evidence enables (e.g., therapeutic targets, experimental follow-ups, engineering applications).

## ALSO REQUIRED - PER-PAPER KEY FINDINGS
At the end, include a section with key findings for each paper. Use this exact format:

[PAPER_KEY_FINDINGS]
Paper 1: <one sentence summarizing this paper's key contribution to the claim>
Paper 2: <one sentence summarizing this paper's key contribution to the claim>
Paper 3: <one sentence summarizing this paper's key contribution to the claim>
(continue for all papers listed above)
[/PAPER_KEY_FINDINGS]

## GUIDELINES
- Keep language precise and technical; avoid hand-waving
- Prefer concrete numbers, effect sizes, and experimental conditions over generalities
- Distinguish clearly between demonstrated findings and speculation
- If evidence is weak, heterogeneous, or conflicting, say so explicitly
- Keep output scannable while preserving detail (bullets where specified)

Respond with ONLY the structured summary followed by the paper key findings section, no preamble."""

DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED = """You are a science communicator explaining research to an educated but non-specialist audience.

Given a podcast claim and supporting papers, write a clear, scannable summary that highlights what the evidence actually shows.

## CLAIM FROM PODCAST
"{claim_text}"

Speaker's stance: {speaker_stance}
Why this needs backing: {needs_backing}

## SUPPORTING EVIDENCE FROM RAG RETRIEVAL
{evidence_summary}

## YOUR TASK
Write a 180-260 word summary with this exact structure:

**Finding**: One sentence stating what the studies collectively show (be specific).

**Why It Matters**: 2-3 sentences on the biological/medical significance in plain language.

**Evidence Strength**: Classify as "Strong", "Emerging", or "Contested" and justify in 1-2 sentences.

**Key Uncertainties**: 2-3 bullet points of caveats, gaps, or disagreements.

## ALSO REQUIRED - PER-PAPER KEY FINDINGS
At the end, include a section with key findings for each paper. Use this exact format:

[PAPER_KEY_FINDINGS]
Paper 1: <one sentence summarizing this paper's key contribution to the claim>
Paper 2: <one sentence summarizing this paper's key contribution to the claim>
Paper 3: <one sentence summarizing this paper's key contribution to the claim>
(continue for all papers listed above)
[/PAPER_KEY_FINDINGS]

## GUIDELINES
- Use active voice and concrete details; avoid jargon
- Separate demonstrated findings from speculation
- If evidence is weak or limited, say so clearly
- Keep the tone clear and honest; no preamble

Respond with ONLY the structured summary followed by the paper key findings section, no preamble."""

# Alias for backwards compatibility (http_server.py uses this)
DEEP_DIVE_PROMPT_TEMPLATE = DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED


def _parse_paper_key_findings(summary: str, num_papers: int) -> list[str]:
    """Parse key findings from the summary response.

    Expects format:
    [PAPER_KEY_FINDINGS]
    Paper 1: <finding>
    Paper 2: <finding>
    [/PAPER_KEY_FINDINGS]
    """
    import re

    # Try to extract the key findings block
    match = re.search(r'\[PAPER_KEY_FINDINGS\](.*?)\[/PAPER_KEY_FINDINGS\]', summary, re.DOTALL)

    if not match:
        # Return empty strings if no key findings section found
        return [""] * num_papers

    findings_text = match.group(1).strip()
    findings = []

    # Parse each "Paper N:" line
    for i in range(1, num_papers + 1):
        pattern = rf'Paper\s*{i}\s*:\s*(.+?)(?=Paper\s*\d+\s*:|$)'
        paper_match = re.search(pattern, findings_text, re.DOTALL | re.IGNORECASE)
        if paper_match:
            finding = paper_match.group(1).strip()
            # Clean up the finding - remove trailing newlines and extra whitespace
            finding = ' '.join(finding.split())
            findings.append(finding)
        else:
            findings.append("")

    return findings


def _extract_summary_without_findings(summary: str) -> str:
    """Remove the paper key findings section from the summary for display."""
    import re
    # Remove the key findings block
    cleaned = re.sub(r'\[PAPER_KEY_FINDINGS\].*?\[/PAPER_KEY_FINDINGS\]', '', summary, flags=re.DOTALL)
    return cleaned.strip()


def _load_deep_dive_cache() -> dict:
    """Load the deep dive summaries cache."""
    if not DEEP_DIVE_CACHE_PATH.exists():
        return {}
    try:
        with DEEP_DIVE_CACHE_PATH.open() as fh:
            return json_module.load(fh)
    except json_module.JSONDecodeError:
        return {}


def _save_deep_dive_cache(cache: dict) -> None:
    """Save the deep dive summaries cache."""
    DEEP_DIVE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DEEP_DIVE_CACHE_PATH.open("w") as fh:
        json_module.dump(cache, fh, indent=2)


def _build_research_query(claim_data: dict) -> str:
    """
    Build a research query from claim data.
    Uses the pre-computed research_query if available, otherwise builds from claim text + tags.
    """
    # Prefer the pre-computed research_query from Gemini claim detection
    if claim_data.get("research_query"):
        return claim_data["research_query"]

    # Fallback: build query from claim text and context tags
    claim_text = claim_data.get("claim_text", "")
    context_tags = claim_data.get("context_tags") or {}

    query_parts = []

    # Add context tags
    for tag_key in ("organism", "mechanism", "interaction", "concept"):
        if context_tags.get(tag_key):
            query_parts.append(context_tags[tag_key].lower())

    # Add key terms from claim text (words > 5 chars, excluding stopwords)
    stopwords = {"there", "these", "their", "about", "being", "could", "would", "should", "which", "through"}
    claim_words = [
        w.lower().strip(".,;:\"'")
        for w in claim_text.split()
        if len(w) > 5 and w.lower() not in stopwords
    ]
    query_parts.extend(claim_words[:5])

    # Always include "Levin" for this corpus
    query_parts.append("Levin")

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for part in query_parts:
        if part and part not in seen:
            deduped.append(part)
            seen.add(part)

    return " ".join(deduped) if deduped else claim_text[:100]


def _format_rag_results_for_prompt(
    rag_results: list,
    papers_collection: dict
) -> str:
    """Format RAG results into a readable summary for the Gemini prompt."""
    if not rag_results:
        return "No matching papers found in the corpus. The evidence base for this claim is limited or the corpus does not cover this topic."

    lines = []
    for i, result in enumerate(rag_results[:7], 1):  # Limit to top 7 chunks
        paper_id = result.get("paper_id", "")
        paper_title = result.get("paper_title", "Unknown paper")
        section = result.get("section", result.get("section_heading", ""))
        text_chunk = result.get("text", "")[:600]  # Limit chunk size
        year = result.get("year", "")

        # Try to get additional metadata from papers collection
        paper_data = papers_collection.get(paper_id, {})
        metadata = paper_data.get("metadata", {})
        citations = metadata.get("citationCount", 0)
        venue = metadata.get("venue", "")
        abstract = metadata.get("abstract", "")[:300] if metadata.get("abstract") else ""

        lines.append(f"""
---
**Paper {i}: {paper_title}**
- Year: {year or metadata.get('year', 'N/A')} | Citations: {citations} | Venue: {venue}
- Section: {section}
- Relevant excerpt: "{text_chunk}..."
{f'- Abstract: {abstract}...' if abstract else ''}
""")

    return "\n".join(lines)


def _call_gemini_for_deep_dive(prompt: str, model_name: str) -> str:
    """Call Gemini to generate the deep dive summary."""
    _ensure_gemini_client_ready()
    response = _GENAI_CLIENT.models.generate_content(
        model=model_name,
        contents=prompt,
    )
    # Extract text from response
    if hasattr(response, "text"):
        return response.text
    if hasattr(response, "candidates") and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
            return "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))
    raise ValueError("Could not extract text from Gemini response")


# ============================================================================
# Evidence Threads Generation
# ============================================================================

EVIDENCE_THREAD_PROMPT = """You are analyzing scientific papers to identify distinct "evidence threads" - coherent research narratives that trace how understanding of a claim developed over time.

CLAIM: "{claim_text}"

RETRIEVED PAPERS:
{papers_json}

TASK:
Identify 2-4 distinct evidence threads that show how scientific understanding of this claim was built. Look for:

1. **Experimental Progressions**: Initial observations → mechanism discovery → validation → refinement
2. **Theoretical Developments**: Concept introduction → formalization → empirical testing → application
3. **Cross-Domain Generalizations**: Finding in one system → replication in other systems → general principle
4. **Converging Evidence**: Different research approaches reaching same conclusion

THREAD TYPES:
- experimental_validation: Direct experimental tests of the claim
- theoretical_framework: Conceptual/mathematical models supporting the claim
- mechanism_discovery: Research uncovering how/why the phenomenon works
- cross_domain: Evidence from multiple organisms/systems showing generality

THREAD STRENGTH:
- foundational: Well-established with multiple replications and broad acceptance
- developing: Emerging evidence with some replication but ongoing investigation
- speculative: Initial findings or theoretical proposals needing more validation

OUTPUT FORMAT (valid JSON only):
{{
  "threads": [
    {{
      "name": "Brief thread name (3-6 words)",
      "type": "experimental_validation|theoretical_framework|mechanism_discovery|cross_domain",
      "strength": "foundational|developing|speculative",
      "milestones": [
        {{
          "year": 2020,
          "paper_title": "Exact title from papers above",
          "paper_id": "ID from papers above",
          "finding": "One concise sentence: what this paper contributed to the thread"
        }}
      ],
      "narrative": "2-3 sentences describing the overall research arc of this thread"
    }}
  ]
}}

CRITICAL RULES:
- Only cite papers from the RETRIEVED PAPERS list above
- Include 2-4 milestones per thread (not more)
- Order milestones chronologically within each thread
- Each milestone must reference a real paper from the list
- If you cannot identify at least 2 distinct threads, return {{"threads": []}}
- Output ONLY valid JSON, no markdown formatting or preamble
"""


def _load_evidence_threads_cache() -> dict:
    """Load the evidence threads cache."""
    if not EVIDENCE_THREADS_CACHE_PATH.exists():
        return {}
    try:
        with EVIDENCE_THREADS_CACHE_PATH.open() as fh:
            return json_module.load(fh)
    except json_module.JSONDecodeError:
        return {}


def _save_evidence_threads_cache(cache: dict) -> None:
    """Save the evidence threads cache."""
    EVIDENCE_THREADS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EVIDENCE_THREADS_CACHE_PATH.open("w") as fh:
        json_module.dump(cache, fh, indent=2)


def _should_generate_threads(papers: list[dict]) -> tuple[bool, str]:
    """
    Check if we have enough papers to generate meaningful evidence threads.

    Returns:
        (should_generate, reason) tuple
    """
    if len(papers) < 4:
        return False, f"insufficient_papers: need 4+, have {len(papers)}"

    # Check for year spread
    years = []
    for paper in papers:
        year = paper.get("year")
        if year and isinstance(year, (int, str)):
            try:
                years.append(int(year))
            except (ValueError, TypeError):
                pass

    if len(years) < 3:
        return False, f"insufficient_year_data: only {len(years)} papers have years"

    year_span = max(years) - min(years)
    if year_span < 3:
        return False, f"insufficient_year_span: only {year_span} years (need 3+)"

    return True, "eligible"


def _format_papers_for_thread_prompt(papers: list[dict], papers_collection: dict) -> str:
    """Format papers as JSON for the thread generation prompt."""
    formatted_papers = []

    for paper in papers:
        paper_id = paper.get("paper_id", "")
        paper_title = paper.get("paper_title", "Unknown")
        year = paper.get("year", "")
        section = paper.get("section", paper.get("section_heading", ""))
        text_excerpt = paper.get("text", "")[:400]  # Limit excerpt size

        # Try to get additional metadata
        paper_data = papers_collection.get(paper_id, {})
        metadata = paper_data.get("metadata", {})
        citations = metadata.get("citationCount", 0)
        venue = metadata.get("venue", "")

        # Get authors
        authors = metadata.get("authors", [])
        author_str = "Unknown"
        if authors:
            first_author = authors[0].get("name", "Unknown") if isinstance(authors[0], dict) else str(authors[0])
            if len(authors) > 1:
                author_str = f"{first_author} et al."
            else:
                author_str = first_author

        formatted_papers.append({
            "paper_id": paper_id,
            "title": paper_title,
            "year": year or metadata.get("year", "unknown"),
            "authors": author_str,
            "venue": venue,
            "citations": citations,
            "section": section,
            "excerpt": text_excerpt,
        })

    return json_module.dumps(formatted_papers, indent=2)


def _validate_threads(threads: list[dict], papers: list[dict]) -> list[dict]:
    """
    Validate that threads only reference papers that actually exist in our list.

    Returns validated threads with invalid ones removed.
    """
    # Build set of valid paper IDs and titles
    valid_paper_ids = set()
    valid_paper_titles = set()

    for paper in papers:
        paper_id = paper.get("paper_id", "")
        paper_title = paper.get("paper_title", "")
        if paper_id:
            valid_paper_ids.add(paper_id)
        if paper_title:
            valid_paper_titles.add(paper_title.lower().strip())

    validated_threads = []
    valid_types = {"experimental_validation", "theoretical_framework", "mechanism_discovery", "cross_domain"}
    valid_strengths = {"foundational", "developing", "speculative"}

    for thread in threads:
        # Validate thread type
        if thread.get("type") not in valid_types:
            print(f"[THREAD_VALIDATION] Skipping thread with invalid type: {thread.get('type')}")
            continue

        # Validate thread strength
        if thread.get("strength") not in valid_strengths:
            print(f"[THREAD_VALIDATION] Skipping thread with invalid strength: {thread.get('strength')}")
            continue

        # Validate milestones
        milestones = thread.get("milestones", [])
        valid_milestones = []
        seen_paper_ids = set()

        for milestone in milestones:
            paper_id = milestone.get("paper_id", "")
            paper_title = milestone.get("paper_title", "").lower().strip()
            year = milestone.get("year")

            # Check year is plausible
            if year and (year < 1990 or year > 2025):
                print(f"[THREAD_VALIDATION] Skipping milestone with implausible year: {year}")
                continue

            # Check paper exists (by ID or title match)
            paper_exists = paper_id in valid_paper_ids or paper_title in valid_paper_titles
            if not paper_exists:
                print(f"[THREAD_VALIDATION] Skipping milestone - paper not found: {milestone.get('paper_title')}")
                continue

            # Check for duplicates within thread
            if paper_id and paper_id in seen_paper_ids:
                print(f"[THREAD_VALIDATION] Skipping duplicate paper in thread: {paper_id}")
                continue

            if paper_id:
                seen_paper_ids.add(paper_id)
            valid_milestones.append(milestone)

        # Only include thread if it has at least 2 valid milestones
        if len(valid_milestones) >= 2:
            thread["milestones"] = valid_milestones
            validated_threads.append(thread)
        else:
            print(f"[THREAD_VALIDATION] Skipping thread '{thread.get('name')}' - only {len(valid_milestones)} valid milestones")

    return validated_threads


def _call_gemini_for_threads(prompt: str, model_name: str) -> dict:
    """Call Gemini to generate evidence threads."""
    _ensure_gemini_client_ready()
    response = _GENAI_CLIENT.models.generate_content(
        model=model_name,
        contents=prompt,
    )

    # Extract text from response
    text = None
    if hasattr(response, "text"):
        text = response.text
    elif hasattr(response, "candidates") and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
            text = "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))

    if not text:
        raise ValueError("Could not extract text from Gemini response")

    # Clean up the response - remove markdown code blocks if present
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # Parse JSON
    try:
        result = json_module.loads(text)
        return result
    except json_module.JSONDecodeError as e:
        print(f"[GEMINI_THREADS] Failed to parse JSON: {e}")
        print(f"[GEMINI_THREADS] Raw response: {text[:500]}")
        return {"threads": [], "error": "Failed to parse Gemini response as JSON"}


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

class GetClaimContextInput(BaseModel):
    claim_id: str = Field(min_length=1, max_length=200, description="The claim ID (format: segment_key-index)")
    episode_id: str = Field(default="lex_325", description="The episode ID")
    include_related_concepts: bool = Field(default=True, description="Whether to search for related concepts")
    related_concepts_limit: int = Field(default=5, ge=1, le=20, description="Number of related concepts to return")

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


CONTEXT_CARD_REGISTRY_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "context_card_registry.json"
PAPERS_COLLECTION_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "papers_collection.json"


def _load_context_card_registry() -> dict[str, Any]:
    """Load the context card registry."""
    if not CONTEXT_CARD_REGISTRY_PATH.exists():
        return {}
    try:
        with CONTEXT_CARD_REGISTRY_PATH.open() as fh:
            return json_module.load(fh)
    except json_module.JSONDecodeError:
        return {}


def _load_papers_collection() -> dict[str, Any]:
    """Load the papers collection."""
    if not PAPERS_COLLECTION_PATH.exists():
        return {}
    try:
        with PAPERS_COLLECTION_PATH.open() as fh:
            data = json_module.load(fh)
            return data.get("papers", {})
    except json_module.JSONDecodeError:
        return {}


@mcp.tool()
async def get_claim_context(params: GetClaimContextInput) -> dict[str, Any]:
    """
    Get enriched context data for a specific claim including evidence threads,
    related research papers, and related concepts.
    """
    try:
        # Load claims cache to get the claim data
        claims_cache = _load_claims_cache()
        
        # Parse claim_id to get segment_key and claim_index
        # Format: "episode_id|timestamp|window-claim_index"
        parts = params.claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {
                "error": f"Invalid claim_id format: {params.claim_id}. Expected format: segment_key-index"
            }
        
        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {
                "error": f"Invalid claim index in claim_id: {params.claim_id}"
            }
        
        # Get segment data
        segments = claims_cache.get("segments", {})
        segment_data = segments.get(segment_key)
        
        if not segment_data:
            return {
                "error": f"Segment not found: {segment_key}"
            }
        
        # Get specific claim
        claims_list = segment_data.get("claims", [])
        if claim_index >= len(claims_list):
            return {
                "error": f"Claim index {claim_index} out of range for segment {segment_key}"
            }
        
        claim_data = claims_list[claim_index]
        
        # Load context card registry
        registry = _load_context_card_registry()
        segment_registry = registry.get("segments", {}).get(segment_key, {})
        
        # Get RAG results from REGISTRY (not from segment_data)
        # RAG results are stored in the context card registry
        rag_results = segment_registry.get("rag_results", [])
        
        # Load papers collection for metadata
        papers_collection = _load_papers_collection()
        
        # Build evidence threads from RAG results
        evidence_threads = []
        paper_ids_seen = set()
        
        for rag_result in rag_results:
            # Match this RAG result to the specific claim if possible
            if rag_result.get("claim_text") and claim_data.get("claim_text"):
                if rag_result["claim_text"] != claim_data["claim_text"]:
                    continue
            
            paper_id = rag_result.get("paper_id")
            if not paper_id or paper_id in paper_ids_seen:
                continue
            
            paper_ids_seen.add(paper_id)
            
            # Get paper metadata from collection
            paper_metadata = papers_collection.get(paper_id, {}).get("metadata", {})
            
            # Classify evidence type based on confidence score and claim type
            confidence = rag_result.get("confidence_score", 0.5)
            claim_type = rag_result.get("claim_type", "")
            
            if confidence >= 0.7 or "primary" in claim_type.lower():
                evidence_type = "primary"
            elif "counter" in claim_type.lower() or "alternative" in claim_type.lower():
                evidence_type = "counter"
            else:
                evidence_type = "replication"
            
            # Format authors
            authors = paper_metadata.get("authors", [])
            author_str = "Unknown"
            if authors:
                first_author = authors[0].get("name", "Unknown")
                if len(authors) > 1:
                    author_str = f"{first_author} et al."
                else:
                    author_str = first_author
            
            year = paper_metadata.get("year", "")
            venue = paper_metadata.get("venue", "")
            
            evidence_threads.append({
                "type": evidence_type,
                "title": f"{author_str}, {venue} ({year})" if venue else f"{author_str} ({year})",
                "paper_title": rag_result.get("paper_title", paper_metadata.get("title", "")),
                "description": rag_result.get("rationale", "")[:200],
                "paper_id": paper_id,
                "source_link": rag_result.get("source_link", ""),
                "confidence_score": confidence,
                "citation_count": paper_metadata.get("citationCount", 0),
                "highlighted": evidence_type == "primary",
            })
        
        # Sort evidence threads: primary first, then by citation count
        evidence_threads.sort(key=lambda x: (
            0 if x["type"] == "primary" else 1 if x["type"] == "replication" else 2,
            -x["citation_count"]
        ))
        
        # Search for related concepts using vector store if requested
        related_concepts = []
        if params.include_related_concepts and claim_data.get("claim_text"):
            try:
                vs = get_vectorstore()
                search_results = vs.search(
                    claim_data["claim_text"],
                    n_results=params.related_concepts_limit
                )
                
                docs = search_results.get("documents", [[]])[0]
                metas = search_results.get("metadatas", [[]])[0]
                
                seen_titles = set()
                for doc, meta in zip(docs, metas):
                    paper_title = meta.get("paper_title", "")
                    if paper_title and paper_title not in seen_titles:
                        seen_titles.add(paper_title)
                        
                        # Extract key concept from section heading or paper title
                        section = meta.get("section_heading", paper_title)
                        
                        related_concepts.append({
                            "title": section if section else paper_title,
                            "description": doc[:150] + "..." if len(doc) > 150 else doc,
                            "paper_title": paper_title,
                            "paper_id": meta.get("paper_id", ""),
                            "year": meta.get("year", ""),
                        })
            except Exception as e:
                print(f"Error searching for related concepts: {e}")
        
        # Generate synthesis from claim data
        synthesis = {
            "claim_text": claim_data.get("claim_text", ""),
            "rationale": claim_data.get("needs_backing_because", ""),
            "speaker_stance": claim_data.get("speaker_stance", "assertion"),
            "claim_type": claim_data.get("claim_type", ""),
            "context_tags": claim_data.get("context_tags", {}),
        }
        
        # Calculate confidence metrics
        confidence_scores = [et["confidence_score"] for et in evidence_threads if et["confidence_score"]]
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.5
        
        # Consensus based on evidence type distribution
        evidence_types = [et["type"] for et in evidence_threads]
        primary_count = evidence_types.count("primary")
        replication_count = evidence_types.count("replication")
        counter_count = evidence_types.count("counter")
        total = len(evidence_types)
        
        consensus_pct = 0
        if total > 0:
            supporting = primary_count + replication_count
            consensus_pct = int((supporting / total) * 100)
        
        confidence_level = "High" if avg_confidence >= 0.7 else "Medium" if avg_confidence >= 0.4 else "Low"
        
        return {
            "claim_id": params.claim_id,
            "claim_data": claim_data,
            "evidence_threads": evidence_threads[:10],  # Limit to top 10
            "related_concepts": related_concepts,
            "synthesis": synthesis,
            "confidence_metrics": {
                "confidence_level": confidence_level,
                "confidence_score": round(avg_confidence, 2),
                "consensus_percentage": consensus_pct,
                "evidence_counts": {
                    "primary": primary_count,
                    "replication": replication_count,
                    "counter": counter_count,
                }
            },
            "segment_info": {
                "timestamp": segment_data.get("timestamp", ""),
                "speaker": segment_data.get("speaker", ""),
                "transcript_excerpt": segment_data.get("transcript_text", "")[:300],
            }
        }
        
    except Exception as e:
        return {
            "error": f"Error getting claim context: {str(e)}"
        }


# ============================================================================
# Deep Dive Summary Generation Tool
# ============================================================================

class GenerateDeepDiveSummaryInput(BaseModel):
    """Input for generating a deep dive summary."""
    claim_id: str = Field(
        ...,
        description="The claim ID in format 'segment_key-index' (e.g., 'lex_325|00:00:00.160|1-0')"
    )
    episode_id: str = Field(
        default="lex_325",
        description="The episode ID"
    )
    n_results: int = Field(
        default=7,
        description="Number of RAG results to retrieve (default: 7)"
    )
    force_regenerate: bool = Field(
        default=False,
        description="If True, regenerate even if cached summary exists"
    )
    style: Literal["technical", "simplified"] = Field(
        default="technical",
        description="Controls prompt depth. 'technical' for detailed/mechanistic, 'simplified' for accessible summary."
    )


@mcp.tool()
async def generate_deep_dive_summary(params: GenerateDeepDiveSummaryInput) -> dict[str, Any]:
    """
    Generate a deep dive summary for a scientific claim using RAG retrieval + Gemini synthesis.

    Flow:
    1. Load claim from cache
    2. Build research query from claim data
    3. Query ChromaDB for relevant paper chunks
    4. Enrich with paper metadata
    5. Call Gemini to synthesize a structured summary
    6. Cache and return the result
    """
    try:
        # Check cache first (unless force_regenerate)
        cache_key = f"{params.episode_id}:{params.claim_id}:{params.style}"

        if not params.force_regenerate:
            cache = _load_deep_dive_cache()
            if cache_key in cache:
                return {
                    "claim_id": params.claim_id,
                    "summary": cache[cache_key]["summary"],
                    "cached": True,
                    "generated_at": cache[cache_key].get("generated_at", "unknown"),
                    "rag_query": cache[cache_key].get("rag_query", ""),
                    "papers_retrieved": cache[cache_key].get("papers_retrieved", 0),
                    "papers": cache[cache_key].get("papers", []),
                }

        # Step 1: Load claim from cache
        claims_cache = _load_claims_cache()

        # Parse claim_id
        parts = params.claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {"error": f"Invalid claim_id format: {params.claim_id}"}

        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {"error": f"Invalid claim index in claim_id: {params.claim_id}"}

        # Get segment and claim data
        segments = claims_cache.get("segments", {})
        segment_data = segments.get(segment_key)

        if not segment_data:
            return {"error": f"Segment not found: {segment_key}"}

        claims_list = segment_data.get("claims", [])
        if claim_index >= len(claims_list):
            return {"error": f"Claim index {claim_index} out of range"}

        claim_data = claims_list[claim_index]

        # Step 2: Build research query
        research_query = _build_research_query(claim_data)

        # Step 3: Query ChromaDB
        vs = get_vectorstore()
        rag_results_raw = vs.search(research_query, n_results=params.n_results)

        # Parse RAG results
        docs = rag_results_raw.get("documents", [[]])[0]
        metas = rag_results_raw.get("metadatas", [[]])[0]

        rag_results = []
        for doc, meta in zip(docs, metas):
            rag_results.append({
                "text": doc,
                "paper_id": meta.get("paper_id", ""),
                "paper_title": meta.get("paper_title", ""),
                "section": meta.get("section_heading", ""),
                "year": meta.get("year", ""),
            })

        # Step 4: Load papers collection for metadata enrichment
        papers_collection = _load_papers_collection()

        # Step 5: Format evidence and build prompt
        evidence_summary = _format_rag_results_for_prompt(rag_results, papers_collection)

        if params.style == "simplified":
            prompt_template = DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED
        else:
            prompt_template = DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL

        prompt = prompt_template.format(
            claim_text=claim_data.get("claim_text", ""),
            speaker_stance=claim_data.get("speaker_stance", "assertion"),
            needs_backing=claim_data.get("needs_backing_because", "No specific reason provided"),
            evidence_summary=evidence_summary,
        )

        # Step 6: Call Gemini
        raw_summary = await asyncio.to_thread(
            _call_gemini_for_deep_dive,
            prompt,
            GEMINI_MODEL_DEFAULT,
        )

        # Step 7: Parse key findings and clean summary
        num_papers = min(len(rag_results), 7)  # Match the limit in _format_rag_results_for_prompt
        key_findings = _parse_paper_key_findings(raw_summary, num_papers)
        clean_summary = _extract_summary_without_findings(raw_summary)

        # Build papers list with paper_id and key_finding
        papers_list = []
        for i, r in enumerate(rag_results[:num_papers]):
            papers_list.append({
                "paper_id": r.get("paper_id", ""),
                "title": r.get("paper_title", ""),
                "section": r.get("section", ""),
                "year": r.get("year", ""),
                "key_finding": key_findings[i] if i < len(key_findings) else "",
            })

        # Step 8: Cache the result
        from datetime import datetime
        cache = _load_deep_dive_cache()
        cache[cache_key] = {
            "summary": clean_summary,
            "generated_at": datetime.utcnow().isoformat(),
            "rag_query": research_query,
            "papers_retrieved": len(rag_results),
            "claim_text": claim_data.get("claim_text", ""),
            "papers": papers_list,
        }
        _save_deep_dive_cache(cache)

        # Return structured response
        return {
            "claim_id": params.claim_id,
            "summary": clean_summary,
            "cached": False,
            "generated_at": cache[cache_key]["generated_at"],
            "rag_query": research_query,
            "papers_retrieved": len(rag_results),
            "papers": papers_list,
        }

    except Exception as e:
        import traceback
        return {
            "error": f"Error generating deep dive summary: {str(e)}",
            "traceback": traceback.format_exc(),
        }


# ============================================================================
# Evidence Threads Generation Tool
# ============================================================================

class GenerateEvidenceThreadsInput(BaseModel):
    """Input for generating evidence threads."""
    claim_id: str = Field(
        ...,
        description="The claim ID in format 'segment_key-index' (e.g., 'lex_325|00:00:00.160|1-0')"
    )
    episode_id: str = Field(
        default="lex_325",
        description="The episode ID"
    )
    n_results: int = Field(
        default=10,
        description="Number of RAG results to retrieve for thread analysis (default: 10)"
    )
    force_regenerate: bool = Field(
        default=False,
        description="If True, regenerate even if cached threads exist"
    )


@mcp.tool()
async def generate_evidence_threads(params: GenerateEvidenceThreadsInput) -> dict[str, Any]:
    """
    Generate evidence threads for a scientific claim - coherent research narratives
    that trace how understanding of the claim developed over time.

    Flow:
    1. Load claim from cache
    2. Build research query from claim data
    3. Query ChromaDB for relevant papers (need 4+ with 3+ year span)
    4. Check eligibility (enough papers with temporal spread)
    5. Call Gemini to identify threads
    6. Validate threads reference real papers
    7. Cache and return
    """
    try:
        from datetime import datetime

        # Check cache first (unless force_regenerate)
        cache_key = f"{params.episode_id}:{params.claim_id}"

        if not params.force_regenerate:
            cache = _load_evidence_threads_cache()
            if cache_key in cache:
                return {
                    "claim_id": params.claim_id,
                    "threads": cache[cache_key]["threads"],
                    "cached": True,
                    "generated_at": cache[cache_key].get("generated_at", "unknown"),
                    "papers_analyzed": cache[cache_key].get("papers_analyzed", 0),
                    "eligible": cache[cache_key].get("eligible", True),
                    "eligibility_reason": cache[cache_key].get("eligibility_reason", "eligible"),
                }

        # Step 1: Load claim from cache
        claims_cache = _load_claims_cache()

        # Parse claim_id
        parts = params.claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {"error": f"Invalid claim_id format: {params.claim_id}"}

        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {"error": f"Invalid claim index in claim_id: {params.claim_id}"}

        # Get segment and claim data
        segments = claims_cache.get("segments", {})
        segment_data = segments.get(segment_key)

        if not segment_data:
            return {"error": f"Segment not found: {segment_key}"}

        claims_list = segment_data.get("claims", [])
        if claim_index >= len(claims_list):
            return {"error": f"Claim index {claim_index} out of range"}

        claim_data = claims_list[claim_index]
        claim_text = claim_data.get("claim_text", "")

        # Step 2: Build research query
        research_query = _build_research_query(claim_data)

        # Step 3: Query ChromaDB with more results for thread analysis
        vs = get_vectorstore()
        rag_results_raw = vs.search(research_query, n_results=params.n_results)

        # Parse RAG results
        docs = rag_results_raw.get("documents", [[]])[0]
        metas = rag_results_raw.get("metadatas", [[]])[0]

        rag_results = []
        for doc, meta in zip(docs, metas):
            rag_results.append({
                "text": doc,
                "paper_id": meta.get("paper_id", ""),
                "paper_title": meta.get("paper_title", ""),
                "section": meta.get("section_heading", ""),
                "year": meta.get("year", ""),
            })

        # Step 4: Check eligibility
        eligible, eligibility_reason = _should_generate_threads(rag_results)

        if not eligible:
            # Cache and return empty result
            result = {
                "claim_id": params.claim_id,
                "threads": [],
                "cached": False,
                "generated_at": datetime.utcnow().isoformat(),
                "papers_analyzed": len(rag_results),
                "eligible": False,
                "eligibility_reason": eligibility_reason,
            }

            cache = _load_evidence_threads_cache()
            cache[cache_key] = result
            _save_evidence_threads_cache(cache)

            return result

        # Step 5: Load papers collection and format for prompt
        papers_collection = _load_papers_collection()
        papers_json = _format_papers_for_thread_prompt(rag_results, papers_collection)

        # Build prompt
        prompt = EVIDENCE_THREAD_PROMPT.format(
            claim_text=claim_text,
            papers_json=papers_json,
        )

        # Step 6: Call Gemini
        gemini_result = await asyncio.to_thread(
            _call_gemini_for_threads,
            prompt,
            GEMINI_MODEL_DEFAULT,
        )

        if gemini_result.get("error"):
            return {
                "claim_id": params.claim_id,
                "threads": [],
                "error": gemini_result["error"],
                "papers_analyzed": len(rag_results),
            }

        raw_threads = gemini_result.get("threads", [])

        # Step 7: Validate threads
        validated_threads = _validate_threads(raw_threads, rag_results)

        # Step 8: Cache and return
        result = {
            "claim_id": params.claim_id,
            "threads": validated_threads,
            "cached": False,
            "generated_at": datetime.utcnow().isoformat(),
            "papers_analyzed": len(rag_results),
            "eligible": True,
            "eligibility_reason": "eligible",
            "raw_thread_count": len(raw_threads),
            "validated_thread_count": len(validated_threads),
        }

        cache = _load_evidence_threads_cache()
        cache[cache_key] = result
        _save_evidence_threads_cache(cache)

        return result

    except Exception as e:
        import traceback
        return {
            "error": f"Error generating evidence threads: {str(e)}",
            "traceback": traceback.format_exc(),
        }


# ============================================================================
# Knowledge Graph Subgraph Retrieval
# ============================================================================

def _load_knowledge_graph() -> dict[str, Any]:
    """Load the knowledge graph from JSON."""
    if not KNOWLEDGE_GRAPH_PATH.exists():
        return {"nodes": [], "edges": [], "metadata": {}}
    try:
        with KNOWLEDGE_GRAPH_PATH.open() as fh:
            return json_module.load(fh)
    except json_module.JSONDecodeError:
        return {"nodes": [], "edges": [], "metadata": {}}


def _load_claim_relevance_cache() -> dict[str, Any]:
    """Load pre-computed claim-entity relevance explanations."""
    if not CLAIM_RELEVANCE_CACHE_PATH.exists():
        return {"claims": {}}
    try:
        with CLAIM_RELEVANCE_CACHE_PATH.open() as fh:
            return json_module.load(fh)
    except json_module.JSONDecodeError:
        return {"claims": {}}


def _normalize_for_matching(text: str) -> str:
    """Normalize text for fuzzy matching."""
    import re
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def _find_matching_entities(
    query_text: str,
    kg_nodes: list[dict],
    min_word_overlap: int = 2
) -> list[str]:
    """
    Find entities in the KG that match terms in the query text.
    Uses keyword matching against entity names and aliases.

    Returns list of matched entity IDs.
    """
    query_normalized = _normalize_for_matching(query_text)
    query_words = set(query_normalized.split())

    matched_entities = []

    for node in kg_nodes:
        node_id = node.get("id", "")
        node_name = node.get("name", "")
        aliases = node.get("aliases", [])

        # Check all names for this entity
        all_names = [node_name] + aliases

        for name in all_names:
            name_normalized = _normalize_for_matching(name)
            name_words = set(name_normalized.split())

            # Check for word overlap
            overlap = query_words & name_words

            # Match if: exact match, or significant word overlap
            if name_normalized in query_normalized or query_normalized in name_normalized:
                matched_entities.append(node_id)
                break
            elif len(overlap) >= min(min_word_overlap, len(name_words)):
                matched_entities.append(node_id)
                break

    return list(set(matched_entities))


def _extract_subgraph(
    entity_ids: list[str],
    kg_nodes: list[dict],
    kg_edges: list[dict],
    max_hops: int = 1
) -> dict[str, Any]:
    """
    Extract a subgraph containing the specified entities and their connections.

    Args:
        entity_ids: Starting entity IDs
        kg_nodes: All nodes in the KG
        kg_edges: All edges in the KG
        max_hops: How many hops away to include (1 = direct connections only)

    Returns:
        Subgraph with nodes and edges
    """
    # Build lookup maps
    nodes_by_id = {n["id"]: n for n in kg_nodes}

    # Start with seed entities
    included_entity_ids = set(entity_ids)

    # Expand by hops
    for _ in range(max_hops):
        new_entities = set()
        for edge in kg_edges:
            source = edge.get("source", "")
            target = edge.get("target", "")

            if source in included_entity_ids:
                new_entities.add(target)
            if target in included_entity_ids:
                new_entities.add(source)

        included_entity_ids.update(new_entities)

    # Get relevant edges (both endpoints must be in subgraph)
    subgraph_edges = [
        edge for edge in kg_edges
        if edge.get("source") in included_entity_ids
        and edge.get("target") in included_entity_ids
    ]

    # Get relevant nodes
    subgraph_nodes = [
        nodes_by_id[eid] for eid in included_entity_ids
        if eid in nodes_by_id
    ]

    return {
        "nodes": subgraph_nodes,
        "edges": subgraph_edges,
    }


ENTITY_EXTRACTION_PROMPT = """Extract the key scientific concepts, molecules, organisms, processes, and phenomena mentioned in this claim.

CLAIM: "{claim_text}"

Return ONLY a JSON array of entity names (strings), nothing else. Focus on:
- Molecules/proteins (e.g., "membrane voltage", "ion channels", "V-ATPase")
- Organisms (e.g., "Xenopus", "planaria", "zebrafish")
- Processes (e.g., "regeneration", "left-right patterning")
- Techniques (e.g., "optogenetics", "voltage imaging")

Example output: ["membrane voltage", "ion channels", "regeneration", "planaria"]

Output ONLY the JSON array:"""


async def _extract_entities_with_gemini(claim_text: str) -> list[str]:
    """Use Gemini to extract entity names from claim text."""
    try:
        _ensure_gemini_client_ready()

        prompt = ENTITY_EXTRACTION_PROMPT.format(claim_text=claim_text)

        response = await asyncio.to_thread(
            lambda: _GENAI_CLIENT.models.generate_content(
                model=GEMINI_MODEL_DEFAULT,
                contents=prompt,
            )
        )

        # Extract text
        text = None
        if hasattr(response, "text"):
            text = response.text
        elif hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                text = "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))

        if not text:
            return []

        # Clean and parse
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        entities = json_module.loads(text)
        return entities if isinstance(entities, list) else []

    except Exception as e:
        print(f"[KG] Gemini entity extraction failed: {e}")
        return []


class GetRelevantKGSubgraphInput(BaseModel):
    """Input for retrieving a relevant knowledge graph subgraph."""
    claim_id: Optional[str] = Field(
        default=None,
        description="The claim ID to get KG context for (format: 'segment_key-index')"
    )
    claim_text: Optional[str] = Field(
        default=None,
        description="Direct claim text to search (alternative to claim_id)"
    )
    episode_id: str = Field(
        default="lex_325",
        description="The episode ID (used with claim_id)"
    )
    max_hops: int = Field(
        default=1,
        ge=1,
        le=2,
        description="How many hops from matched entities to include (1-2)"
    )
    use_gemini_extraction: bool = Field(
        default=False,
        description="Use Gemini for entity extraction (slower but more accurate)"
    )


@mcp.tool()
async def get_relevant_kg_subgraph(params: GetRelevantKGSubgraphInput) -> dict[str, Any]:
    """
    Get a relevant subgraph from the knowledge graph for a given claim.

    This tool extracts entities mentioned in the claim and returns the
    portion of the knowledge graph containing those entities and their
    relationships.

    Flow:
    1. Get claim text (from claim_id or directly)
    2. Extract entities from claim using keyword matching or Gemini
    3. Find matching entities in the knowledge graph
    4. Extract subgraph with specified hop distance
    5. Return nodes and edges
    """
    try:
        # Step 1: Get claim text
        claim_text = params.claim_text

        if not claim_text and params.claim_id:
            # Load from claims cache
            claims_cache = _load_claims_cache()

            parts = params.claim_id.rsplit("-", 1)
            if len(parts) != 2:
                return {"error": f"Invalid claim_id format: {params.claim_id}"}

            segment_key = parts[0]
            try:
                claim_index = int(parts[1])
            except ValueError:
                return {"error": f"Invalid claim index in claim_id: {params.claim_id}"}

            segments = claims_cache.get("segments", {})
            segment_data = segments.get(segment_key)

            if not segment_data:
                return {"error": f"Segment not found: {segment_key}"}

            claims_list = segment_data.get("claims", [])
            if claim_index >= len(claims_list):
                return {"error": f"Claim index {claim_index} out of range"}

            claim_data = claims_list[claim_index]
            claim_text = claim_data.get("claim_text", "")

        if not claim_text:
            return {"error": "No claim text provided. Use claim_id or claim_text parameter."}

        # Step 2: Load knowledge graph
        kg = _load_knowledge_graph()
        kg_nodes = kg.get("nodes", [])
        kg_edges = kg.get("edges", [])

        if not kg_nodes:
            return {
                "error": "Knowledge graph is empty. Run the extraction pipeline first.",
                "hint": "python3 scripts/knowledge_graph/extract_kg_from_papers.py --all"
            }

        # Step 3: Extract/match entities
        if params.use_gemini_extraction:
            # Use Gemini to extract entity names, then match to KG
            extracted_names = await _extract_entities_with_gemini(claim_text)
            matched_ids = []
            for name in extracted_names:
                ids = _find_matching_entities(name, kg_nodes, min_word_overlap=1)
                matched_ids.extend(ids)
            matched_ids = list(set(matched_ids))
        else:
            # Direct keyword matching
            matched_ids = _find_matching_entities(claim_text, kg_nodes, min_word_overlap=2)

        if not matched_ids:
            # Try with looser matching
            matched_ids = _find_matching_entities(claim_text, kg_nodes, min_word_overlap=1)

        if not matched_ids:
            return {
                "claim_text": claim_text,
                "matched_entities": [],
                "nodes": [],
                "edges": [],
                "message": "No matching entities found in knowledge graph for this claim."
            }

        # Step 4: Extract subgraph
        subgraph = _extract_subgraph(
            matched_ids,
            kg_nodes,
            kg_edges,
            max_hops=params.max_hops
        )

        # Step 5: Format response
        # Mark which nodes were direct matches vs expanded
        for node in subgraph["nodes"]:
            node["is_direct_match"] = node["id"] in matched_ids

        # Step 6: Inject pre-computed claim-entity relevance
        if params.claim_id:
            relevance_cache = _load_claim_relevance_cache()
            claim_relevance = relevance_cache.get("claims", {}).get(params.claim_id, {}).get("entities", {})

            for node in subgraph["nodes"]:
                node_id = node["id"]
                if node_id in claim_relevance:
                    node["relevance_to_claim"] = claim_relevance[node_id].get("relevance_to_claim")
                    node["claim_role"] = claim_relevance[node_id].get("claim_role")
                else:
                    # Fallback for entities not in cache
                    node["relevance_to_claim"] = None
                    node["claim_role"] = "supporting_context"

        # Sort edges by relationship type for better display
        subgraph["edges"].sort(key=lambda e: e.get("relationship", ""))

        return {
            "claim_text": claim_text,
            "matched_entity_ids": matched_ids,
            "matched_entity_names": [
                next((n["name"] for n in kg_nodes if n["id"] == eid), eid)
                for eid in matched_ids
            ],
            "nodes": subgraph["nodes"],
            "edges": subgraph["edges"],
            "stats": {
                "direct_matches": len(matched_ids),
                "total_nodes": len(subgraph["nodes"]),
                "total_edges": len(subgraph["edges"]),
            }
        }

    except Exception as e:
        import traceback
        return {
            "error": f"Error retrieving KG subgraph: {str(e)}",
            "traceback": traceback.format_exc(),
        }


# ============================================================================
# Concept Expansion (Gemini-powered graph expansion)
# ============================================================================

CONCEPT_EXPANSION_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "cache" / "concept_expansions.json"

GROUNDED_EXPANSION_PROMPT = """You are analyzing bioelectricity research to map scientific concepts and their relationships.

Your task: Given a concept and supporting paper evidence, identify RELATED concepts, supporting evidence, and potential counter-arguments.

CRITICAL CONSTRAINT: You may ONLY identify concepts and relationships that are EXPLICITLY mentioned in the provided paper excerpts. Do not speculate or add concepts from general knowledge.

## INPUT CONCEPT
Name: {concept_name}
Context: {concept_context}

## PAPER EVIDENCE FROM RAG RETRIEVAL
{rag_evidence}

## EXISTING KNOWLEDGE GRAPH CONTEXT
{kg_context}

## YOUR TASK
Analyze the paper evidence and identify:

1. **RELATED CONCEPTS** (max 5): Other scientific concepts explicitly mentioned in connection with the input concept
   - Must be directly mentioned in the paper excerpts
   - Include the exact quote that establishes the relationship
   - Classify the relationship type

2. **SUPPORTING EVIDENCE** (max 3): Specific findings that strengthen understanding of this concept
   - Must cite specific paper and section
   - Include quantitative data if present

3. **COUNTER-ARGUMENTS** (max 2): Evidence that challenges, limits, or qualifies the concept
   - Only if explicitly present in papers
   - Include the source

4. **CROSS-DOMAIN CONNECTIONS** (max 2): Links to concepts in other biological/physical domains
   - Must have explicit paper evidence for the connection

## OUTPUT FORMAT (JSON only)
{{
  "related_concepts": [
    {{
      "name": "concept name",
      "type": "concept|organism|technique|molecule|gene|process|phenomenon",
      "relationship": "regulates|enables|disrupts|precedes|correlates_with|required_for|inhibits|activates|produces|expressed_in|interacts_with|part_of|measured_by",
      "evidence_quote": "exact quote from paper",
      "paper_id": "paper ID",
      "paper_title": "title",
      "section": "section name",
      "confidence": 0.0-1.0
    }}
  ],
  "supporting_evidence": [
    {{
      "finding": "specific finding",
      "paper_id": "paper ID",
      "paper_title": "title",
      "section": "section",
      "quote": "supporting quote"
    }}
  ],
  "counter_arguments": [
    {{
      "argument": "the counter-argument",
      "paper_id": "paper ID",
      "paper_title": "title",
      "limitation_type": "scope|methodology|replication|interpretation"
    }}
  ],
  "cross_domain": [
    {{
      "domain": "domain name",
      "concept": "concept in other domain",
      "connection": "how they relate",
      "paper_id": "paper ID",
      "evidence_quote": "quote establishing connection"
    }}
  ],
  "analysis_notes": "brief explanation of your reasoning"
}}

RULES:
- Output ONLY valid JSON
- Every concept/evidence MUST have a paper_id and quote
- If you cannot find evidence for a category, return an empty array []
- Confidence scores: 1.0 = explicit statement, 0.7-0.9 = strong implication, <0.7 = weak/indirect
- Do NOT make up paper IDs - use only those in the evidence provided
"""


def _load_expansion_cache() -> dict:
    """Load cached concept expansions."""
    if CONCEPT_EXPANSION_CACHE_PATH.exists():
        try:
            with CONCEPT_EXPANSION_CACHE_PATH.open() as fh:
                return json_module.load(fh)
        except (json_module.JSONDecodeError, OSError):
            pass
    return {}


def _save_expansion_cache(cache: dict) -> None:
    """Save concept expansion cache."""
    try:
        CONCEPT_EXPANSION_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with CONCEPT_EXPANSION_CACHE_PATH.open("w") as fh:
            json_module.dump(cache, fh, indent=2)
    except OSError as e:
        print(f"[EXPANSION_CACHE] Failed to save cache: {e}")


def _call_gemini_for_expansion(prompt: str, model_name: str) -> dict:
    """Call Gemini with thinking mode for grounded concept expansion."""
    _ensure_gemini_client_ready()

    response = _GENAI_CLIENT.models.generate_content(
        model=model_name,
        contents=prompt,
    )

    # Extract text from response
    text = None
    if hasattr(response, "text"):
        text = response.text
    elif hasattr(response, "candidates") and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
            text = "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))

    if not text:
        raise ValueError("Could not extract text from Gemini response")

    # Clean up the response - remove markdown code blocks if present
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # Parse JSON
    try:
        result = json_module.loads(text)
        return result
    except json_module.JSONDecodeError as e:
        print(f"[GEMINI_EXPANSION] Failed to parse JSON: {e}")
        print(f"[GEMINI_EXPANSION] Raw response: {text[:500]}")
        return {
            "related_concepts": [],
            "supporting_evidence": [],
            "counter_arguments": [],
            "cross_domain": [],
            "error": "Failed to parse Gemini response as JSON"
        }


def _validate_expansion_result(result: dict, valid_paper_ids: set) -> dict:
    """Validate that expansion results only reference papers we have."""
    validated = {
        "related_concepts": [],
        "supporting_evidence": [],
        "counter_arguments": [],
        "cross_domain": [],
        "analysis_notes": result.get("analysis_notes", ""),
    }

    # Validate related concepts
    for concept in result.get("related_concepts", []):
        paper_id = concept.get("paper_id", "")
        if paper_id and paper_id in valid_paper_ids:
            validated["related_concepts"].append(concept)
        else:
            print(f"[EXPANSION_VALIDATION] Skipping concept with invalid paper_id: {paper_id}")

    # Validate supporting evidence
    for evidence in result.get("supporting_evidence", []):
        paper_id = evidence.get("paper_id", "")
        if paper_id and paper_id in valid_paper_ids:
            validated["supporting_evidence"].append(evidence)

    # Validate counter arguments
    for counter in result.get("counter_arguments", []):
        paper_id = counter.get("paper_id", "")
        if paper_id and paper_id in valid_paper_ids:
            validated["counter_arguments"].append(counter)

    # Validate cross domain
    for cross in result.get("cross_domain", []):
        paper_id = cross.get("paper_id", "")
        if paper_id and paper_id in valid_paper_ids:
            validated["cross_domain"].append(cross)

    return validated


class ExpandConceptGroundedInput(BaseModel):
    """Input for grounded concept expansion."""
    concept_name: str = Field(
        ...,
        description="The concept/node to expand"
    )
    concept_context: Optional[str] = Field(
        default=None,
        description="Additional context (e.g., the claim it came from)"
    )
    n_rag_results: int = Field(
        default=10,
        ge=5,
        le=20,
        description="Number of RAG results to retrieve for grounding"
    )
    include_counter_arguments: bool = Field(
        default=True,
        description="Whether to look for contradicting evidence"
    )
    include_cross_domain: bool = Field(
        default=True,
        description="Whether to find connections to other fields"
    )
    use_cache: bool = Field(
        default=True,
        description="Whether to use cached results if available"
    )


@mcp.tool()
async def expand_concept_grounded(params: ExpandConceptGroundedInput) -> dict[str, Any]:
    """
    Expand a concept node using RAG-grounded Gemini analysis.

    Returns new nodes and edges that are strictly grounded in the paper corpus.
    Uses Gemini's thinking mode for thorough analysis.

    This tool:
    1. Searches the paper corpus for passages related to the concept
    2. Gets existing knowledge graph context
    3. Asks Gemini to identify related concepts, evidence, counter-arguments
    4. Validates that all references point to real papers
    5. Returns structured expansion data for graph visualization
    """
    try:
        import hashlib

        # Check cache first
        cache_key = hashlib.md5(
            f"{params.concept_name}:{params.concept_context or ''}".encode()
        ).hexdigest()

        if params.use_cache:
            cache = _load_expansion_cache()
            if cache_key in cache:
                print(f"[CONCEPT_EXPANSION] Cache hit for '{params.concept_name}'")
                return cache[cache_key]

        # Step 1: RAG search for relevant paper passages
        vs = get_vectorstore()
        rag_results = vs.search(params.concept_name, n_results=params.n_rag_results)

        documents = rag_results.get("documents", [[]])[0]
        metadatas = rag_results.get("metadatas", [[]])[0]

        if not documents:
            return {
                "concept_name": params.concept_name,
                "error": "No relevant papers found in corpus for this concept.",
                "related_concepts": [],
                "supporting_evidence": [],
                "counter_arguments": [],
                "cross_domain": [],
            }

        # Build evidence text and collect valid paper IDs
        valid_paper_ids = set()
        evidence_lines = []

        for i, (doc, meta) in enumerate(zip(documents, metadatas), 1):
            paper_id = meta.get("paper_id", "")
            paper_title = meta.get("paper_title", "Unknown")
            section = meta.get("section_heading", "")
            year = meta.get("year", "")

            if paper_id:
                valid_paper_ids.add(paper_id)

            evidence_lines.append(f"""
### Paper {i}: {paper_title} ({year})
Paper ID: {paper_id}
Section: {section}

Excerpt:
{doc[:800]}
""")

        rag_evidence = "\n".join(evidence_lines)

        # Step 2: Get existing KG context
        kg = _load_knowledge_graph()
        kg_nodes = kg.get("nodes", [])
        kg_edges = kg.get("edges", [])

        # Find if concept already exists in KG
        existing_edges = []
        concept_lower = params.concept_name.lower()

        for edge in kg_edges:
            source_node = next((n for n in kg_nodes if n["id"] == edge.get("source")), None)
            target_node = next((n for n in kg_nodes if n["id"] == edge.get("target")), None)

            if source_node and concept_lower in source_node.get("name", "").lower():
                existing_edges.append({
                    "source": source_node.get("name"),
                    "target": target_node.get("name") if target_node else edge.get("target"),
                    "relationship": edge.get("relationship"),
                })
            elif target_node and concept_lower in target_node.get("name", "").lower():
                existing_edges.append({
                    "source": source_node.get("name") if source_node else edge.get("source"),
                    "target": target_node.get("name"),
                    "relationship": edge.get("relationship"),
                })

        kg_context = "No existing knowledge graph connections found."
        if existing_edges:
            kg_context = "Existing connections in knowledge graph:\n"
            for edge in existing_edges[:10]:  # Limit to 10
                kg_context += f"- {edge['source']} --[{edge['relationship']}]--> {edge['target']}\n"

        # Step 3: Build and call Gemini prompt
        prompt = GROUNDED_EXPANSION_PROMPT.format(
            concept_name=params.concept_name,
            concept_context=params.concept_context or "No additional context provided.",
            rag_evidence=rag_evidence,
            kg_context=kg_context,
        )

        model_name = os.environ.get("GEMINI_MODEL", GEMINI_MODEL_DEFAULT)
        result = _call_gemini_for_expansion(prompt, model_name)

        # Step 4: Validate results
        validated_result = _validate_expansion_result(result, valid_paper_ids)

        # Step 5: Build response
        response = {
            "concept_name": params.concept_name,
            "concept_context": params.concept_context,
            "related_concepts": validated_result["related_concepts"],
            "supporting_evidence": validated_result["supporting_evidence"],
            "counter_arguments": validated_result["counter_arguments"] if params.include_counter_arguments else [],
            "cross_domain": validated_result["cross_domain"] if params.include_cross_domain else [],
            "analysis_notes": validated_result.get("analysis_notes", ""),
            "stats": {
                "rag_results_used": len(documents),
                "papers_referenced": len(valid_paper_ids),
                "existing_kg_edges": len(existing_edges),
                "new_concepts_found": len(validated_result["related_concepts"]),
                "evidence_found": len(validated_result["supporting_evidence"]),
                "counter_arguments_found": len(validated_result["counter_arguments"]),
                "cross_domain_found": len(validated_result["cross_domain"]),
            }
        }

        # Cache the result
        if params.use_cache:
            cache = _load_expansion_cache()
            cache[cache_key] = response
            _save_expansion_cache(cache)

        return response

    except Exception as e:
        import traceback
        return {
            "concept_name": params.concept_name,
            "error": f"Error expanding concept: {str(e)}",
            "traceback": traceback.format_exc(),
            "related_concepts": [],
            "supporting_evidence": [],
            "counter_arguments": [],
            "cross_domain": [],
        }


# ============================================================================
# Quiz Question Generation
# ============================================================================

QUIZ_GENERATION_PROMPT = """You are a science education expert creating flashcard-style quiz questions for a research podcast listener.

Given the following bookmarked content from a science podcast research app, generate thoughtful questions that test understanding, not just recall.

## BOOKMARKED CONTENT
{bookmarks_text}

## YOUR TASK
Generate {total_questions} questions total. For each question:

1. Create a clear, specific question that tests understanding
2. Provide a concise but complete answer (2-3 sentences)
3. Classify the question type:
   - "recall": Direct factual recall (e.g., "What did X discover?")
   - "concept": Understanding of concepts/relationships (e.g., "How does X relate to Y?")
   - "application": Applying knowledge to new situations (e.g., "What would happen if...?")

## OUTPUT FORMAT
Return a JSON array with this exact structure:
[
  {{
    "bookmark_id": "the bookmark ID this question is based on",
    "question": "The question text",
    "answer": "The answer text (2-3 sentences)",
    "question_type": "recall|concept|application",
    "source_text": "The key text from the bookmark that contains the answer (brief excerpt)"
  }}
]

## GUIDELINES
- Focus on questions that require understanding, not just memorization
- Use clear, unambiguous phrasing
- Answers should explain the "why" not just the "what"
- For scientific claims, test understanding of mechanisms or implications
- Vary question types across recall, concept, and application

Return ONLY the JSON array, no preamble or explanation."""


class GenerateQuizQuestionsInput(BaseModel):
    bookmarks: list[dict] = Field(
        ...,
        description="List of bookmark objects with id, type, title, content fields"
    )
    questions_per_bookmark: int = Field(
        default=1,
        description="Number of questions to generate per bookmark"
    )


@mcp.tool()
async def generate_quiz_questions(params: GenerateQuizQuestionsInput) -> dict[str, Any]:
    """
    Generate flashcard-style quiz questions from bookmarked content using Gemini.

    This tool takes a list of bookmarks (claims, papers, snippets) and generates
    educational questions to test understanding of the material.

    Returns:
        - questions: Array of generated questions with answers
        - total_generated: Number of questions created
        - bookmarks_processed: Number of bookmarks used
    """
    try:
        _ensure_gemini_client_ready()
    except RuntimeError as e:
        return {"error": str(e), "questions": []}

    bookmarks = params.bookmarks
    if not bookmarks:
        return {"error": "No bookmarks provided", "questions": []}

    # Format bookmarks for prompt
    bookmarks_text_parts = []
    for i, bm in enumerate(bookmarks, 1):
        content = (
            bm.get("content")
            or bm.get("claim_text")
            or bm.get("paper_abstract")
            or bm.get("title")
            or ""
        )
        bookmarks_text_parts.append(f"""
---
Bookmark {i} (ID: {bm.get('id', f'unknown_{i}')})
Type: {bm.get('type', 'unknown')}
Title: {bm.get('title', 'Untitled')}
Content: {content[:500]}
""")

    bookmarks_text = "\n".join(bookmarks_text_parts)
    total_questions = min(len(bookmarks) * params.questions_per_bookmark, 15)  # Cap at 15

    prompt = QUIZ_GENERATION_PROMPT.format(
        bookmarks_text=bookmarks_text,
        total_questions=total_questions
    )

    try:
        response = _GENAI_CLIENT.models.generate_content(
            model=GEMINI_MODEL_DEFAULT,
            contents=prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 4096,
            }
        )

        response_text = response.text.strip()

        # Parse JSON response - handle markdown code blocks
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        questions = json_module.loads(response_text.strip())

        return {
            "questions": questions,
            "total_generated": len(questions),
            "bookmarks_processed": len(bookmarks),
        }

    except json_module.JSONDecodeError as e:
        return {
            "error": f"Failed to parse Gemini response as JSON: {str(e)}",
            "raw_response": response_text[:500] if 'response_text' in locals() else None,
            "questions": [],
        }
    except Exception as e:
        return {
            "error": f"Failed to generate questions: {str(e)}",
            "questions": [],
        }


# ============================================================================
# Contextual Chat Tool
# ============================================================================

CHAT_CONTEXT_PROMPT_TEMPLATE = """You are an expert research assistant for a bioelectricity podcast app.
Answer the user's question using the provided context from research papers.

## EPISODE CONTEXT
Episode: {episode_title}
Guest: {guest_name}
{claim_context}

## CONVERSATION HISTORY
{conversation_history}

## RETRIEVED RESEARCH PAPERS
{rag_results}

## USER'S QUESTION
{user_message}

## INSTRUCTIONS
1. Answer the question directly and concisely based on the retrieved papers
2. When citing information, mention the paper title
3. If the papers don't contain relevant information, say so clearly and offer what you can based on general knowledge
4. Keep responses focused on the podcast episode and claim context when relevant
5. Use language appropriate for an educated audience interested in science
6. Keep responses to 2-4 paragraphs unless more detail is needed

## YOUR RESPONSE
"""


class ChatMessage(BaseModel):
    """A single message in the conversation history."""
    role: Literal["user", "assistant"] = Field(..., description="The role of the message sender")
    content: str = Field(..., description="The message content")


class ChatWithContextInput(BaseModel):
    """Input for contextual chat about podcast content."""
    message: str = Field(..., description="The user's question or message")
    episode_id: str = Field(..., description="The episode being listened to")
    claim_id: Optional[str] = Field(default=None, description="Optional current claim ID for focused context")
    conversation_history: list[dict] = Field(
        default_factory=list,
        description="Previous messages in format [{role: 'user'|'assistant', content: str}]"
    )
    n_results: int = Field(default=5, ge=1, le=10, description="Number of RAG results to retrieve")


def _load_episodes() -> list[dict]:
    """Load the episodes data."""
    if not EPISODES_FILE_PATH.exists():
        return []
    try:
        with EPISODES_FILE_PATH.open() as fh:
            return json_module.load(fh)
    except json_module.JSONDecodeError:
        return []


def _format_conversation_history(history: list[dict]) -> str:
    """Format conversation history for the prompt."""
    if not history:
        return "(No previous messages)"

    formatted = []
    # Keep last 6 messages to avoid context overflow
    recent_history = history[-6:] if len(history) > 6 else history

    for msg in recent_history:
        role = msg.get("role", "user").capitalize()
        content = msg.get("content", "")
        formatted.append(f"{role}: {content}")

    return "\n".join(formatted)


def _format_rag_results_for_chat(rag_results: list, papers_collection: dict) -> str:
    """Format RAG results for the chat prompt (lighter than deep dive format)."""
    if not rag_results:
        return "(No relevant papers found in the corpus)"

    lines = []
    for i, result in enumerate(rag_results[:5], 1):
        paper_id = result.get("paper_id", "")
        paper_title = result.get("paper_title", "Unknown paper")
        section = result.get("section", "")
        text_chunk = result.get("text", "")[:500]
        year = result.get("year", "")

        lines.append(f"""
**[{i}] {paper_title}** ({year})
Section: {section}
"{text_chunk}..."
""")

    return "\n".join(lines)


@mcp.tool()
async def chat_with_context(params: ChatWithContextInput) -> dict[str, Any]:
    """
    Answer questions about podcast content using RAG retrieval and Gemini synthesis.

    This tool provides contextual chat capabilities for the podcast app, answering
    questions about the current episode and claims using retrieved research papers.

    Flow:
    1. Load episode metadata
    2. Optionally load claim context if claim_id provided
    3. RAG search the paper corpus using the user's message
    4. Build prompt with episode context + claim context + conversation history + RAG results
    5. Call Gemini for synthesis
    6. Return response with sources
    """
    try:
        # Step 1: Load episode metadata
        episodes = _load_episodes()
        episode = next((e for e in episodes if e.get("id") == params.episode_id), None)

        if not episode:
            episode_title = f"Episode {params.episode_id}"
            guest_name = "Unknown Guest"
        else:
            episode_title = episode.get("title", f"Episode {params.episode_id}")
            guest_name = episode.get("guest", "Unknown Guest")

        # Step 2: Load claim context if provided
        claim_context = ""
        if params.claim_id and "-" in params.claim_id:
            claims_cache = _load_claims_cache()
            parts = params.claim_id.rsplit("-", 1)
            if len(parts) == 2:
                segment_key = parts[0]
                try:
                    claim_index = int(parts[1])
                    segments = claims_cache.get("segments", {})
                    segment_data = segments.get(segment_key)
                    if segment_data:
                        claims_list = segment_data.get("claims", [])
                        if claim_index < len(claims_list):
                            claim_data = claims_list[claim_index]
                            claim_text = claim_data.get("claim_text", "")
                            distilled = claim_data.get("distilled_claim", "")
                            claim_context = f"""
Current Claim Being Discussed:
"{distilled or claim_text}"
"""
                except (ValueError, IndexError):
                    pass

        # Step 3: RAG search using the user's message
        vs = get_vectorstore()

        # Build search query - combine message with claim context for better results
        search_query = params.message
        if claim_context:
            # Extract key terms from claim for better search
            search_query = f"{params.message} bioelectricity Levin"

        rag_results_raw = vs.search(search_query, n_results=params.n_results)

        # Parse RAG results
        docs = rag_results_raw.get("documents", [[]])[0]
        metas = rag_results_raw.get("metadatas", [[]])[0]

        rag_results = []
        for doc, meta in zip(docs, metas):
            rag_results.append({
                "text": doc,
                "paper_id": meta.get("paper_id", ""),
                "paper_title": meta.get("paper_title", ""),
                "section": meta.get("section_heading", ""),
                "year": meta.get("year", ""),
            })

        # Step 4: Load papers collection for metadata
        papers_collection = _load_papers_collection()

        # Step 5: Format prompt
        formatted_history = _format_conversation_history(params.conversation_history)
        formatted_rag = _format_rag_results_for_chat(rag_results, papers_collection)

        prompt = CHAT_CONTEXT_PROMPT_TEMPLATE.format(
            episode_title=episode_title,
            guest_name=guest_name,
            claim_context=claim_context if claim_context else "(No specific claim selected)",
            conversation_history=formatted_history,
            rag_results=formatted_rag,
            user_message=params.message,
        )

        # Step 6: Call Gemini
        _ensure_gemini_client_ready()
        response = await asyncio.to_thread(
            lambda: _GENAI_CLIENT.models.generate_content(
                model=GEMINI_MODEL_DEFAULT,
                contents=prompt,
                config={
                    "temperature": 0.7,
                    "max_output_tokens": 2048,
                }
            )
        )

        # Extract response text
        if hasattr(response, "text"):
            response_text = response.text
        elif hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                response_text = "".join(
                    part.text for part in candidate.content.parts if hasattr(part, "text")
                )
            else:
                response_text = "I apologize, but I couldn't generate a response."
        else:
            response_text = "I apologize, but I couldn't generate a response."

        # Step 7: Build sources list
        sources = []
        for r in rag_results:
            if r.get("paper_id"):
                sources.append({
                    "paper_id": r.get("paper_id", ""),
                    "paper_title": r.get("paper_title", ""),
                    "year": r.get("year", ""),
                    "section": r.get("section", ""),
                    "relevance_snippet": r.get("text", "")[:200] + "..." if r.get("text") else "",
                })

        return {
            "response": response_text.strip(),
            "sources": sources,
            "query_used": search_query,
            "model": GEMINI_MODEL_DEFAULT,
        }

    except Exception as e:
        import traceback
        return {
            "error": f"Error in chat: {str(e)}",
            "traceback": traceback.format_exc(),
            "response": "",
            "sources": [],
        }


if __name__ == "__main__":
    mcp.run()
