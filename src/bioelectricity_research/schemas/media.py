from typing import Optional
from pydantic import BaseModel


class ImageResponse(BaseModel):
    image_url: Optional[str] = None
    caption: Optional[str] = None
    style_used: Optional[str] = None
    model: Optional[str] = None
    episode_id: Optional[str] = None
    timestamp: Optional[str] = None
    storage_path: Optional[str] = None
    error: Optional[str] = None
    traceback: Optional[str] = None


class PodcastResponse(BaseModel):
    podcast_url: Optional[str] = None
    script: Optional[str] = None
    duration_seconds: Optional[int] = None
    style: Optional[str] = None
    claim_id: Optional[str] = None
    episode_id: Optional[str] = None
    storage_path: Optional[str] = None
    generated_at: Optional[str] = None
    model_script: Optional[str] = None
    model_tts: Optional[str] = None
    cached: Optional[bool] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    traceback: Optional[str] = None


class TTSResponse(BaseModel):
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    voice: Optional[str] = None
    storage_path: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
