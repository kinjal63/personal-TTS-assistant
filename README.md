# Personal TTS Assistant

A personal AI-powered Text-to-Speech assistant that converts web articles, emails, and on-screen content into natural, high-quality audio. Built with privacy-first design - all processing is ephemeral with no persistent cloud storage.

## Features

- **Browser Extension**: Auto-detects readable content on web pages with a floating "Listen" button
- **Multiple Voices**: 5 natural-sounding voices (US, UK, Australian accents)
- **Variable Speed**: Playback from 0.5x to 2x with pitch preservation
- **Content Cleaning**: Automatically strips ads, navigation, promotional content
- **Offline Support**: Piper TTS integration for offline playback (planned)

## Tech Stack

### Backend
| Technology | Purpose | Link |
|------------|---------|------|
| [FastAPI](https://fastapi.tiangolo.com/) | Python web framework | High-performance async API |
| [Edge TTS](https://github.com/rany2/edge-tts) | Text-to-Speech | Free, 300+ voices via Microsoft |
| [Trafilatura](https://trafilatura.readthedocs.io/) | Content extraction | Article extraction from HTML |
| [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) | HTML parsing | Fallback content extraction |
| [httpx](https://www.python-httpx.org/) | HTTP client | Async HTTP requests |
| [Pydantic](https://docs.pydantic.dev/) | Data validation | Request/response schemas |

### Browser Extension
| Technology | Purpose | Link |
|------------|---------|------|
| [TypeScript](https://www.typescriptlang.org/) | Language | Type-safe JavaScript |
| [Webpack](https://webpack.js.org/) | Bundler | Module bundling |
| [Readability.js](https://github.com/mozilla/readability) | Content detection | Mozilla's article parser |
| Chrome Manifest V3 | Extension API | Modern extension architecture |

### Planned
| Technology | Purpose | Link |
|------------|---------|------|
| [React Native](https://reactnative.dev/) | Mobile app | iOS/Android cross-platform |
| [Piper TTS](https://github.com/rhasspy/piper) | Offline TTS | On-device speech synthesis |
| AWS Lambda + S3 | Cloud infrastructure | Serverless deployment |

## Project Structure

```
personal-tts-assistant/
├── backend/                    # Python FastAPI backend
│   ├── api/
│   │   ├── main.py            # FastAPI app entry point
│   │   └── routes/
│   │       ├── tts.py         # TTS generation endpoints
│   │       └── content.py     # Content extraction endpoints
│   ├── services/
│   │   ├── audio/
│   │   │   └── edge_tts.py    # Edge TTS integration
│   │   ├── content/
│   │   │   ├── extractor.py   # URL content extraction
│   │   │   └── cleaner.py     # Content cleaning pipeline
│   │   └── processing/
│   │       └── formatter.py   # TTS text formatting
│   ├── tests/                 # Unit tests
│   ├── requirements.txt       # Python dependencies
│   └── .venv/                 # Virtual environment
│
├── extension/                  # Chrome/Safari browser extension
│   ├── src/
│   │   ├── content/           # Content scripts (injected into pages)
│   │   │   ├── detector.ts    # Readability.js integration
│   │   │   ├── ui.ts          # Floating listen button
│   │   │   └── index.ts       # Content script entry
│   │   ├── background/        # Service worker
│   │   │   ├── api-client.ts  # Backend API client
│   │   │   ├── audio-player.ts # Audio playback
│   │   │   └── index.ts       # Background script entry
│   │   ├── popup/             # Extension popup UI
│   │   │   └── index.ts       # Player controls
│   │   └── lib/               # Shared utilities
│   │       ├── types.ts       # TypeScript types
│   │       └── storage.ts     # Chrome storage helpers
│   ├── public/
│   │   ├── manifest.json      # Extension manifest (v3)
│   │   └── popup.html         # Popup UI
│   ├── dist/                  # Built extension (load this in Chrome)
│   └── package.json           # Node dependencies
│
├── mobile/                     # React Native app (planned)
│   └── src/
│
├── shared/                     # Shared types/constants
│   ├── types/
│   └── constants/
│
├── docs/
│   ├── plan.md                # Architecture & roadmap
│   └── todo.md                # MVP build checklist
│
├── CLAUDE.md                  # AI assistant guidance
└── README.md                  # This file
```

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- Chrome browser (for extension)

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at `http://localhost:8000`. View the interactive docs at `http://localhost:8000/docs`.

### Extension Setup

```bash
# Navigate to extension
cd extension

# Install dependencies
npm install

# Build for production
npm run build

# Or watch for development
npm run dev
```

**Load in Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

## API Endpoints

### TTS Routes (`/v1/tts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/tts/voices` | List available voices |
| `POST` | `/v1/tts/generate` | Generate audio from text |
| `POST` | `/v1/tts/stream` | Stream audio chunks |

### Content Routes (`/v1/content`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/content/extract` | Extract content from URL |
| `POST` | `/v1/content/clean` | Clean HTML/text content |

### Example Request

```bash
# Generate TTS audio
curl -X POST http://localhost:8000/v1/tts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test of the TTS system.",
    "voice": "en-US-JennyNeural",
    "speed": 1.0
  }' \
  --output audio.mp3

# Extract content from URL
curl -X POST http://localhost:8000/v1/content/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

## Available Voices

| Voice ID | Name | Locale | Style |
|----------|------|--------|-------|
| `en-US-JennyNeural` | Jenny | US English | Professional |
| `en-US-GuyNeural` | Guy | US English | Professional |
| `en-US-AriaNeural` | Aria | US English | Conversational |
| `en-GB-SoniaNeural` | Sonia | UK English | British |
| `en-AU-NatashaNeural` | Natasha | Australian | Casual |

## Development

### Running Tests

```bash
# Backend tests
cd backend
source .venv/bin/activate
pytest

# Extension (no tests yet)
cd extension
npm test
```

### Project Scripts

**Backend:**
```bash
uvicorn api.main:app --reload  # Development server
```

**Extension:**
```bash
npm run dev    # Watch mode
npm run build  # Production build
npm run clean  # Remove dist folder
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Content Script│  │  Background  │  │    Popup     │      │
│  │ (Readability)│──│   Worker     │──│   Player     │      │
│  └──────────────┘  └──────┬───────┘  └──────────────┘      │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Content Routes│  │  TTS Routes  │  │   Services   │      │
│  │  /extract    │  │  /generate   │  │  Edge TTS    │      │
│  │  /clean      │  │  /stream     │  │  Trafilatura │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Privacy

- **No persistent storage**: Content is processed ephemerally
- **No tracking**: No analytics or user tracking
- **Local-first**: Audio cached locally in browser
- **Planned**: Full offline mode with Piper TTS

## Roadmap

- [x] Core TTS pipeline with Edge TTS
- [x] Content extraction and cleaning
- [x] Chrome extension MVP
- [ ] Gmail integration for newsletters
- [ ] iOS/Android app with React Native
- [ ] Offline TTS with Piper
- [ ] Summarization options (TL;DR, Executive, Condensed)
- [ ] Voice cloning with OpenVoice

## License

MIT

## Contributing

This is a personal project, but contributions are welcome! Please open an issue first to discuss proposed changes.
