"""Chat conversation formatting helpers."""

import logging

logger = logging.getLogger(__name__)


def _format_conversation_history(history: list[dict]) -> str:
    """Format conversation history for the prompt (last 6 messages)."""
    if not history:
        return "(No previous messages)"

    recent = history[-6:] if len(history) > 6 else history
    return "\n".join(
        f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}"
        for msg in recent
    )
