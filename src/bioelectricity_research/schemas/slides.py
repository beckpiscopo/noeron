from typing import Any, Optional
from pydantic import BaseModel


class SlideDeckResponse(BaseModel):
    pdf_url: Optional[str] = None
    thumbnail_urls: Optional[list[str]] = None
    slide_count: Optional[int] = None
    slide_specs: Optional[list[Any]] = None
    cached: Optional[bool] = None
    generated_at: Optional[str] = None
    generation_time_ms: Optional[int] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    traceback: Optional[str] = None


class CommunitySlideListResponse(BaseModel):
    slides: Optional[list[Any]] = None
    count: Optional[int] = None
    error: Optional[str] = None


class SlideShareUpdateResponse(BaseModel):
    success: Optional[bool] = None
    is_public: Optional[bool] = None
    message: Optional[str] = None
    error: Optional[str] = None


class UserSlideListResponse(BaseModel):
    slides: Optional[dict[str, Any]] = None
    styles_created: Optional[list[str]] = None
    error: Optional[str] = None
