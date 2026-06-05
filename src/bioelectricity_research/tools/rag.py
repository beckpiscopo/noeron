"""Vector store semantic search tools."""

import json
import logging
from typing import Literal

from ..mcp_app import mcp, get_vectorstore

logger = logging.getLogger(__name__)


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
            return json.dumps(
                {
                    "query": query,
                    "results": [
                        {
                            "text": doc,
                            "paper_title": meta.get("paper_title"),
                            "section": meta.get("section_heading"),
                            "page": meta.get("page"),
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
