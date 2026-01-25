# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal AI TTS (Text-to-Speech) assistant that converts content from web pages, emails, and on-screen content into natural audio. Built with privacy-first approach (ephemeral processing, no persistent cloud storage).

## Architecture

This is a monorepo with three main components:

- **backend/** - Python/FastAPI microservices on AWS Lambda
- **extension/** - Chrome/Safari browser extension (TypeScript, Manifest V3)
- **mobile/** - React Native iOS/Android app with offline TTS support

### Backend Services
- Content Service: ingestion via Readability.js/Trafilatura
- Processing Service: NLP cleaning, summarization (BART/T5)
- Audio Service: TTS generation with Edge TTS (cloud) or Piper (offline)

### TTS Strategy
- Primary: Edge TTS (free, 300+ voices, streaming)
- Offline: Piper (MIT license, ~50MB models, runs on device)
- Future: OpenVoice for voice cloning

## Build Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload  # Local development
```

### Browser Extension
```bash
cd extension
npm install
npm run build  # Production build
npm run dev    # Development with watch
```

### Mobile App
```bash
cd mobile
npm install
npx pod-install ios  # iOS dependencies
npm run ios          # Run iOS app
npm run android      # Run Android app
```

### Infrastructure
```bash
cd backend/infrastructure/terraform
terraform init
terraform plan
terraform apply
```

## Key Dependencies

| Component | Package | Purpose |
|-----------|---------|---------|
| Backend | edge-tts | Primary TTS engine |
| Backend | trafilatura | Content extraction |
| Backend | fastapi | API framework |
| Extension | @mozilla/readability | Article detection |
| Mobile | react-native-track-player | Background audio |
| Mobile | zustand | State management |

## API Endpoints

- `POST /v1/tts` - Generate audio from text/URL
- `POST /v1/tts/stream` - Stream audio response
- `GET /v1/voices` - List available voices
- `POST /v1/content/extract` - Extract content from URL

## Content Processing Pipeline

```
Raw HTML → Extraction (Readability/Trafilatura) → Cleaning (strip ads/nav) →
Smart Filter (remove promos) → Summarization (optional) → TTS Formatting → Audio
```

## Summarization Modes

- `verbatim` - Full text
- `tldr` - 1-2 sentences
- `executive` - 1 paragraph
- `condensed` - ~30% of original

## Offline Architecture

Mobile app embeds Piper TTS (~50MB model) for offline generation. Audio cache limited to 100MB with LRU eviction.

## Privacy Constraints

- No persistent content storage
- Audio files: 24h TTL on S3
- OAuth tokens stored encrypted
- Ephemeral Lambda processing only
