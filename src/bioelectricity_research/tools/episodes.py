"""Episode catalog and claims listing tools."""

import logging
from typing import Any, Sequence

from ..cache_store import _load_claims_cache
from ..episodes import EpisodeMetadata, load_episode_catalog, _parse_timestamp_seconds
from ..mcp_app import mcp
from ..schemas.episodes import EpisodeClaim

logger = logging.getLogger(__name__)


@mcp.tool()
async def list_episodes() -> Sequence[EpisodeMetadata]:
    """Return a catalog of curated episodes for the UI."""
    return load_episode_catalog()


@mcp.tool()
async def get_episode_claims(episode_id: str, limit: int = 30) -> list[EpisodeClaim]:
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

            timing_data = claim_data.get("timing", {})
            claim_timestamp = timestamp_seconds
            if timing_data:
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
