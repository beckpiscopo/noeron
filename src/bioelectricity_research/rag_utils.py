"""RAG result formatting and query construction helpers."""

import logging

logger = logging.getLogger(__name__)


def _build_research_query(claim_data: dict) -> str:
    """Build a Semantic Scholar search query from claim data.

    Prefers the pre-computed research_query field; falls back to claim text + context tags.
    """
    if claim_data.get("research_query"):
        return claim_data["research_query"]

    claim_text = claim_data.get("claim_text", "")
    context_tags = claim_data.get("context_tags") or {}
    query_parts = []

    for tag_key in ("organism", "mechanism", "interaction", "concept"):
        if context_tags.get(tag_key):
            query_parts.append(context_tags[tag_key].lower())

    stopwords = {"there", "these", "their", "about", "being", "could", "would", "should", "which", "through"}
    claim_words = [
        w.lower().strip(".,;:\"'")
        for w in claim_text.split()
        if len(w) > 5 and w.lower() not in stopwords
    ]
    query_parts.extend(claim_words[:5])
    query_parts.append("Levin")

    seen: set[str] = set()
    deduped = []
    for part in query_parts:
        if part and part not in seen:
            deduped.append(part)
            seen.add(part)

    return " ".join(deduped) if deduped else claim_text[:100]


def _format_rag_results_for_prompt(rag_results: list, papers_collection: dict) -> str:
    """Format RAG results into a readable summary for the Gemini deep-dive prompt."""
    if not rag_results:
        return "No matching papers found in the corpus. The evidence base for this claim is limited or the corpus does not cover this topic."

    lines = []
    for i, result in enumerate(rag_results[:7], 1):
        paper_id = result.get("paper_id", "")
        paper_title = result.get("paper_title", "Unknown paper")
        section = result.get("section", result.get("section_heading", ""))
        text_chunk = result.get("text", "")[:600]
        year = result.get("year", "")

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


def _format_rag_results_for_chat(rag_results: list, papers_collection: dict) -> str:
    """Format RAG results for the chat prompt (lighter than deep-dive format)."""
    if not rag_results:
        return "(No relevant papers found in the corpus)"

    lines = []
    for i, result in enumerate(rag_results[:5], 1):
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
