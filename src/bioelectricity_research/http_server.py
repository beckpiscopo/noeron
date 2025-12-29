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

def run_server(host="127.0.0.1", port=8000):
    """Run the HTTP server."""
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    run_server()

