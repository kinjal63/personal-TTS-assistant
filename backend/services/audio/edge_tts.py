from __future__ import annotations

import edge_tts
from typing import AsyncGenerator, Optional

# Available voices with metadata
AVAILABLE_VOICES = [
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny",
        "locale": "en-US",
        "gender": "Female",
        "style": "Professional",
    },
    {
        "id": "en-US-GuyNeural",
        "name": "Guy",
        "locale": "en-US",
        "gender": "Male",
        "style": "Professional",
    },
    {
        "id": "en-US-AriaNeural",
        "name": "Aria",
        "locale": "en-US",
        "gender": "Female",
        "style": "Conversational",
    },
    {
        "id": "en-GB-SoniaNeural",
        "name": "Sonia",
        "locale": "en-GB",
        "gender": "Female",
        "style": "British",
    },
    {
        "id": "en-AU-NatashaNeural",
        "name": "Natasha",
        "locale": "en-AU",
        "gender": "Female",
        "style": "Australian",
    },
]


class EdgeTTSService:
    """Edge TTS service for text-to-speech generation"""

    def __init__(self, default_voice: str = "en-US-JennyNeural"):
        self.default_voice = default_voice

    def _get_rate_string(self, speed: float) -> str:
        """Convert speed multiplier to rate string for Edge TTS"""
        if speed == 1.0:
            return "+0%"
        percentage = int((speed - 1.0) * 100)
        return f"{percentage:+d}%"

    async def generate_audio(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> bytes:
        """Generate complete audio from text"""
        voice = voice or self.default_voice
        rate = self._get_rate_string(speed)

        communicate = edge_tts.Communicate(text, voice, rate=rate)

        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]

        return audio_data

    async def stream_audio(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio chunks for real-time playback"""
        voice = voice or self.default_voice
        rate = self._get_rate_string(speed)

        communicate = edge_tts.Communicate(text, voice, rate=rate)

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    async def save_audio(
        self,
        text: str,
        output_path: str,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> str:
        """Save audio to file and return the path"""
        audio_data = await self.generate_audio(text, voice, speed)

        with open(output_path, "wb") as f:
            f.write(audio_data)

        return output_path
