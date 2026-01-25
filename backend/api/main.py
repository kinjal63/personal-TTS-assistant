from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.routes import tts, content


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting TTS Assistant API...")
    yield
    # Shutdown
    print("Shutting down TTS Assistant API...")


app = FastAPI(
    title="TTS Assistant API",
    description="Personal AI Text-to-Speech Assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "chrome-extension://*",
        "safari-extension://*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(tts.router, prefix="/v1/tts", tags=["TTS"])
app.include_router(content.router, prefix="/v1/content", tags=["Content"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "0.1.0"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "TTS Assistant API",
        "version": "0.1.0",
        "docs": "/docs",
    }
