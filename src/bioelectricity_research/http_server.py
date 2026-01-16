"""Simple HTTP server to expose MCP tools as REST endpoints."""

from dotenv import load_dotenv
load_dotenv()

import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
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


@app.get("/health")
async def health_check():
    """Health check endpoint for Railway."""
    return {"status": "healthy"}


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
            _parse_paper_key_findings,
            _extract_summary_without_findings,
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
                    "papers": cache[cache_key].get("papers", []),
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
        raw_summary = await asyncio.to_thread(
            _call_gemini_for_deep_dive,
            prompt,
            GEMINI_MODEL_DEFAULT,
        )

        # Step 7: Parse key findings and clean summary
        num_papers = min(len(rag_results), 7)
        key_findings = _parse_paper_key_findings(raw_summary, num_papers)
        clean_summary = _extract_summary_without_findings(raw_summary)

        # Build papers list with key_finding
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
            "claim_id": claim_id,
            "summary": clean_summary,
            "cached": False,
            "generated_at": cache[cache_key]["generated_at"],
            "rag_query": research_query,
            "papers_retrieved": len(rag_results),
            "papers": papers_list,
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


@app.post("/tools/get_paper/execute")
async def http_get_paper(request: Request):
    """Get paper data by paper ID."""
    try:
        body = await request.json()
        paper_id = body.get("paper_id")

        if not paper_id:
            return JSONResponse({"error": "paper_id is required"}, status_code=400)

        # Import helper function
        from .server import _load_papers_collection

        # Load papers collection
        papers_collection = _load_papers_collection()

        # Get paper by ID
        paper_data = papers_collection.get(paper_id)

        if not paper_data:
            return JSONResponse({
                "error": f"Paper not found: {paper_id}"
            }, status_code=404)

        metadata = paper_data.get("metadata", {})
        content = paper_data.get("content", {})
        sections = paper_data.get("sections", {})

        # Format authors
        authors = metadata.get("authors", [])
        formatted_authors = []
        for author in authors:
            if isinstance(author, dict):
                formatted_authors.append(author.get("name", "Unknown"))
            else:
                formatted_authors.append(str(author))

        # Build external link (prefer DOI, fallback to arxiv)
        external_url = None
        if metadata.get("doi"):
            external_url = f"https://doi.org/{metadata['doi']}"
        elif metadata.get("arxiv"):
            external_url = f"https://arxiv.org/abs/{metadata['arxiv']}"

        return {
            "paper_id": paper_id,
            "title": metadata.get("title", "Unknown Title"),
            "authors": formatted_authors,
            "year": metadata.get("year", ""),
            "venue": metadata.get("venue", ""),
            "journal": metadata.get("journal", ""),
            "citation_count": metadata.get("citationCount", 0),
            "doi": metadata.get("doi", ""),
            "arxiv": metadata.get("arxiv", ""),
            "external_url": external_url,
            "abstract": content.get("abstract", metadata.get("abstract", "")),
            "full_text": content.get("full_text", ""),
            "full_text_available": content.get("full_text_available", False),
            "source": content.get("source", ""),
            "sections": {
                "introduction": sections.get("introduction", ""),
                "methods": sections.get("methods", ""),
                "results": sections.get("results", ""),
                "discussion": sections.get("discussion", ""),
                "conclusion": sections.get("conclusion", ""),
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/get_relevant_kg_subgraph/execute")
async def http_get_relevant_kg_subgraph(request: Request):
    """Get a relevant subgraph from the knowledge graph for a given claim."""
    try:
        body = await request.json()
        claim_id = body.get("claim_id")
        claim_text = body.get("claim_text")
        episode_id = body.get("episode_id", "lex_325")
        max_hops = body.get("max_hops", 1)
        use_gemini_extraction = body.get("use_gemini_extraction", False)

        # Import helper functions
        from .server import (
            _load_claims_cache,
            _load_knowledge_graph,
            _load_claim_relevance_cache,
            _find_matching_entities,
            _extract_subgraph,
            _extract_entities_with_gemini,
        )

        # Step 1: Get claim text
        if not claim_text and claim_id:
            # Load from claims cache
            claims_cache = _load_claims_cache()

            parts = claim_id.rsplit("-", 1)
            if len(parts) != 2:
                return {"error": f"Invalid claim_id format: {claim_id}"}

            segment_key = parts[0]
            try:
                claim_index = int(parts[1])
            except ValueError:
                return {"error": f"Invalid claim index in claim_id: {claim_id}"}

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
        if use_gemini_extraction:
            # Use Gemini to extract entity names, then match to KG
            import asyncio
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
            max_hops=max_hops
        )

        # Step 5: Format response
        # Mark which nodes were direct matches vs expanded
        for node in subgraph["nodes"]:
            node["is_direct_match"] = node["id"] in matched_ids

        # Step 6: Inject pre-computed claim-entity relevance
        if claim_id:
            relevance_cache = _load_claim_relevance_cache()
            claim_relevance = relevance_cache.get("claims", {}).get(claim_id, {}).get("entities", {})

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
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/chat_with_context/execute")
async def http_chat_with_context(request: Request):
    """Chat with context - answer questions using RAG + Gemini.

    Uses the layered context builder for episode-level narrative awareness.
    """
    try:
        import asyncio

        body = await request.json()
        message = body.get("message")
        episode_id = body.get("episode_id", "lex_325")
        claim_id = body.get("claim_id")
        conversation_history = body.get("conversation_history", [])
        n_results = body.get("n_results", 5)
        current_timestamp = body.get("current_timestamp")
        use_layered_context = body.get("use_layered_context", True)
        include_thinking = body.get("include_thinking", True)

        if not message:
            return JSONResponse({"error": "message is required"}, status_code=400)

        # Import helper functions
        from .server import (
            _load_claims_cache,
            _load_papers_collection,
            _format_conversation_history,
            _format_rag_results_for_chat,
            _ensure_gemini_client_ready,
            get_vectorstore,
            CHAT_CONTEXT_PROMPT_TEMPLATE,
            GEMINI_MODEL_DEFAULT,
        )
        from .context_builder import build_chat_context, build_system_prompt

        # Step 1: Build layered context (includes episode summary, temporal window, etc.)
        system_prompt = ""
        episode_title = f"Episode {episode_id}"
        guest_name = "Unknown Guest"

        if use_layered_context:
            context_layers = build_chat_context(
                episode_id=episode_id,
                current_timestamp_str=current_timestamp
            )
            if context_layers:
                system_prompt = build_system_prompt(context_layers)
                episode_title = context_layers.episode.title
                guest_name = context_layers.episode.guest

        # Step 2: Load claim context if provided
        claim_context = ""
        if claim_id and "-" in claim_id:
            claims_cache = _load_claims_cache()
            parts = claim_id.rsplit("-", 1)
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

        # Build search query
        search_query = message
        if claim_context:
            search_query = f"{message} bioelectricity Levin"

        rag_results_raw = vs.search(search_query, n_results=n_results)

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

        # Step 5: Format prompt with layered context
        formatted_history = _format_conversation_history(conversation_history)
        formatted_rag = _format_rag_results_for_chat(rag_results, papers_collection)

        if system_prompt:
            # Use layered context mode with episode summary
            prompt = f"""{system_prompt}

{claim_context}

## Retrieved Research Papers (from RAG search)
{formatted_rag}

## Conversation History
{formatted_history}

## User's Question
{message}

## Your Response
Provide a helpful, accurate response based on the context above. Reference specific papers and timestamps when relevant.
"""
        else:
            # Fallback to legacy template
            prompt = CHAT_CONTEXT_PROMPT_TEMPLATE.format(
                episode_title=episode_title,
                guest_name=guest_name,
                claim_context=claim_context if claim_context else "(No specific claim selected)",
                conversation_history=formatted_history,
                rag_results=formatted_rag,
                user_message=message,
            )

        # Step 6: Call Gemini
        _ensure_gemini_client_ready()

        # Build generation config with optional thinking
        from google.genai import types

        # Use proper GenerateContentConfig class (not dict) for thinking to work
        if include_thinking:
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
        if include_thinking:
            def _stream_with_thinking():
                """Stream response and collect thinking parts."""
                thinking_parts = []
                response_parts = []

                response_stream = server._GENAI_CLIENT.models.generate_content_stream(
                    model=GEMINI_MODEL_DEFAULT,
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
                lambda: server._GENAI_CLIENT.models.generate_content(
                    model=GEMINI_MODEL_DEFAULT,
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

        result = {
            "response": response_text.strip(),
            "sources": sources,
            "query_used": search_query,
            "model": GEMINI_MODEL_DEFAULT,
        }

        # Add thinking traces if present
        if thinking_text.strip():
            result["thinking"] = thinking_text.strip()

        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/chat_with_context/stream")
async def http_chat_with_context_stream(request: Request):
    """Stream chat response with real-time thinking traces via SSE.

    Returns Server-Sent Events with the following event types:
    - thinking: Reasoning/thinking chunks as they arrive
    - content: Response content chunks as they arrive
    - sources: Final sources list when complete
    - done: Completion signal with metadata
    - error: Error message if something goes wrong
    """
    import json

    body = await request.json()
    message = body.get("message")
    episode_id = body.get("episode_id", "lex_325")
    claim_id = body.get("claim_id")
    conversation_history = body.get("conversation_history", [])
    n_results = body.get("n_results", 5)
    current_timestamp = body.get("current_timestamp")
    use_layered_context = body.get("use_layered_context", True)
    include_thinking = body.get("include_thinking", True)

    async def generate_sse():
        """Generator that yields SSE events."""
        try:
            if not message:
                yield f"event: error\ndata: {json.dumps({'error': 'message is required'})}\n\n"
                return

            # Import helper functions
            from .server import (
                _load_claims_cache,
                _load_papers_collection,
                _format_conversation_history,
                _format_rag_results_for_chat,
                _ensure_gemini_client_ready,
                get_vectorstore,
                CHAT_CONTEXT_PROMPT_TEMPLATE,
                GEMINI_MODEL_DEFAULT,
            )
            from .context_builder import build_chat_context, build_system_prompt
            from google.genai import types

            # Step 1: Build layered context
            system_prompt = ""
            episode_title = f"Episode {episode_id}"
            guest_name = "Unknown Guest"

            if use_layered_context:
                context_layers = build_chat_context(
                    episode_id=episode_id,
                    current_timestamp_str=current_timestamp
                )
                if context_layers:
                    system_prompt = build_system_prompt(context_layers)
                    episode_title = context_layers.episode.title
                    guest_name = context_layers.episode.guest

            # Step 2: Load claim context if provided
            claim_context = ""
            if claim_id and "-" in claim_id:
                claims_cache = _load_claims_cache()
                parts = claim_id.rsplit("-", 1)
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

            # Step 3: RAG search
            vs = get_vectorstore()
            search_query = message
            if claim_context:
                search_query = f"{message} bioelectricity Levin"

            rag_results_raw = vs.search(search_query, n_results=n_results)
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
            formatted_rag = _format_rag_results_for_chat(rag_results, papers_collection)

            # Step 5: Build prompt
            formatted_history = _format_conversation_history(conversation_history)
            prompt = CHAT_CONTEXT_PROMPT_TEMPLATE.format(
                episode_title=episode_title,
                guest_name=guest_name,
                claim_context=claim_context if claim_context else "(No specific claim selected)",
                conversation_history=formatted_history,
                rag_results=formatted_rag,
                user_message=message,
            )

            # Step 6: Call Gemini with streaming
            _ensure_gemini_client_ready()

            if include_thinking:
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

            # Use a queue to bridge sync Gemini streaming with async SSE
            import queue
            import threading

            chunk_queue: queue.Queue = queue.Queue()
            thinking_chunks = []
            response_chunks = []

            def stream_gemini():
                """Run Gemini streaming in a thread and put chunks in queue."""
                try:
                    response_stream = server._GENAI_CLIENT.models.generate_content_stream(
                        model=GEMINI_MODEL_DEFAULT,
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
                                            chunk_queue.put(("thinking", text))
                                        elif text:
                                            chunk_queue.put(("content", text))
                    chunk_queue.put(("done", None))
                except Exception as e:
                    chunk_queue.put(("error", str(e)))

            # Start Gemini streaming in background thread
            thread = threading.Thread(target=stream_gemini)
            thread.start()

            # Yield SSE events as chunks arrive
            while True:
                try:
                    # Use timeout to allow event loop to process
                    event_type, text = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: chunk_queue.get(timeout=0.1)
                    )

                    if event_type == "done":
                        break
                    elif event_type == "error":
                        yield f"event: error\ndata: {json.dumps({'error': text})}\n\n"
                        thread.join()
                        return
                    elif event_type == "thinking":
                        thinking_chunks.append(text)
                        yield f"event: thinking\ndata: {json.dumps({'text': text})}\n\n"
                    elif event_type == "content":
                        response_chunks.append(text)
                        yield f"event: content\ndata: {json.dumps({'text': text})}\n\n"

                except queue.Empty:
                    # Queue empty, yield control and continue waiting
                    await asyncio.sleep(0.01)
                    continue

            thread.join()

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

            # Send sources
            yield f"event: sources\ndata: {json.dumps({'sources': sources})}\n\n"

            # Send done event with metadata
            done_data = {
                "query_used": search_query,
                "model": GEMINI_MODEL_DEFAULT,
                "thinking_complete": "".join(thinking_chunks),
                "response_complete": "".join(response_chunks),
            }
            yield f"event: done\ndata: {json.dumps(done_data)}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@app.post("/tools/generate_image_with_context/execute")
async def http_generate_image_with_context(request: Request):
    """Generate an AI image based on podcast context using Gemini.

    Uses Gemini 3 Pro Image model to create scientific visualizations (diagrams,
    illustrations) based on the current podcast context. Images are stored in
    Supabase Storage and returned as URLs.
    """
    try:
        body = await request.json()
        prompt = body.get("prompt")
        episode_id = body.get("episode_id", "lex_325")
        claim_id = body.get("claim_id")
        current_timestamp = body.get("current_timestamp")
        image_style = body.get("image_style", "auto")

        if not prompt:
            return JSONResponse({"error": "prompt is required"}, status_code=400)

        from .server import _generate_image_impl

        result = await _generate_image_impl(
            prompt=prompt,
            episode_id=episode_id,
            claim_id=claim_id,
            current_timestamp=current_timestamp,
            image_style=image_style,
        )
        return JSONResponse(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/generate_mini_podcast/execute")
async def http_generate_mini_podcast(request: Request):
    """Generate a mini podcast discussing a scientific claim.

    Creates a NotebookLM-style two-host dialogue using:
    - Gemini 3 for script generation
    - Gemini 2.5 TTS for multi-speaker audio synthesis

    Audio is stored in Supabase Storage and returned as a public URL.
    """
    try:
        body = await request.json()
        claim_id = body.get("claim_id")
        episode_id = body.get("episode_id", "lex_325")
        force_regenerate = body.get("force_regenerate", False)
        style = body.get("style", "casual")

        if not claim_id:
            return JSONResponse({"error": "claim_id is required"}, status_code=400)

        from .server import _generate_mini_podcast_impl

        result = await _generate_mini_podcast_impl(
            claim_id=claim_id,
            episode_id=episode_id,
            force_regenerate=force_regenerate,
            style=style,
        )
        return JSONResponse(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/text_to_speech/execute")
async def http_text_to_speech(request: Request):
    """Convert text to speech using Gemini TTS.

    Uses Gemini 2.5 TTS to generate natural-sounding audio from text.
    Audio is stored in Supabase Storage and returned as a signed URL.

    Use this to provide audio playback of AI chat responses.
    """
    try:
        body = await request.json()
        text = body.get("text")
        voice = body.get("voice", "Zephyr")

        if not text:
            return JSONResponse({"error": "text is required"}, status_code=400)

        from .server import _text_to_speech_impl

        result = await _text_to_speech_impl(
            text=text,
            voice=voice,
        )
        return JSONResponse(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/get_episode_summary/execute")
async def http_get_episode_summary(request: Request):
    """Get or generate an episode summary using Gemini.

    Returns cached summary if available, otherwise generates one on-demand.
    """
    import json
    from pathlib import Path

    try:
        body = await request.json()
        episode_id = body.get("episode_id")

        if not episode_id:
            return JSONResponse({"error": "episode_id is required"}, status_code=400)

        # Check for cached summary
        summaries_file = Path(__file__).parent.parent.parent / "data" / "episode_summaries.json"

        if summaries_file.exists():
            with open(summaries_file, "r") as f:
                summaries = json.load(f)

            if episode_id in summaries:
                return {
                    "summary": summaries[episode_id],
                    "cached": True,
                    "episode_id": episode_id
                }

        # No cached summary - generate one with Gemini
        from .server import (
            _ensure_gemini_client_ready,
            GEMINI_MODEL_DEFAULT,
        )

        # Load episode metadata
        episodes_file = Path(__file__).parent.parent.parent / "data" / "episodes.json"
        episode_data = None

        if episodes_file.exists():
            with open(episodes_file, "r") as f:
                episodes = json.load(f)
                episode_data = next((e for e in episodes if e.get("id") == episode_id), None)

        if not episode_data:
            return JSONResponse({"error": f"Episode not found: {episode_id}"}, status_code=404)

        # Load transcript if available
        transcript_text = ""
        transcript_file = Path(__file__).parent.parent.parent / "data" / "transcripts" / f"{episode_id}.txt"

        if transcript_file.exists():
            with open(transcript_file, "r") as f:
                transcript_text = f.read()[:400000]  # Limit to ~400k chars for context window

        # Build prompt for Gemini
        summary_prompt = f"""You are analyzing a podcast episode to create a rich narrative summary for a research companion app.

The app helps users explore bioelectricity research while listening to podcasts. Users need to understand:
1. What this episode is about (narrative arc)
2. How themes evolve through the conversation
3. Key moments worth referencing
4. The guest's main arguments and thesis

===EPISODE METADATA===
Podcast: {episode_data.get('podcast', 'Unknown')}
Title: {episode_data.get('title', 'Unknown')}
Guest: {episode_data.get('guest', 'Unknown')}
Host: {episode_data.get('host', 'Unknown')}
Duration: {episode_data.get('duration', 'Unknown')}
Date: {episode_data.get('date', 'Unknown')}

{"===TRANSCRIPT EXCERPT===" + chr(10) + transcript_text[:100000] if transcript_text else "===DESCRIPTION===" + chr(10) + episode_data.get('description', 'No description available')}

===YOUR TASK===

Generate a structured summary with the following sections. Return ONLY valid JSON, no markdown code blocks.

{{
  "narrative_arc": "3-5 paragraphs describing the conversation arc, how it opens, major transitions, intellectual journey, and conclusion",
  "major_themes": [
    {{
      "theme_name": "Short name (2-4 words)",
      "description": "What this theme is about (1-2 sentences)",
      "evolution": "How this theme develops through the episode",
      "timestamps": "Approximate time ranges (e.g., '10:00-25:00, 1:45:00-2:00:00')"
    }}
  ],
  "key_moments": [
    {{
      "timestamp": "Approximate timestamp (e.g., '23:45')",
      "description": "What happens at this moment (1-2 sentences)",
      "significance": "Why this moment matters",
      "quote": "A brief representative quote if applicable"
    }}
  ],
  "guest_thesis": {{
    "core_thesis": "The central argument or perspective (2-3 sentences)",
    "key_claims": ["Major claim 1", "Major claim 2", "Major claim 3"],
    "argumentation_style": "How the guest builds their case",
    "intellectual_influences": "Referenced thinkers, fields, or frameworks"
  }},
  "conversation_dynamics": {{
    "host_approach": "How the host engages with the material",
    "memorable_exchanges": "1-2 notable back-and-forth moments",
    "tone": "Overall tone of the conversation"
  }}
}}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation text."""

        # Call Gemini
        import asyncio

        _ensure_gemini_client_ready()
        response = await asyncio.to_thread(
            lambda: server._GENAI_CLIENT.models.generate_content(
                model="gemini-2.0-flash",  # Use flash for cost efficiency on long content
                contents=summary_prompt,
                config={
                    "temperature": 0.3,
                    "max_output_tokens": 8000,
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
                return JSONResponse({"error": "Failed to generate summary"}, status_code=500)
        else:
            return JSONResponse({"error": "Failed to generate summary"}, status_code=500)

        # Parse JSON response
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        try:
            summary_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            return JSONResponse({
                "error": f"Failed to parse summary JSON: {e}",
                "raw_response": response_text[:500]
            }, status_code=500)

        # Add episode_id to summary
        summary_data["episode_id"] = episode_id

        # Cache the summary
        try:
            existing_summaries = {}
            if summaries_file.exists():
                with open(summaries_file, "r") as f:
                    existing_summaries = json.load(f)

            existing_summaries[episode_id] = summary_data

            with open(summaries_file, "w") as f:
                json.dump(existing_summaries, f, indent=2)

            print(f"[Summary] Cached new summary for {episode_id}")
        except Exception as cache_error:
            print(f"[Summary] Warning: Failed to cache summary: {cache_error}")

        return {
            "summary": summary_data,
            "cached": False,
            "episode_id": episode_id
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tools/generate_notebook_synthesis/execute")
async def http_generate_notebook_synthesis(request: Request):
    """Generate AI synthesis for a user's notebook (saved items for an episode).

    Takes a list of bookmarks and generates an insight about themes and patterns.
    Results are cached in the frontend (Supabase notebook_synthesis table).
    """
    import asyncio
    import json

    try:
        body = await request.json()
        episode_id = body.get("episode_id")
        bookmarks = body.get("bookmarks", [])
        force_regenerate = body.get("force_regenerate", False)

        if not episode_id:
            return JSONResponse({"error": "episode_id is required"}, status_code=400)

        if not bookmarks or len(bookmarks) == 0:
            return JSONResponse({"error": "No bookmarks to synthesize"}, status_code=400)

        # Import helper functions
        from .server import (
            _ensure_gemini_client_ready,
            GEMINI_MODEL_DEFAULT,
        )

        # Load episode metadata for context
        from pathlib import Path
        episodes_file = Path(__file__).parent.parent.parent / "data" / "episodes.json"
        episode_meta = {}
        if episodes_file.exists():
            with open(episodes_file, "r") as f:
                episodes = json.load(f)
                episode_meta = next((ep for ep in episodes if ep.get("id") == episode_id), {})

        # Format bookmarks for the prompt
        formatted_items = []
        for i, b in enumerate(bookmarks[:20], 1):  # Limit to 20 items for token budget
            item_type = b.get("type", "item")
            title = b.get("title", "")
            content = b.get("content", "")[:300]  # Truncate long content
            timestamp = b.get("timestamp")

            if timestamp:
                mins = timestamp // 60000
                secs = (timestamp // 1000) % 60
                time_str = f" [{mins}:{secs:02d}]"
            else:
                time_str = ""

            formatted_items.append(f"{i}. [{item_type.upper()}]{time_str} {title}\n   {content}")

        items_text = "\n\n".join(formatted_items)

        # Build synthesis prompt
        prompt = f"""You are analyzing a user's saved research items from a podcast episode about bioelectricity and morphogenesis.

## Episode Context
Title: {episode_meta.get('title', episode_id)}
Guest: {episode_meta.get('guest', 'Unknown')}
Podcast: {episode_meta.get('podcast', 'Unknown')}

## User's Saved Items ({len(bookmarks)} total)
{items_text}

## Your Task
Analyze the user's saved items and provide:
1. A concise synthesis (150-250 words) that identifies major themes, how items relate to each other, and what patterns emerge from their research interests
2. 2-4 key themes as short labels with brief descriptions

Focus on:
- What topics the user seems most interested in
- How different saved items connect conceptually
- What deeper questions their collection suggests
- Actionable next steps for their research

Return your response as valid JSON with this structure:
{{
  "synthesis": "Your 150-250 word synthesis here...",
  "themes": [
    {{"name": "Theme 1", "description": "Brief description"}},
    {{"name": "Theme 2", "description": "Brief description"}}
  ]
}}

Respond ONLY with the JSON object, no markdown formatting or additional text."""

        # Call Gemini
        _ensure_gemini_client_ready()
        response = await asyncio.to_thread(
            lambda: server._GENAI_CLIENT.models.generate_content(
                model=GEMINI_MODEL_DEFAULT,
                contents=prompt,
                config={
                    "temperature": 0.7,
                    "max_output_tokens": 1024,
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
                return JSONResponse({"error": "Failed to generate synthesis"}, status_code=500)
        else:
            return JSONResponse({"error": "Failed to generate synthesis"}, status_code=500)

        # Parse JSON response
        try:
            # Clean up response (remove markdown code blocks if present)
            cleaned_response = response_text.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()

            result = json.loads(cleaned_response)

            return {
                "synthesis": result.get("synthesis", ""),
                "themes": result.get("themes", []),
                "model": GEMINI_MODEL_DEFAULT,
            }
        except json.JSONDecodeError:
            # Fallback: return raw text as synthesis
            return {
                "synthesis": response_text.strip(),
                "themes": [],
                "model": GEMINI_MODEL_DEFAULT,
            }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


def run_server(host=None, port=None):
    """Run the HTTP server.

    Host and port can be overridden via environment variables:
    - HOST: Default "0.0.0.0" for production, "127.0.0.1" for local
    - PORT: Default 8000
    """
    import os

    if host is None:
        host = os.getenv("HOST", "0.0.0.0")
    if port is None:
        port = int(os.getenv("PORT", "8000"))

    print(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    run_server()

