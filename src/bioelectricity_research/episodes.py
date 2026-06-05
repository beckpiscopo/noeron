"""Episode catalog loading and timestamp parsing."""

import json
import logging
from typing import Optional

from pydantic import BaseModel

from .cache_store import EPISODES_FILE_PATH

logger = logging.getLogger(__name__)


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
        raw_episodes = json.loads(EPISODES_FILE_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse episodes catalog: {exc}") from exc

    episodes = []
    for entry in raw_episodes:
        try:
            episodes.append(EpisodeMetadata(**entry))
        except Exception:
            continue
    return episodes


def _load_episodes() -> list[dict]:
    if not EPISODES_FILE_PATH.exists():
        return []
    try:
        return json.loads(EPISODES_FILE_PATH.read_text())
    except json.JSONDecodeError:
        return []


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
