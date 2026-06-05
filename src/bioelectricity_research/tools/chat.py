"""Contextual chat tool."""

import asyncio
import logging
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ..cache_store import _load_claims_cache, _load_papers_collection
from ..chat_utils import _format_conversation_history
from ..config import GEMINI_MODEL
from ..episodes import _load_episodes
from ..mcp_app import mcp, get_vectorstore, _ensure_gemini_client_ready, _get_genai_client
from ..rag_utils import _format_rag_results_for_chat
from ..schemas.chat import ChatResponse

logger = logging.getLogger(__name__)

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
    current_timestamp: Optional[str] = Field(
        default=None,
        description="Current playback timestamp (e.g., '23:45' or '1:23:45') for temporal context"
    )
    conversation_history: list[dict] = Field(
        default_factory=list,
        description="Previous messages in format [{role: 'user'|'assistant', content: str}]"
    )
    n_results: int = Field(default=5, ge=1, le=10, description="Number of RAG results to retrieve")
    use_layered_context: bool = Field(
        default=True,
        description="Use the new layered context builder for rich timestamp-aware context"
    )
    include_thinking: bool = Field(
        default=True,
        description="Include Gemini's thinking/reasoning traces in the response"
    )


@mcp.tool()
async def chat_with_context(params: ChatWithContextInput) -> ChatResponse:
    """
    Answer questions about podcast content using RAG retrieval and Gemini synthesis.

    This tool provides contextual chat capabilities for the podcast app, answering
    questions about the current episode and claims using retrieved research papers.

    NEW: When use_layered_context=True (default), uses the advanced context builder
    that provides:
    - Episode awareness (metadata, summary, key topics)
    - Temporal synchronization (current playback position, transcript window)
    - Evidence cards integration (papers shown at current timestamp)
    - RAG retrieval context (query-triggered paper retrieval)

    Flow:
    1. Build layered context (episode + temporal window + evidence cards)
    2. RAG search the paper corpus using the user's message
    3. Build prompt with layered context + conversation history + RAG results
    4. Call Gemini for synthesis
    5. Return response with sources (including evidence cards)
    """
    try:
        # Import context builder
        from ..context_builder import (
            build_chat_context,
            build_system_prompt,
            ChatContextLayers,
        )

        # Step 1: Build layered context
        context_layers: Optional[ChatContextLayers] = None
        system_prompt = ""

        if params.use_layered_context:
            context_layers = build_chat_context(
                episode_id=params.episode_id,
                current_timestamp_str=params.current_timestamp
            )

            if context_layers:
                system_prompt = build_system_prompt(context_layers)
                episode_title = context_layers.episode.title
                guest_name = context_layers.episode.guest
            else:
                # Fallback if episode not found
                episode_title = f"Episode {params.episode_id}"
                guest_name = "Unknown Guest"
        else:
            # Legacy mode - simple context
            episodes = _load_episodes()
            episode = next((e for e in episodes if e.get("id") == params.episode_id), None)
            if episode:
                episode_title = episode.get("title", f"Episode {params.episode_id}")
                guest_name = episode.get("guest", "Unknown Guest")
            else:
                episode_title = f"Episode {params.episode_id}"
                guest_name = "Unknown Guest"

        # Step 2: Load claim context if provided (additional focused context)
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
## Currently Selected Claim
"{distilled or claim_text}"
"""
                except (ValueError, IndexError):
                    pass

        # Step 3: RAG search using the user's message
        vs = get_vectorstore()

        # Build search query - combine message with claim context for better results
        search_query = params.message
        if claim_context:
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
                "page": meta.get("page", ""),
                "year": meta.get("year", ""),
            })

        # Step 4: Build the final prompt
        if params.use_layered_context and system_prompt:
            # New layered context mode
            formatted_history = _format_conversation_history(params.conversation_history)
            formatted_rag = _format_rag_results_for_chat(rag_results, _load_papers_collection())

            prompt = f"""{system_prompt}

{claim_context}

## Retrieved Research Papers (from RAG search)
{formatted_rag}

## Conversation History
{formatted_history}

## User's Question
{params.message}

## Your Response
Provide a helpful, accurate response based on the context above. Reference specific papers and timestamps when relevant.
"""
        else:
            # Legacy mode - use old template
            formatted_history = _format_conversation_history(params.conversation_history)
            formatted_rag = _format_rag_results_for_chat(rag_results, _load_papers_collection())

            prompt = CHAT_CONTEXT_PROMPT_TEMPLATE.format(
                episode_title=episode_title,
                guest_name=guest_name,
                claim_context=claim_context if claim_context else "(No specific claim selected)",
                conversation_history=formatted_history,
                rag_results=formatted_rag,
                user_message=params.message,
            )

        # Step 5: Call Gemini
        _ensure_gemini_client_ready()

        # Build generation config with optional thinking
        from google.genai import types

        # Use proper GenerateContentConfig class (not dict) for thinking to work
        if params.include_thinking:
            generation_config = types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=2048,
                thinking_config=types.ThinkingConfig(
                    include_thoughts=True,
                    thinking_level="HIGH"
                )
            )
        else:
            generation_config = types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=2048,
            )

        # Extract response text and thinking traces
        response_text = ""
        thinking_text = ""

        # Use streaming mode when thinking is requested (required for thought summaries)
        if params.include_thinking:
            def _stream_with_thinking():
                """Stream response and collect thinking parts."""
                thinking_parts = []
                response_parts = []

                response_stream = _get_genai_client().models.generate_content_stream(
                    model=GEMINI_MODEL,
                    contents=prompt,
                    config=generation_config
                )

                for chunk in response_stream:
                    if hasattr(chunk, "candidates") and chunk.candidates:
                        for candidate in chunk.candidates:
                            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                                for part in candidate.content.parts:
                                    thought = getattr(part, "thought", None)
                                    text = getattr(part, "text", "")
                                    if thought is True and text:
                                        thinking_parts.append(text)
                                    elif text:
                                        response_parts.append(text)

                return "".join(thinking_parts), "".join(response_parts)

            thinking_text, response_text = await asyncio.to_thread(_stream_with_thinking)

        else:
            # Non-streaming mode (faster when thinking not needed)
            response = await asyncio.to_thread(
                lambda: _get_genai_client().models.generate_content(
                    model=GEMINI_MODEL,
                    contents=prompt,
                    config=generation_config
                )
            )

            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            response_text += part.text

        # Fallback if no response text found
        if not response_text:
            response_text = "I apologize, but I couldn't generate a response."

        # Step 6: Build sources list (include both RAG results and evidence cards)
        sources = []

        # Add RAG results as sources
        for r in rag_results:
            if r.get("paper_id"):
                sources.append({
                    "paper_id": r.get("paper_id", ""),
                    "paper_title": r.get("paper_title", ""),
                    "year": r.get("year", ""),
                    "section": r.get("section", ""),
                    "page": r.get("page", ""),
                    "relevance_snippet": r.get("text", "")[:200] + "..." if r.get("text") else "",
                    "source_type": "rag",
                })

        # Add evidence cards as sources (if using layered context)
        if context_layers and context_layers.evidence_cards.cards:
            for card in context_layers.evidence_cards.cards[:3]:  # Top 3 evidence cards
                sources.append({
                    "paper_id": card.paper_id,
                    "paper_title": card.paper_title,
                    "year": "",
                    "section": card.section,
                    "relevance_snippet": card.claim_text[:200] + "..." if len(card.claim_text) > 200 else card.claim_text,
                    "source_type": "evidence_card",
                    "card_id": card.card_id,
                    "timestamp": card.timestamp_str,
                })

        # Build response metadata
        response_data = {
            "response": response_text.strip(),
            "sources": sources,
            "query_used": search_query,
            "model": GEMINI_MODEL,
        }

        # Add thinking traces if present
        if thinking_text.strip():
            response_data["thinking"] = thinking_text.strip()

        # Add context metadata if using layered context
        if context_layers:
            response_data["context_metadata"] = {
                "episode_id": context_layers.episode.episode_id,
                "current_timestamp": params.current_timestamp,
                "temporal_window": {
                    "start": context_layers.temporal_window.window_start_str if context_layers.temporal_window else None,
                    "end": context_layers.temporal_window.window_end_str if context_layers.temporal_window else None,
                },
                "evidence_cards_count": len(context_layers.evidence_cards.cards),
            }

        return response_data

    except Exception as e:
        import traceback
        return {
            "error": f"Error in chat: {str(e)}",
            "traceback": traceback.format_exc(),
            "response": "",
            "sources": [],
        }
