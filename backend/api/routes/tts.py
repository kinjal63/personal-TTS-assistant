from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Literal, Optional, List
import base64

from services.audio.edge_tts import EdgeTTSService, AVAILABLE_VOICES
from services.processing.formatter import ProsodyFormatter


router = APIRouter()

tts_service = EdgeTTSService()
formatter = ProsodyFormatter()


class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-JennyNeural"
    speed: float = 1.0
    summary_mode: Literal["verbatim", "tldr", "executive", "condensed"] = "verbatim"
    format_text: bool = True  # Apply prosody formatting


class ChunkedTTSRequest(BaseModel):
    text: str
    voice: str = "en-US-JennyNeural"
    speed: float = 1.0
    chunk_indices: List[int] = [0, 1]  # Which chunks to generate


class ChunkInfo(BaseModel):
    index: int
    text_preview: str  # First 100 chars
    char_count: int
    word_count: int


class TTSResponse(BaseModel):
    audio_url: Optional[str] = None
    estimated_duration: float
    word_count: int


@router.get("/voices")
async def list_voices():
    """List available TTS voices"""
    return {"voices": AVAILABLE_VOICES}


@router.post("/generate")
async def generate_tts(request: TTSRequest):
    """Generate TTS audio from text with prosody formatting"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if request.voice not in [v["id"] for v in AVAILABLE_VOICES]:
        raise HTTPException(status_code=400, detail=f"Invalid voice: {request.voice}")

    try:
        # Apply prosody formatting if enabled
        text_to_speak = formatter.format(request.text) if request.format_text else request.text

        audio_data = await tts_service.generate_audio(
            text=text_to_speak,
            voice=request.voice,
            speed=request.speed,
        )

        word_count = len(request.text.split())
        estimated_duration = (word_count / 150) * 60 / request.speed

        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/mpeg",
            headers={
                "X-Word-Count": str(word_count),
                "X-Estimated-Duration": str(estimated_duration),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chunks/info")
async def get_chunks_info(request: TTSRequest):
    """
    Get information about how text will be chunked for streaming.
    Use this to plan chunked playback without generating audio.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    chunks = formatter.chunk_for_streaming(request.text)

    chunks_info = []
    for idx, text in chunks:
        chunks_info.append({
            "index": idx,
            "text_preview": text[:100] + "..." if len(text) > 100 else text,
            "char_count": len(text),
            "word_count": len(text.split()),
        })

    total_words = sum(c["word_count"] for c in chunks_info)
    estimated_duration = (total_words / 150) * 60

    return {
        "total_chunks": len(chunks),
        "chunks": chunks_info,
        "total_words": total_words,
        "estimated_duration_seconds": estimated_duration,
    }


@router.post("/chunks/generate")
async def generate_chunks(request: ChunkedTTSRequest):
    """
    Generate audio for specific chunks of text.
    Returns base64 encoded audio for the requested chunk indices.
    Use this for progressive loading - generate first chunks, start playing,
    then request next chunks while playing.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if request.voice not in [v["id"] for v in AVAILABLE_VOICES]:
        raise HTTPException(status_code=400, detail=f"Invalid voice: {request.voice}")

    try:
        # Get all chunks
        all_chunks = formatter.chunk_for_streaming(request.text)
        total_chunks = len(all_chunks)

        # Validate requested indices
        valid_indices = [i for i in request.chunk_indices if 0 <= i < total_chunks]
        if not valid_indices:
            raise HTTPException(status_code=400, detail="No valid chunk indices provided")

        # Generate audio for each requested chunk
        chunks_audio = []
        for chunk_idx in valid_indices:
            _, chunk_text = all_chunks[chunk_idx]

            audio_data = await tts_service.generate_audio(
                text=chunk_text,
                voice=request.voice,
                speed=request.speed,
            )

            chunks_audio.append({
                "index": chunk_idx,
                "audio_base64": base64.b64encode(audio_data).decode("utf-8"),
                "word_count": len(chunk_text.split()),
                "char_count": len(chunk_text),
            })

        # Determine next chunks to request
        max_requested = max(valid_indices)
        next_indices = []
        for i in range(max_requested + 1, min(max_requested + 3, total_chunks)):
            next_indices.append(i)

        return {
            "total_chunks": total_chunks,
            "generated_chunks": chunks_audio,
            "next_chunk_indices": next_indices,
            "is_complete": max_requested >= total_chunks - 1,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream_tts(request: TTSRequest):
    """Stream TTS audio in real-time chunks"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if request.voice not in [v["id"] for v in AVAILABLE_VOICES]:
        raise HTTPException(status_code=400, detail=f"Invalid voice: {request.voice}")

    try:
        # Apply prosody formatting
        text_to_speak = formatter.format(request.text) if request.format_text else request.text

        return StreamingResponse(
            tts_service.stream_audio(
                text=text_to_speak,
                voice=request.voice,
                speed=request.speed,
            ),
            media_type="audio/mpeg",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
