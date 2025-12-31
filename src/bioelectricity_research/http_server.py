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


@app.post("/tools/generate_deep_dive_summary/execute")
async def http_generate_deep_dive_summary(request: Request):
    """Generate a deep dive summary for a scientific claim using RAG + Gemini."""
    try:
        import asyncio
        from datetime import datetime

        body = await request.json()
        claim_id = body.get("claim_id")
        episode_id = body.get("episode_id", "lex_325")
        n_results = body.get("n_results", 7)
        force_regenerate = body.get("force_regenerate", False)

        if not claim_id:
            return JSONResponse({"error": "claim_id is required"}, status_code=400)

        # Import helper functions directly
        from .server import (
            _load_claims_cache,
            _load_papers_collection,
            _load_deep_dive_cache,
            _save_deep_dive_cache,
            _build_research_query,
            _format_rag_results_for_prompt,
            _call_gemini_for_deep_dive,
            get_vectorstore,
            DEEP_DIVE_PROMPT_TEMPLATE,
            GEMINI_MODEL_DEFAULT,
        )

        # Check cache first (unless force_regenerate)
        cache_key = f"{episode_id}:{claim_id}"

        if not force_regenerate:
            cache = _load_deep_dive_cache()
            if cache_key in cache:
                return {
                    "claim_id": claim_id,
                    "summary": cache[cache_key]["summary"],
                    "cached": True,
                    "generated_at": cache[cache_key].get("generated_at", "unknown"),
                    "rag_query": cache[cache_key].get("rag_query", ""),
                    "papers_retrieved": cache[cache_key].get("papers_retrieved", 0),
                }

        # Step 1: Load claim from cache
        claims_cache = _load_claims_cache()

        # Parse claim_id
        parts = claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {"error": f"Invalid claim_id format: {claim_id}"}

        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {"error": f"Invalid claim index in claim_id: {claim_id}"}

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
        rag_results_raw = vs.search(research_query, n_results=n_results)

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

        prompt = DEEP_DIVE_PROMPT_TEMPLATE.format(
            claim_text=claim_data.get("claim_text", ""),
            speaker_stance=claim_data.get("speaker_stance", "assertion"),
            needs_backing=claim_data.get("needs_backing_because", "No specific reason provided"),
            evidence_summary=evidence_summary,
        )

        # Step 6: Call Gemini
        summary = await asyncio.to_thread(
            _call_gemini_for_deep_dive,
            prompt,
            GEMINI_MODEL_DEFAULT,
        )

        # Step 7: Cache the result
        cache = _load_deep_dive_cache()
        cache[cache_key] = {
            "summary": summary,
            "generated_at": datetime.utcnow().isoformat(),
            "rag_query": research_query,
            "papers_retrieved": len(rag_results),
            "claim_text": claim_data.get("claim_text", ""),
        }
        _save_deep_dive_cache(cache)

        # Return structured response
        return {
            "claim_id": claim_id,
            "summary": summary,
            "cached": False,
            "generated_at": cache[cache_key]["generated_at"],
            "rag_query": research_query,
            "papers_retrieved": len(rag_results),
            "papers": [
                {
                    "title": r.get("paper_title", ""),
                    "section": r.get("section", ""),
                    "year": r.get("year", ""),
                }
                for r in rag_results[:5]
            ],
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/generate_evidence_threads/execute")
async def http_generate_evidence_threads(request: Request):
    """Generate evidence threads for a scientific claim - coherent research narratives."""
    try:
        import asyncio
        from datetime import datetime

        body = await request.json()
        claim_id = body.get("claim_id")
        episode_id = body.get("episode_id", "lex_325")
        n_results = body.get("n_results", 10)
        force_regenerate = body.get("force_regenerate", False)

        if not claim_id:
            return JSONResponse({"error": "claim_id is required"}, status_code=400)

        # Import helper functions
        from .server import (
            _load_claims_cache,
            _load_papers_collection,
            _load_evidence_threads_cache,
            _save_evidence_threads_cache,
            _build_research_query,
            _should_generate_threads,
            _format_papers_for_thread_prompt,
            _validate_threads,
            _call_gemini_for_threads,
            get_vectorstore,
            EVIDENCE_THREAD_PROMPT,
            GEMINI_MODEL_DEFAULT,
        )

        # Check cache first (unless force_regenerate)
        cache_key = f"{episode_id}:{claim_id}"

        if not force_regenerate:
            cache = _load_evidence_threads_cache()
            if cache_key in cache:
                return {
                    "claim_id": claim_id,
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
        parts = claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {"error": f"Invalid claim_id format: {claim_id}"}

        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {"error": f"Invalid claim index in claim_id: {claim_id}"}

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
        rag_results_raw = vs.search(research_query, n_results=n_results)

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
                "claim_id": claim_id,
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
                "claim_id": claim_id,
                "threads": [],
                "error": gemini_result["error"],
                "papers_analyzed": len(rag_results),
            }

        raw_threads = gemini_result.get("threads", [])

        # Step 7: Validate threads
        validated_threads = _validate_threads(raw_threads, rag_results)

        # Step 8: Cache and return
        result = {
            "claim_id": claim_id,
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
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


def run_server(host="127.0.0.1", port=8000):
    """Run the HTTP server."""
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    run_server()

