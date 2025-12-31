"""Simple HTTP server to expose MCP tools as REST endpoints."""

import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import the server module to access tool functions
from . import server

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/tools/list_episodes/execute")
async def http_list_episodes(request: Request):
    """List available episodes."""
    try:
        # Call the function directly from the module
        print(f"[DEBUG] Episodes file path: {server.EPISODES_FILE_PATH}")
        print(f"[DEBUG] File exists: {server.EPISODES_FILE_PATH.exists()}")
        result = server.load_episode_catalog()
        print(f"[DEBUG] Loaded {len(result)} episodes")
        # Convert Pydantic models to dicts
        return [episode.model_dump() if hasattr(episode, 'model_dump') else episode.__dict__ for episode in result]
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/tools/get_episode_claims/execute")
async def http_get_episode_claims(request: Request):
    """Get claims for an episode."""
    try:
        body = await request.json()
        episode_id = body.get("episode_id")
        limit = body.get("limit", 30)
        
        # Access the claims cache directly
        cache = server._load_claims_cache()
        segments = cache.get("segments", {})
        parsed_segments = []

        for segment_key, segment_data in segments.items():
            if not segment_key.startswith(f"{episode_id}|"):
                continue
            timestamp = server._parse_timestamp_seconds(segment_data.get("timestamp", ""))
            parsed_segments.append((timestamp, segment_key, segment_data))

        parsed_segments.sort(key=lambda item: item[0])
        claims = []

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

                claims.append(
                    {
                        "id": claim_id,
                        "timestamp": timestamp_seconds,
                        "category": category,
                        "title": title,
                        "description": description,
                        "source": source,
                        "status": "past",
                    }
                )

            if len(claims) >= limit:
                break

        return claims
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/tools/get_claim_context/execute")
async def http_get_claim_context(request: Request):
    """Get enriched context for a specific claim."""
    try:
        body = await request.json()
        claim_id = body.get("claim_id")
        episode_id = body.get("episode_id", "lex_325")
        include_related_concepts = body.get("include_related_concepts", True)
        related_concepts_limit = body.get("related_concepts_limit", 5)
        
        # Import helper functions
        from .server import (
            _load_claims_cache, 
            _load_context_card_registry, 
            _load_papers_collection,
            get_vectorstore
        )
        
        # Load claims cache
        claims_cache = _load_claims_cache()
        
        # Parse claim_id to get segment_key and claim_index
        parts = claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return JSONResponse({
                "error": f"Invalid claim_id format: {claim_id}. Expected format: segment_key-index"
            }, status_code=400)
        
        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return JSONResponse({
                "error": f"Invalid claim index in claim_id: {claim_id}"
            }, status_code=400)
        
        # Get segment data
        segments = claims_cache.get("segments", {})
        segment_data = segments.get(segment_key)
        
        if not segment_data:
            return JSONResponse({
                "error": f"Segment not found: {segment_key}"
            }, status_code=404)
        
        # Get specific claim
        claims_list = segment_data.get("claims", [])
        if claim_index >= len(claims_list):
            return JSONResponse({
                "error": f"Claim index {claim_index} out of range for segment {segment_key}"
            }, status_code=404)
        
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
        if include_related_concepts and claim_data.get("claim_text"):
            try:
                vs = get_vectorstore()
                search_results = vs.search(
                    claim_data["claim_text"],
                    n_results=related_concepts_limit
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
            "claim_id": claim_id,
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
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)

def run_server(host="127.0.0.1", port=8000):
    """Run the HTTP server."""
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    run_server()

