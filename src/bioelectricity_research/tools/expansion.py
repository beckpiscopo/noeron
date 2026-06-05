"""Grounded concept expansion tool."""

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..cache_store import _load_expansion_cache, _load_knowledge_graph, _save_expansion_cache
from ..config import GEMINI_MODEL
from ..expansion_utils import _call_gemini_for_expansion, _validate_expansion_result
from ..mcp_app import mcp, get_vectorstore
from ..schemas.expansion import ConceptExpansionResponse

logger = logging.getLogger(__name__)

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
async def expand_concept_grounded(params: ExpandConceptGroundedInput) -> ConceptExpansionResponse:
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
                logger.debug("Cache hit for concept expansion: %s", params.concept_name)
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

        result = _call_gemini_for_expansion(prompt, GEMINI_MODEL)

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
