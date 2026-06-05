"""Media generation helpers: image, mini podcast, and text-to-speech implementations."""

import asyncio
import base64
import io
import json
import logging
import traceback
import uuid
import wave
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .cache_store import _load_claims_cache, _load_podcast_cache, _save_podcast_cache
from .config import GEMINI_MODEL
from .episodes import _load_episodes
from .mcp_app import (
    _ensure_gemini_client_ready,
    _get_genai_client,
    _get_supabase_client,
    _request_gemini_key,
    NANO_BANANA_MODEL,
)

logger = logging.getLogger(__name__)


class GenerateImageInput(BaseModel):
    """Input for AI image generation based on podcast context."""
    prompt: str = Field(..., description="User's image generation request or description")
    episode_id: str = Field(..., description="The episode being listened to")
    claim_id: Optional[str] = Field(default=None, description="Optional current claim ID for focused context")
    current_timestamp: Optional[str] = Field(
        default=None,
        description="Current playback timestamp for temporal context"
    )
    image_style: Optional[str] = Field(
        default="auto",
        description="Style hint: 'diagram', 'illustration', 'schematic', or 'auto' (AI decides)"
    )


class GenerateMiniPodcastInput(BaseModel):
    """Input for AI mini podcast generation from claim context."""
    claim_id: str = Field(
        ...,
        description="The claim ID in format 'segment_key-index' (e.g., 'lex_325|00:00:00.160|1-0')"
    )
    episode_id: str = Field(..., description="The episode being explored")
    force_regenerate: bool = Field(
        default=False,
        description="If True, regenerate even if cached podcast exists"
    )
    style: Literal["casual", "academic"] = Field(
        default="casual",
        description="Conversation style: 'casual' for accessible, 'academic' for technical depth"
    )


class TextToSpeechInput(BaseModel):
    """Input for text-to-speech conversion."""
    text: str = Field(..., description="The text to convert to speech", min_length=1, max_length=5000)
    voice: str = Field(default="Zephyr", description="Voice name to use")


GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview"
GENERATED_IMAGES_BUCKET = "generated-images"

IMAGE_GENERATION_PROMPT_TEMPLATE = """You are creating a scientific visualization for a bioelectricity research podcast app.

## Context
Episode: {episode_title}
Guest: {guest_name}
Current Topic: {topic_context}

## User Request
"{user_prompt}"

## Guidelines
- Create a clear, educational visualization that explains scientific concepts
- Use accurate scientific representations
- Include relevant labels if creating a diagram
- Style: {style_hint}
- Make it visually appealing while maintaining scientific accuracy
- Focus on bioelectricity, cellular mechanisms, regeneration, or related topics

Generate an image that helps explain or illustrate the requested concept."""

async def _generate_image_impl(
    prompt: str,
    episode_id: str,
    claim_id: Optional[str] = None,
    current_timestamp: Optional[str] = None,
    image_style: Optional[str] = "auto",
) -> dict[str, Any]:
    """
    Core implementation for image generation. Called by both MCP tool and HTTP endpoint.
    """
    try:
        import base64
        import uuid
        from datetime import datetime

        # Import context builder
        from .context_builder import build_chat_context

        # Step 1: Build context from episode/timestamp
        context_layers = build_chat_context(
            episode_id=episode_id,
            current_timestamp_str=current_timestamp
        )

        if context_layers:
            episode_title = context_layers.episode.title
            guest_name = context_layers.episode.guest
            topic_context = context_layers.temporal_window.transcript_excerpt if context_layers.temporal_window else "Bioelectricity research discussion"
        else:
            # Fallback if episode not found
            episodes = _load_episodes()
            episode = next((e for e in episodes if e.get("id") == episode_id), None)
            if episode:
                episode_title = episode.get("title", f"Episode {episode_id}")
                guest_name = episode.get("guest", "Unknown Guest")
            else:
                episode_title = f"Episode {episode_id}"
                guest_name = "Unknown Guest"
            topic_context = "Bioelectricity research discussion"

        # Step 2: Determine visualization style
        style_hint = image_style
        if style_hint == "auto":
            prompt_lower = prompt.lower()
            if any(word in prompt_lower for word in ["diagram", "pathway", "mechanism", "flow", "process"]):
                style_hint = "scientific diagram with labeled components and clear arrows"
            elif any(word in prompt_lower for word in ["cell", "organism", "tissue", "anatomy"]):
                style_hint = "biological illustration with accurate anatomical detail"
            elif any(word in prompt_lower for word in ["graph", "chart", "data"]):
                style_hint = "scientific chart or graph visualization"
            else:
                style_hint = "educational scientific illustration suitable for learning"

        # Step 3: Build the generation prompt
        generation_prompt = IMAGE_GENERATION_PROMPT_TEMPLATE.format(
            episode_title=episode_title,
            guest_name=guest_name,
            topic_context=topic_context[:500] if topic_context else "General discussion",
            user_prompt=prompt,
            style_hint=style_hint,
        )

        # Step 4: Call Gemini with image modality
        _ensure_gemini_client_ready()

        response = await asyncio.to_thread(
            lambda: _get_genai_client().models.generate_content(
                model=GEMINI_IMAGE_MODEL,
                contents=generation_prompt,
                config={
                    "response_modalities": ["TEXT", "IMAGE"],
                }
            )
        )

        # Step 5: Extract image data from response
        image_data = None
        mime_type = "image/png"
        caption_text = ""

        # Debug: Log response structure
        logger.debug("[IMAGE GEN] Response type: {type(response)}")
        logger.debug("[IMAGE GEN] Has candidates: {hasattr(response, 'candidates')}")
        logger.debug("[IMAGE GEN] Has parts: {hasattr(response, 'parts')}")

        # Try the newer SDK approach (response.parts) first
        if hasattr(response, "parts"):
            for part in response.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    image_data = part.inline_data.data
                    if hasattr(part.inline_data, "mime_type") and part.inline_data.mime_type:
                        mime_type = part.inline_data.mime_type
                    logger.debug("[IMAGE GEN] Found image via response.parts, mime: {mime_type}")
                elif hasattr(part, "text") and part.text:
                    caption_text = part.text

        # Fallback to candidates approach
        if not image_data and hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                for part in candidate.content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        # This is the image
                        image_data = part.inline_data.data  # base64 encoded
                        if hasattr(part.inline_data, "mime_type") and part.inline_data.mime_type:
                            mime_type = part.inline_data.mime_type
                        logger.debug("[IMAGE GEN] Found image via candidates, mime: {mime_type}")
                    elif hasattr(part, "text") and part.text:
                        # This is descriptive text/caption
                        caption_text = part.text

        if not image_data:
            # Debug: Log what we got
            logger.debug("[IMAGE GEN] No image data found in response")
            if hasattr(response, 'text'):
                logger.debug("[IMAGE GEN] Response text: {response.text[:500] if response.text else 'None'}")
            return {
                "error": "Failed to generate image - no image data in response. Gemini may have returned text only.",
                "image_url": None,
                "caption": caption_text or None,
            }

        logger.debug("[IMAGE GEN] Image data length: {len(image_data) if image_data else 0}")
        logger.debug("[IMAGE GEN] Image data type: {type(image_data)}")

        # Step 6: Upload to Supabase Storage
        db = _get_supabase_client()

        # Generate unique filename
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        extension = "png" if "png" in mime_type else "jpg"
        filename = f"{episode_id}/{timestamp_str}_{unique_id}.{extension}"

        # Handle image data - could be raw bytes or base64 string depending on SDK version
        if isinstance(image_data, bytes):
            # Already raw bytes, use directly
            image_bytes = image_data
            logger.debug("[IMAGE GEN] Using raw bytes directly, size: {len(image_bytes)}")
        elif isinstance(image_data, str):
            # Base64 encoded string, decode it
            image_bytes = base64.b64decode(image_data)
            logger.debug("[IMAGE GEN] Decoded base64 string, size: {len(image_bytes)}")
        else:
            # Unknown type, try to convert
            logger.debug("[IMAGE GEN] Unknown data type: {type(image_data)}, attempting base64 decode")
            image_bytes = base64.b64decode(image_data)

        # Upload to Supabase storage
        try:
            upload_result = db.client.storage.from_(GENERATED_IMAGES_BUCKET).upload(
                path=filename,
                file=image_bytes,
                file_options={"content-type": mime_type}
            )
            # Check for upload errors - supabase-py v2 returns object with path on success
            if hasattr(upload_result, 'path'):
                logger.debug("[IMAGE GEN] Upload successful: {upload_result.path}")
            elif isinstance(upload_result, dict) and upload_result.get("error"):
                return {
                    "error": f"Failed to upload image: {upload_result.get('error')}",
                    "image_url": None,
                    "caption": None,
                }
        except Exception as upload_error:
            return {
                "error": f"Failed to upload image to storage: {str(upload_error)}",
                "image_url": None,
                "caption": None,
            }

        # Get public URL (bucket must be set to public in Supabase Dashboard)
        # This is simpler and avoids signed URL expiry issues
        public_url = db.client.storage.from_(GENERATED_IMAGES_BUCKET).get_public_url(filename)
        logger.debug("[IMAGE GEN] Public URL: {public_url}")
        result = {
            "image_url": public_url,
            "caption": caption_text.strip() if caption_text else f"Generated visualization: {prompt[:100]}",
            "style_used": style_hint,
            "model": GEMINI_IMAGE_MODEL,
            "episode_id": episode_id,
            "timestamp": current_timestamp,
            "storage_path": filename,
        }
        logger.debug("[IMAGE GEN] Returning result: {result}")
        return result

    except Exception as e:
        import traceback
        return {
            "error": f"Error generating image: {str(e)}",
            "traceback": traceback.format_exc(),
            "image_url": None,
            "caption": None,
        }



GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"
GENERATED_PODCASTS_BUCKET = "generated-podcasts"

# Voices for two-host format
PODCAST_HOST_A = "Puck"    # Curious, upbeat interviewer
PODCAST_HOST_B = "Charon"  # Knowledgeable expert

PODCAST_SCRIPT_PROMPT_TEMPLATE = """Create a 3-5 minute podcast script about this scientific claim from a bioelectricity research podcast.

## TWO HOSTS
- ALEX: A curious and engaging interviewer who asks insightful questions. Friendly and accessible.
- SAM: A knowledgeable expert who explains concepts clearly. Authoritative but warm.

## THE CLAIM
"{claim_text}"

## CONTEXT FROM THE ORIGINAL PODCAST
- Speaker's stance: {speaker_stance}
- Rationale: {rationale}
- Confidence level: {confidence_level}

## SUPPORTING RESEARCH
The following papers provide evidence for this claim:
{papers_summary}

## STYLE: {style_description}

## GUIDELINES
Write a natural, engaging conversation that:
1. ALEX opens with a hook that draws listeners in and introduces the topic
2. SAM explains the core scientific concept in accessible terms
3. ALEX asks follow-up questions a curious listener would have
4. SAM connects to the supporting research, mentioning specific experiments or findings
5. They discuss implications and broader connections
6. End with a thoughtful summary or takeaway

Format each line exactly as:
ALEX: [dialogue here]
SAM: [dialogue here]

Target approximately 900-1100 words for a 3-5 minute podcast when spoken.
Keep the tone {style_tone} and scientifically accurate."""

async def _generate_mini_podcast_impl(
    claim_id: str,
    episode_id: str,
    force_regenerate: bool = False,
    style: Literal["casual", "academic"] = "casual",
) -> dict[str, Any]:
    """
    Core implementation for mini podcast generation. Called by both MCP tool and HTTP endpoint.

    Flow:
    1. Check cache for existing podcast
    2. Load claim context
    3. Get RAG results for supporting papers
    4. Generate conversational script via Gemini 3
    5. Synthesize audio via Gemini 2.5 TTS with multi-speaker config
    6. Upload to Supabase Storage
    7. Cache result
    8. Return podcast_url, script, duration_seconds
    """
    try:
        import base64
        import uuid
        import wave
        import io
        from datetime import datetime

        # Step 1: Check cache
        cache_key = f"{episode_id}:{claim_id}:{style}"
        podcast_cache = _load_podcast_cache()

        if not force_regenerate and cache_key in podcast_cache:
            cached = podcast_cache[cache_key]
            logger.info("[MINI PODCAST] Returning cached podcast for {cache_key}")
            return {
                **cached,
                "cached": True,
            }

        logger.info("[MINI PODCAST] Generating new podcast for claim: {claim_id}")

        # Step 2: Load claim context
        claims_cache = _load_claims_cache()
        if not claims_cache or "segments" not in claims_cache:
            return {
                "error": "Claims cache not found or empty",
                "error_code": "CLAIM_NOT_FOUND",
                "podcast_url": None,
                "script": None,
            }

        # Parse claim_id (format: "segment_key-claim_index")
        if "-" not in claim_id:
            return {
                "error": f"Invalid claim_id format: {claim_id}. Expected 'segment_key-index'",
                "error_code": "CLAIM_NOT_FOUND",
                "podcast_url": None,
                "script": None,
            }

        parts = claim_id.rsplit("-", 1)
        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {
                "error": f"Invalid claim index in claim_id: {claim_id}",
                "error_code": "CLAIM_NOT_FOUND",
                "podcast_url": None,
                "script": None,
            }

        segment = claims_cache["segments"].get(segment_key)
        if not segment:
            return {
                "error": f"Segment not found: {segment_key}",
                "error_code": "CLAIM_NOT_FOUND",
                "podcast_url": None,
                "script": None,
            }

        claims = segment.get("claims", [])
        if claim_index >= len(claims):
            return {
                "error": f"Claim index {claim_index} out of range",
                "error_code": "CLAIM_NOT_FOUND",
                "podcast_url": None,
                "script": None,
            }

        claim_data = claims[claim_index]
        claim_text = claim_data.get("claim_text", "")
        speaker_stance = claim_data.get("speaker_stance", "supportive")
        rationale = claim_data.get("needs_backing_because", "This claim requires evidence.")

        logger.info("[MINI PODCAST] Found claim: {claim_text[:100]}...")

        # Step 3: Get RAG results for supporting papers
        research_query = _build_research_query(claim_data)
        logger.info("[MINI PODCAST] RAG query: {research_query}")

        vs = get_vectorstore()
        rag_results_raw = vs.search(research_query, n_results=7)

        # Parse RAG results - combine documents with metadatas
        docs = rag_results_raw.get("documents", [[]])[0]
        metas = rag_results_raw.get("metadatas", [[]])[0]

        rag_results = []
        for doc, meta in zip(docs, metas):
            rag_results.append({
                "text": doc,
                "paper_id": meta.get("paper_id", ""),
                "paper_title": meta.get("paper_title", ""),
                "section": meta.get("section_heading", ""),
                "page": meta.get("page", ""),
                "year": meta.get("year", ""),
            })

        # Format RAG results
        papers_collection = _load_papers_collection()
        formatted_papers = _format_rag_results_for_prompt(rag_results, papers_collection)

        # Determine confidence level from context card registry if available
        confidence_level = "moderate"  # Default
        try:
            if CONTEXT_CARD_REGISTRY_PATH.exists():
                with CONTEXT_CARD_REGISTRY_PATH.open() as fh:
                    context_cards = json.load(fh)
                    for card in context_cards.get("cards", []):
                        if card.get("claim_id") == claim_id:
                            confidence_level = card.get("confidence", "moderate")
                            break
        except Exception:
            pass

        # Style descriptions
        style_description = "accessible and engaging for a general science-interested audience" if style == "casual" else "detailed and technical for an academically-minded audience"
        style_tone = "conversational and warm" if style == "casual" else "precise and scholarly"

        # Step 4: Generate script via Gemini 3
        script_prompt = PODCAST_SCRIPT_PROMPT_TEMPLATE.format(
            claim_text=claim_text,
            speaker_stance=speaker_stance,
            rationale=rationale,
            confidence_level=confidence_level,
            papers_summary=formatted_papers[:4000],  # Limit to avoid token overflow
            style_description=style_description,
            style_tone=style_tone,
        )

        _ensure_gemini_client_ready()

        logger.info("[MINI PODCAST] Generating script with Gemini 3...")
        script_response = await asyncio.to_thread(
            lambda: _get_genai_client().models.generate_content(
                model=GEMINI_MODEL,
                contents=script_prompt,
                config={
                    "temperature": 0.8,
                    "max_output_tokens": 4096,
                }
            )
        )

        # Extract script text
        script_text = ""
        if hasattr(script_response, "text"):
            script_text = script_response.text
        elif hasattr(script_response, "candidates") and script_response.candidates:
            candidate = script_response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                script_text = "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))

        if not script_text:
            return {
                "error": "Failed to generate podcast script - no text in Gemini response",
                "error_code": "SCRIPT_FAILED",
                "podcast_url": None,
                "script": None,
            }

        logger.info("[MINI PODCAST] Script generated: {len(script_text)} chars")

        # Step 5: Synthesize audio via Gemini 2.5 TTS
        logger.info("[MINI PODCAST] Synthesizing audio with Gemini TTS...")

        try:
            from google.genai import types

            speech_config = types.SpeechConfig(
                multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                    speaker_voice_configs=[
                        types.SpeakerVoiceConfig(
                            speaker='ALEX',
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=PODCAST_HOST_A
                                )
                            )
                        ),
                        types.SpeakerVoiceConfig(
                            speaker='SAM',
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=PODCAST_HOST_B
                                )
                            )
                        ),
                    ]
                )
            )

            tts_response = await asyncio.to_thread(
                lambda: _get_genai_client().models.generate_content(
                    model=GEMINI_TTS_MODEL,
                    contents=script_text,
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=speech_config,
                    )
                )
            )

            # Extract audio data
            audio_data = None
            if hasattr(tts_response, "candidates") and tts_response.candidates:
                candidate = tts_response.candidates[0]
                if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                    for part in candidate.content.parts:
                        if hasattr(part, "inline_data") and part.inline_data:
                            audio_data = part.inline_data.data
                            logger.info("[MINI PODCAST] Got audio data: {len(audio_data) if audio_data else 0} bytes")
                            break

            if not audio_data:
                # Return script even if audio fails
                return {
                    "error": "Failed to synthesize audio - TTS returned no audio data",
                    "error_code": "AUDIO_FAILED",
                    "podcast_url": None,
                    "script": script_text,
                    "claim_id": claim_id,
                    "episode_id": episode_id,
                    "style": style,
                }

            # Convert PCM to WAV format
            # Gemini TTS outputs PCM 24kHz 16-bit mono
            sample_rate = 24000
            channels = 1
            sample_width = 2  # 16-bit

            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(channels)
                wav_file.setsampwidth(sample_width)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data if isinstance(audio_data, bytes) else base64.b64decode(audio_data))

            wav_bytes = wav_buffer.getvalue()

            # Calculate approximate duration
            duration_seconds = len(audio_data) / (sample_rate * channels * sample_width)
            logger.info("[MINI PODCAST] Audio duration: {duration_seconds:.1f} seconds")

        except Exception as tts_error:
            import traceback
            logger.info("[MINI PODCAST] TTS error: {tts_error}")
            traceback.print_exc()
            # Return script even if audio fails
            return {
                "error": f"Failed to synthesize audio: {str(tts_error)}",
                "error_code": "AUDIO_FAILED",
                "podcast_url": None,
                "script": script_text,
                "claim_id": claim_id,
                "episode_id": episode_id,
                "style": style,
            }

        # Step 6: Upload to Supabase Storage
        db = _get_supabase_client()

        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        # Create safe filename from claim_id (replace special chars)
        safe_claim_id = claim_id.replace("|", "_").replace(":", "_")[:50]
        filename = f"{episode_id}/{safe_claim_id}_{timestamp_str}_{unique_id}.wav"

        logger.info("[MINI PODCAST] Uploading to storage: {filename}")

        try:
            upload_result = db.client.storage.from_(GENERATED_PODCASTS_BUCKET).upload(
                path=filename,
                file=wav_bytes,
                file_options={"content-type": "audio/wav"}
            )

            if hasattr(upload_result, 'path'):
                logger.info("[MINI PODCAST] Upload successful: {upload_result.path}")
            elif isinstance(upload_result, dict) and upload_result.get("error"):
                return {
                    "error": f"Failed to upload audio: {upload_result.get('error')}",
                    "error_code": "UPLOAD_FAILED",
                    "podcast_url": None,
                    "script": script_text,
                }
        except Exception as upload_error:
            return {
                "error": f"Failed to upload audio to storage: {str(upload_error)}",
                "error_code": "UPLOAD_FAILED",
                "podcast_url": None,
                "script": script_text,
            }

        # Get public URL
        public_url = db.client.storage.from_(GENERATED_PODCASTS_BUCKET).get_public_url(filename)
        logger.info("[MINI PODCAST] Public URL: {public_url}")

        # Step 7: Cache result
        generated_at = datetime.now().isoformat()
        cache_entry = {
            "podcast_url": public_url,
            "script": script_text,
            "duration_seconds": int(duration_seconds),
            "style": style,
            "claim_id": claim_id,
            "episode_id": episode_id,
            "storage_path": filename,
            "generated_at": generated_at,
            "model_script": GEMINI_MODEL,
            "model_tts": GEMINI_TTS_MODEL,
        }

        podcast_cache[cache_key] = cache_entry
        _save_podcast_cache(podcast_cache)

        # Step 8: Return result
        return {
            **cache_entry,
            "cached": False,
        }

    except Exception as e:
        import traceback
        return {
            "error": f"Error generating mini podcast: {str(e)}",
            "traceback": traceback.format_exc(),
            "error_code": "UNKNOWN",
            "podcast_url": None,
            "script": None,
        }




CHAT_AUDIO_BUCKET = "chat-audio"
DEFAULT_TTS_VOICE = "Zephyr"

async def _text_to_speech_impl(
    text: str,
    voice: str = DEFAULT_TTS_VOICE,
) -> dict[str, Any]:
    """
    Core implementation for text-to-speech conversion using Gemini TTS.

    Uses single-voice Gemini TTS to convert text to audio, then uploads
    to Supabase Storage and returns a signed URL.

    Args:
        text: The text to convert to speech
        voice: Voice name to use (default: Zephyr)

    Returns:
        audio_url: Signed URL to the audio file
        duration_seconds: Approximate duration
        voice: Voice used
    """
    try:
        import base64
        import uuid
        import wave
        import io
        from datetime import datetime
        from google.genai import types

        if not text or not text.strip():
            return {
                "error": "Text cannot be empty",
                "error_code": "INVALID_INPUT",
                "audio_url": None,
            }

        logger.info("[TTS] Generating audio for {len(text)} chars with voice: {voice}")

        # Ensure Gemini client is initialized
        _ensure_gemini_client_ready()

        # Single-voice config (not multi-speaker like podcasts)
        speech_config = types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
            )
        )

        # Generate audio via Gemini TTS
        tts_response = await asyncio.to_thread(
            lambda: _get_genai_client().models.generate_content(
                model=GEMINI_TTS_MODEL,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=speech_config,
                )
            )
        )

        # Extract audio data from response
        audio_data = None
        if hasattr(tts_response, "candidates") and tts_response.candidates:
            candidate = tts_response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                for part in candidate.content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        audio_data = part.inline_data.data
                        logger.info("[TTS] Got audio data: {len(audio_data) if audio_data else 0} bytes")
                        break

        if not audio_data:
            return {
                "error": "Failed to generate audio - TTS returned no data",
                "error_code": "AUDIO_FAILED",
                "audio_url": None,
            }

        # Convert PCM to WAV format (Gemini TTS outputs PCM 24kHz 16-bit mono)
        sample_rate = 24000
        channels = 1
        sample_width = 2  # 16-bit

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(sample_width)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data if isinstance(audio_data, bytes) else base64.b64decode(audio_data))

        wav_bytes = wav_buffer.getvalue()

        # Calculate approximate duration
        duration_seconds = len(audio_data) / (sample_rate * channels * sample_width)
        logger.info("[TTS] Audio duration: {duration_seconds:.1f} seconds")

        # Upload to Supabase Storage
        db = _get_supabase_client()

        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{timestamp_str}_{unique_id}.wav"

        logger.info("[TTS] Uploading to storage: {filename}")

        try:
            upload_result = db.client.storage.from_(CHAT_AUDIO_BUCKET).upload(
                path=filename,
                file=wav_bytes,
                file_options={"content-type": "audio/wav"}
            )

            if hasattr(upload_result, 'path'):
                logger.info("[TTS] Upload successful: {upload_result.path}")
            elif isinstance(upload_result, dict) and upload_result.get("error"):
                return {
                    "error": f"Failed to upload audio: {upload_result.get('error')}",
                    "error_code": "UPLOAD_FAILED",
                    "audio_url": None,
                }
        except Exception as upload_error:
            return {
                "error": f"Failed to upload audio to storage: {str(upload_error)}",
                "error_code": "UPLOAD_FAILED",
                "audio_url": None,
            }

        # Get signed URL (24h expiry for private bucket)
        signed_url_response = db.client.storage.from_(CHAT_AUDIO_BUCKET).create_signed_url(
            path=filename,
            expires_in=86400  # 24 hours
        )

        if isinstance(signed_url_response, dict) and signed_url_response.get("signedURL"):
            audio_url = signed_url_response["signedURL"]
        elif hasattr(signed_url_response, 'signed_url'):
            audio_url = signed_url_response.signed_url
        else:
            # Fallback to public URL if signed URL fails
            audio_url = db.client.storage.from_(CHAT_AUDIO_BUCKET).get_public_url(filename)

        logger.info("[TTS] Audio URL: {audio_url}")

        return {
            "audio_url": audio_url,
            "duration_seconds": round(duration_seconds, 1),
            "voice": voice,
            "storage_path": filename,
        }

    except Exception as e:
        import traceback
        logger.info("[TTS] Error: {e}")
        traceback.print_exc()
        return {
            "error": f"Error generating audio: {str(e)}",
            "error_code": "UNKNOWN",
            "audio_url": None,
        }

