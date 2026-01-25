from __future__ import annotations

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional

from services.content.extractor import ContentExtractor
from services.content.cleaner import ContentCleaner


router = APIRouter()

extractor = ContentExtractor()
cleaner = ContentCleaner()


class ExtractRequest(BaseModel):
    url: HttpUrl


class CleanRequest(BaseModel):
    html: str
    source_url: Optional[str] = None


class ContentResponse(BaseModel):
    title: str
    content: str
    word_count: int
    estimated_listen_time: int  # in minutes


@router.post("/extract", response_model=ContentResponse)
async def extract_content(request: ExtractRequest):
    """Extract readable content from a URL"""
    try:
        result = await extractor.extract_from_url(str(request.url))

        if not result:
            raise HTTPException(status_code=400, detail="Could not extract content from URL")

        # Clean the extracted content
        cleaned_content = cleaner.clean(result["content"])

        word_count = len(cleaned_content.split())
        estimated_listen_time = max(1, word_count // 150)  # ~150 wpm for TTS

        return ContentResponse(
            title=result["title"],
            content=cleaned_content,
            word_count=word_count,
            estimated_listen_time=estimated_listen_time,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clean", response_model=ContentResponse)
async def clean_content(request: CleanRequest):
    """Clean provided HTML content"""
    try:
        cleaned_content = cleaner.clean(request.html, request.source_url)

        word_count = len(cleaned_content.split())
        estimated_listen_time = max(1, word_count // 150)

        return ContentResponse(
            title="Cleaned Content",
            content=cleaned_content,
            word_count=word_count,
            estimated_listen_time=estimated_listen_time,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
