# Personal AI TTS Assistant - MVP Build Todo

## Prerequisites & Environment Setup

### Required Software
- [ ] Node.js v18+ (for extension and mobile development)
- [ ] Python 3.9+ (for backend)
- [ ] AWS CLI v2 (configured with credentials)
- [ ] Docker Desktop (for local development)
- [ ] Xcode 15+ (for iOS development)
- [ ] React Native CLI
- [ ] Git

### Package Managers & Tools
- [ ] pnpm or yarn (recommended for monorepo)
- [ ] Poetry or pip (Python dependency management)
- [ ] CocoaPods (iOS dependencies)

### AWS Account Setup
- [ ] Create AWS account (if not exists)
- [ ] Configure IAM user with appropriate permissions
- [ ] Set up AWS CLI credentials (`aws configure`)
- [ ] Enable required services: Lambda, S3, API Gateway, CloudWatch

### Development Accounts
- [ ] Chrome Developer account (for extension publishing)
- [ ] Apple Developer account ($99/year for App Store)
- [ ] Google Cloud Console project (for Gmail API)

---

## Tech Stack Reference

| Component | Technology | Version |
|-----------|------------|---------|
| Backend Framework | FastAPI | 0.100+ |
| TTS (Primary) | edge-tts | 6.1+ |
| TTS (Offline) | Piper | 1.2+ |
| Content Extraction | trafilatura | 1.6+ |
| Content Detection | @mozilla/readability | 0.5+ |
| Mobile Framework | React Native | 0.73+ |
| Audio Player | react-native-track-player | 4.0+ |
| Extension | Chrome Manifest V3 | - |
| Cloud | AWS Lambda + S3 + API Gateway | - |
| IaC | Terraform or SAM | - |

---

## Week 1: Project Setup & Core TTS Pipeline

### Day 1-2: Project Initialization

#### Monorepo Setup
- [ ] Initialize git repository
- [ ] Create monorepo structure:
  ```
  personal-tts-assistant/
  ├── backend/
  ├── extension/
  ├── mobile/
  ├── shared/
  └── docs/
  ```
- [ ] Configure root package.json with workspaces (if using npm/yarn/pnpm)
- [ ] Set up .gitignore for all platforms
- [ ] Create .env.example files for each project

#### Backend Setup
- [ ] Create Python virtual environment
- [ ] Initialize FastAPI project structure:
  ```
  backend/
  ├── api/
  │   ├── __init__.py
  │   ├── main.py
  │   └── routes/
  ├── services/
  │   ├── content/
  │   ├── processing/
  │   └── audio/
  ├── requirements.txt
  └── pyproject.toml
  ```
- [ ] Install core dependencies:
  ```bash
  pip install fastapi uvicorn edge-tts trafilatura beautifulsoup4 python-dotenv
  ```
- [ ] Create basic FastAPI app with health check endpoint
- [ ] Set up local development server (uvicorn)
- [ ] Configure CORS for local development

#### AWS Infrastructure (Basic)
- [ ] Create S3 bucket for audio storage
- [ ] Configure S3 bucket policies (24h TTL lifecycle rule)
- [ ] Create IAM role for Lambda execution
- [ ] Set up CloudWatch log group

### Day 3-4: Core TTS Pipeline

#### Edge TTS Integration
- [ ] Create `backend/services/audio/edge_tts.py`
- [ ] Implement `generate_audio(text, voice)` function
- [ ] Implement `stream_audio(text, voice)` async generator
- [ ] Add voice selection constants (5 default voices):
  - en-US-JennyNeural (Professional Female)
  - en-US-GuyNeural (Professional Male)
  - en-US-AriaNeural (Conversational Female)
  - en-GB-SoniaNeural (British Female)
  - en-AU-NatashaNeural (Australian Female)
- [ ] Test TTS generation locally

#### Content Extraction Service
- [ ] Create `backend/services/content/extractor.py`
- [ ] Implement URL content fetching with requests/httpx
- [ ] Integrate Trafilatura for main content extraction
- [ ] Add fallback extraction with BeautifulSoup
- [ ] Handle different content types (articles, blog posts)

#### Content Cleaning Pipeline
- [ ] Create `backend/services/content/cleaner.py`
- [ ] Implement promotional content removal patterns
- [ ] Strip navigation, headers, footers
- [ ] Normalize whitespace and formatting
- [ ] Create `backend/services/content/filters.py`
- [ ] Add smart filtering rules for common patterns

#### TTS Text Formatter
- [ ] Create `backend/services/processing/formatter.py`
- [ ] Implement abbreviation expansion
- [ ] Handle numbers and currency for speech
- [ ] Replace URLs with [link] placeholders
- [ ] Add pause markers for natural prosody
- [ ] Format lists for clear speech

#### API Endpoints
- [ ] Create `backend/api/routes/tts.py`
- [ ] POST `/v1/tts` - Generate audio from text/URL
- [ ] POST `/v1/tts/stream` - Stream audio response
- [ ] GET `/v1/voices` - List available voices
- [ ] Create `backend/api/routes/content.py`
- [ ] POST `/v1/content/extract` - Extract content from URL
- [ ] POST `/v1/content/clean` - Clean provided HTML/text

#### End-to-End Testing
- [ ] Test: URL → Extract → Clean → TTS → Audio file
- [ ] Verify audio quality and format (mp3)
- [ ] Measure processing latency
- [ ] Test with 5 different article types

### Day 5-6: Browser Extension MVP

#### Extension Scaffolding
- [ ] Create extension project structure:
  ```
  extension/
  ├── src/
  │   ├── content/
  │   ├── background/
  │   ├── popup/
  │   └── lib/
  ├── public/
  │   └── icons/
  ├── manifest.json
  ├── package.json
  └── webpack.config.js
  ```
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Set up Webpack for extension bundling
- [ ] Create Manifest V3 configuration
- [ ] Design extension icons (16, 32, 48, 128px)

#### Content Detection Script
- [ ] Install @mozilla/readability
- [ ] Create `extension/src/content/detector.ts`
- [ ] Implement `isProbablyReaderable` check
- [ ] Extract article metadata (title, word count, site name)
- [ ] Calculate estimated listen time (~150 wpm)

#### Floating Listen Button
- [ ] Create `extension/src/content/ui.ts`
- [ ] Design floating button component (fixed position)
- [ ] Show button only on readable pages
- [ ] Display estimated listen time
- [ ] Add click handler to trigger TTS

#### Background Service Worker
- [ ] Create `extension/src/background/index.ts`
- [ ] Set up message passing between content script and background
- [ ] Create `extension/src/background/api-client.ts`
- [ ] Implement API communication with backend
- [ ] Create `extension/src/background/audio-player.ts`
- [ ] Implement audio playback using HTML5 Audio

#### Popup UI
- [ ] Create `extension/src/popup/App.tsx`
- [ ] Design minimal player interface:
  - Play/Pause button
  - Progress indicator
  - Speed control (0.5x-3x)
  - Voice selector dropdown
- [ ] Create `extension/src/popup/Player.tsx`
- [ ] Create `extension/src/popup/Settings.tsx`
- [ ] Style with CSS (clean, minimal design)

#### Extension Storage
- [ ] Create `extension/src/lib/storage.ts`
- [ ] Store user preferences (voice, speed)
- [ ] Cache recent articles metadata
- [ ] Implement chrome.storage.sync for cross-device sync

### Day 7: Integration Testing

#### Content Extraction Testing
- [ ] Test on Medium articles
- [ ] Test on Substack newsletters
- [ ] Test on major news sites (NYT, BBC, etc.)
- [ ] Test on tech blogs (Dev.to, Hacker News articles)
- [ ] Test on Wikipedia pages
- [ ] Document edge cases and failures

#### Performance Testing
- [ ] Measure content detection latency (target: <100ms)
- [ ] Measure extraction latency (target: <500ms)
- [ ] Measure TTS first byte (target: <1s)
- [ ] Measure full article audio generation (target: <5s)

#### Bug Fixes & Edge Cases
- [ ] Handle pages with no readable content
- [ ] Handle very long articles (chunking)
- [ ] Handle non-English content gracefully
- [ ] Fix any extraction failures from testing

---

## Week 2: Content Pipeline Enhancement

### Smart Filtering
- [ ] Create comprehensive promo pattern list
- [ ] Add site-specific extraction rules
- [ ] Implement newsletter-specific cleaning
- [ ] Handle embedded tweets/social content

### Reader View Display
- [ ] Create clean reading view in extension
- [ ] Show extracted content before playing
- [ ] Allow user to edit/trim content
- [ ] Add "Listen from here" feature

### Audio Caching
- [ ] Implement local audio caching in extension
- [ ] Set up S3 upload for generated audio
- [ ] Create cache lookup before regenerating
- [ ] Implement cache invalidation (24h TTL)

### Summarization Options
- [ ] Integrate BART-large-CNN model
- [ ] Implement summary modes:
  - [ ] Verbatim (full text)
  - [ ] TL;DR (1-2 sentences)
  - [ ] Executive (1 paragraph)
  - [ ] Condensed (~30% of original)
- [ ] Add summary mode selector to popup UI

---

## Week 3: iOS App MVP

### React Native Setup
- [ ] Initialize React Native project
- [ ] Configure iOS-specific settings
- [ ] Set up navigation (React Navigation)
- [ ] Configure state management (Zustand)
- [ ] Set up TypeScript

### Core Screens
- [ ] Create HomeScreen (queue of articles)
- [ ] Create PlayerScreen (now playing)
- [ ] Create SettingsScreen (preferences)
- [ ] Design consistent UI theme

### Audio Playback
- [ ] Install react-native-track-player
- [ ] Configure background audio playback
- [ ] Implement lock screen controls
- [ ] Add playback speed control (0.5x-3x)
- [ ] Create seek and skip functionality

### Offline Support
- [ ] Implement local audio file storage
- [ ] Set up AsyncStorage for metadata
- [ ] Create download manager for articles
- [ ] Implement LRU cache eviction (100MB limit)

### Piper TTS Integration (Offline)
- [ ] Research Piper React Native integration
- [ ] Create native module bridge for Piper
- [ ] Bundle Piper model (~50MB)
- [ ] Implement offline TTS fallback

### API Integration
- [ ] Create APIService for backend communication
- [ ] Implement article fetching and processing
- [ ] Handle network errors gracefully
- [ ] Add retry logic with exponential backoff

---

## Week 4: Gmail Integration

### Google Cloud Setup
- [ ] Enable Gmail API in Google Cloud Console
- [ ] Configure OAuth 2.0 credentials
- [ ] Set up OAuth consent screen
- [ ] Add required scopes (gmail.readonly)

### Gmail API Integration
- [ ] Create `backend/services/content/gmail.py`
- [ ] Implement OAuth token management
- [ ] Fetch unread emails from newsletter labels
- [ ] Parse email content (HTML to text)

### Email Processing Pipeline
- [ ] Filter newsletters vs spam/promos
- [ ] Extract sender name and subject
- [ ] Create email announcement format
- [ ] Clean email body content
- [ ] Generate audio for emails

### iOS Gmail Connection
- [ ] Add Gmail OAuth flow to iOS app
- [ ] Store OAuth tokens securely (Keychain)
- [ ] Create email sync service
- [ ] Add email queue to home screen

### Email-Specific Features
- [ ] Skip promotional/transactional emails
- [ ] Announce "Email from [Sender]"
- [ ] Group emails by sender
- [ ] Mark as read after listening

---

## Deployment & Testing

### AWS Lambda Deployment
- [ ] Create SAM/Serverless template
- [ ] Configure Lambda functions
- [ ] Set up API Gateway
- [ ] Configure environment variables
- [ ] Deploy to AWS

### CI/CD Pipeline
- [ ] Set up GitHub Actions
- [ ] Create backend test workflow
- [ ] Create extension build workflow
- [ ] Create iOS build workflow (Fastlane)
- [ ] Configure automatic deployments

### Testing Checklist
- [ ] Unit tests for content extraction
- [ ] Unit tests for TTS generation
- [ ] Integration tests for API endpoints
- [ ] E2E tests for extension
- [ ] Manual testing on real articles

### Documentation
- [ ] API documentation (OpenAPI spec)
- [ ] Extension usage guide
- [ ] iOS app usage guide
- [ ] Deployment instructions

---

## MVP Success Criteria

- [ ] Process 10 articles/day for personal use
- [ ] Audio quality rated 4/5+
- [ ] Offline playback works during 30-min commute
- [ ] End-to-end latency < 5s for 2000-word article
- [ ] Monthly AWS cost < $20

---

## Python Dependencies (requirements.txt)

```
fastapi>=0.100.0
uvicorn>=0.23.0
edge-tts>=6.1.0
trafilatura>=1.6.0
beautifulsoup4>=4.12.0
httpx>=0.24.0
python-dotenv>=1.0.0
google-auth>=2.22.0
google-api-python-client>=2.95.0
boto3>=1.28.0
pydantic>=2.0.0
```

## Node.js Dependencies (extension/package.json)

```json
{
  "dependencies": {
    "@mozilla/readability": "^0.5.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "webpack": "^5.88.0",
    "webpack-cli": "^5.1.0",
    "ts-loader": "^9.4.0",
    "@types/chrome": "^0.0.243"
  }
}
```

## React Native Dependencies (mobile/package.json)

```json
{
  "dependencies": {
    "react-native": "^0.73.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/native-stack": "^6.9.0",
    "react-native-track-player": "^4.0.0",
    "zustand": "^4.4.0",
    "@react-native-async-storage/async-storage": "^1.19.0",
    "react-native-fs": "^2.20.0"
  }
}
```

---

*Created: 2025-01-25*
*Based on: docs/plan.md*
