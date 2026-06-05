"""Text-to-speech tool."""

import logging
from typing import Any

from ..media_utils import TextToSpeechInput, _text_to_speech_impl
from ..mcp_app import mcp
from ..schemas.media import TTSResponse

logger = logging.getLogger(__name__)


@mcp.tool()
async def text_to_speech(params: TextToSpeechInput) -> TTSResponse:
    """
    Convert text to speech using Gemini TTS.

    Generates audio from the provided text using a natural-sounding voice.
    The audio is uploaded to Supabase Storage and a signed URL is returned.

    Use this to provide audio playback of AI chat responses.

    Returns:
        audio_url: Signed URL to the audio file (24h expiry)
        duration_seconds: Approximate duration of the audio
        voice: Voice used for synthesis
    """
    return await _text_to_speech_impl(
        text=params.text,
        voice=params.voice,
    )
