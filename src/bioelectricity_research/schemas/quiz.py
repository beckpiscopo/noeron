from typing import Any, Optional
from pydantic import BaseModel


class QuizQuestionsResponse(BaseModel):
    questions: Optional[list[Any]] = None
    total_generated: Optional[int] = None
    bookmarks_processed: Optional[int] = None
    error: Optional[str] = None
    raw_response: Optional[str] = None
