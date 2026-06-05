"""Quiz question generation tool."""

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from ..config import GEMINI_MODEL
from ..mcp_app import mcp, _ensure_gemini_client_ready, _get_genai_client
from ..schemas.quiz import QuizQuestionsResponse

logger = logging.getLogger(__name__)

QUIZ_GENERATION_PROMPT = """You are a science education expert creating flashcard-style quiz questions for a research podcast listener.

Given the following bookmarked content from a science podcast research app, generate thoughtful questions that test understanding, not just recall.

## BOOKMARKED CONTENT
{bookmarks_text}

## YOUR TASK
Generate {total_questions} questions total. For each question:

1. Create a clear, specific question that tests understanding
2. Provide a concise but complete answer (2-3 sentences)
3. Classify the question type:
   - "recall": Direct factual recall (e.g., "What did X discover?")
   - "concept": Understanding of concepts/relationships (e.g., "How does X relate to Y?")
   - "application": Applying knowledge to new situations (e.g., "What would happen if...?")

## OUTPUT FORMAT
Return a JSON array with this exact structure:
[
  {{
    "bookmark_id": "the bookmark ID this question is based on",
    "question": "The question text",
    "answer": "The answer text (2-3 sentences)",
    "question_type": "recall|concept|application",
    "source_text": "The key text from the bookmark that contains the answer (brief excerpt)"
  }}
]

## GUIDELINES
- Focus on questions that require understanding, not just memorization
- Use clear, unambiguous phrasing
- Answers should explain the "why" not just the "what"
- For scientific claims, test understanding of mechanisms or implications
- Vary question types across recall, concept, and application

Return ONLY the JSON array, no preamble or explanation."""


class GenerateQuizQuestionsInput(BaseModel):
    bookmarks: list[dict] = Field(
        ...,
        description="List of bookmark objects with id, type, title, content fields"
    )
    questions_per_bookmark: int = Field(
        default=1,
        description="Number of questions to generate per bookmark"
    )


@mcp.tool()
async def generate_quiz_questions(params: GenerateQuizQuestionsInput) -> QuizQuestionsResponse:
    """
    Generate flashcard-style quiz questions from bookmarked content using Gemini.

    This tool takes a list of bookmarks (claims, papers, snippets) and generates
    educational questions to test understanding of the material.

    Returns:
        - questions: Array of generated questions with answers
        - total_generated: Number of questions created
        - bookmarks_processed: Number of bookmarks used
    """
    try:
        _ensure_gemini_client_ready()
    except RuntimeError as e:
        return {"error": str(e), "questions": []}

    bookmarks = params.bookmarks
    if not bookmarks:
        return {"error": "No bookmarks provided", "questions": []}

    # Format bookmarks for prompt
    bookmarks_text_parts = []
    for i, bm in enumerate(bookmarks, 1):
        content = (
            bm.get("content")
            or bm.get("claim_text")
            or bm.get("paper_abstract")
            or bm.get("title")
            or ""
        )
        bookmarks_text_parts.append(f"""
---
Bookmark {i} (ID: {bm.get('id', f'unknown_{i}')})
Type: {bm.get('type', 'unknown')}
Title: {bm.get('title', 'Untitled')}
Content: {content[:500]}
""")

    bookmarks_text = "\n".join(bookmarks_text_parts)
    total_questions = min(len(bookmarks) * params.questions_per_bookmark, 15)  # Cap at 15

    prompt = QUIZ_GENERATION_PROMPT.format(
        bookmarks_text=bookmarks_text,
        total_questions=total_questions
    )

    try:
        response = _get_genai_client().models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 4096,
            }
        )

        response_text = response.text.strip()

        # Parse JSON response - handle markdown code blocks
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        questions = json.loads(response_text.strip())

        return {
            "questions": questions,
            "total_generated": len(questions),
            "bookmarks_processed": len(bookmarks),
        }

    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse Gemini response as JSON: {str(e)}",
            "raw_response": response_text[:500] if 'response_text' in locals() else None,
            "questions": [],
        }
    except Exception as e:
        return {
            "error": f"Failed to generate questions: {str(e)}",
            "questions": [],
        }
