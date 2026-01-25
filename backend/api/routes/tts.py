from __future__ import annotations

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Literal, Optional

from services.audio.edge_tts import EdgeTTSService, AVAILABLE_VOICES


router = APIRouter()

tts_service = EdgeTTSService()


class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-JennyNeural"
    speed: float = 1.0
    summary_mode: Literal["verbatim", "tldr", "executive", "condensed"] = "verbatim"


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
    """Generate TTS audio from text"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if request.voice not in [v["id"] for v in AVAILABLE_VOICES]:
        raise HTTPException(status_code=400, detail=f"Invalid voice: {request.voice}")

    try:
        audio_data = await tts_service.generate_audio(
            text=request.text,
            voice=request.voice,
            speed=request.speed,
        )

        word_count = len(request.text.split())
        # Estimate duration: ~150 words per minute, adjusted for speed
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


@router.post("/stream")
async def stream_tts(request: TTSRequest):
    """Stream TTS audio in chunks"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if request.voice not in [v["id"] for v in AVAILABLE_VOICES]:
        raise HTTPException(status_code=400, detail=f"Invalid voice: {request.voice}")

    try:
        return StreamingResponse(
            tts_service.stream_audio(
                text=request.text,
                voice=request.voice,
                speed=request.speed,
            ),
            media_type="audio/mpeg",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
