# Personal AI TTS Assistant - System Architecture & Roadmap

## Executive Summary

A personal AI-powered Text-to-Speech assistant that consumes content from emails, web pages, and on-screen content, converting it into high-quality, natural audio with smart processing. Built as a free-first product targeting 1K users initially, scalable to 100K-500K.

**Key Constraints:**
- Budget: $0-60/month for MVP
- Platforms: iOS + Web first, then Android
- Offline: Must-have for MVP
- Privacy: No persistent cloud storage, ephemeral processing only

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Deep Dive](#component-deep-dive)
3. [Data Flow](#data-flow)
4. [Tech Stack](#tech-stack)
5. [Phased Roadmap](#phased-roadmap)
6. [TTS Strategy](#tts-strategy)
7. [Content Ingestion](#content-ingestion)
8. [NLP Pipeline](#nlp-pipeline)
9. [Non-Functional Requirements](#non-functional-requirements)
10. [Cost Analysis](#cost-analysis)
11. [Browser Extension & Mobile Architecture](#browser-extension--mobile-architecture)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Browser Ext    │   iOS App       │  Android App    │   Web App (PWA)       │
│  (Chrome/Safari)│   (Swift/RN)    │  (Kotlin/RN)    │   (React)             │
└────────┬────────┴────────┬────────┴────────┬────────┴──────────┬────────────┘
         │                 │                 │                   │
         └─────────────────┴────────┬────────┴───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (AWS)                                  │
│                    Rate Limiting │ Auth │ Routing                           │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│ Content Service │      │  Processing Service │      │   Audio Service     │
│ (Ingestion)     │──────│  (NLP/Cleaning)     │──────│   (TTS/Streaming)   │
└────────┬────────┘      └──────────┬──────────┘      └──────────┬──────────┘
         │                          │                            │
         ▼                          ▼                            ▼
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│ Gmail API       │      │ Summarization       │      │ Edge TTS (Primary)  │
│ DOM Parser      │      │ Content Cleaner     │      │ Piper (Offline)     │
│ Screen Capture  │      │ Smart Filter        │      │ OpenVoice (Clone)   │
└─────────────────┘      └─────────────────────┘      └─────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     Ephemeral Storage         │
                    │  Redis (cache) + S3 (audio)   │
                    │     TTL: 24 hours max         │
                    └───────────────────────────────┘
```

---

## Component Deep Dive

### 1. Content Ingestion Layer

| Source | Method | Implementation |
|--------|--------|----------------|
| **Browser (Web Pages)** | Auto-detect readable content | Readability.js + custom DOM parser |
| **Gmail** | OAuth 2.0 + Gmail API | Filter newsletters, notifications |
| **iOS Screen** | Share Extension + Accessibility | Native Swift integration |
| **Android Screen** | Share Intent + Accessibility | Native Kotlin integration |

### 2. Content Processing Pipeline

```
Raw Content → Extraction → Cleaning → Smart Filter → Summarization → TTS-Ready Text
     │            │            │            │              │              │
     │            │            │            │              │              └─ Structured
     │            │            │            │              │                 for prosody
     │            │            │            │              │
     │            │            │            │              └─ User-configurable:
     │            │            │            │                 • Full verbatim
     │            │            │            │                 • TL;DR (1-2 sentences)
     │            │            │            │                 • Executive (1 paragraph)
     │            │            │            │                 • Condensed (30%)
     │            │            │            │
     │            │            │            └─ Auto-remove:
     │            │            │               • Promotional content
     │            │            │               • Headers/Footers
     │            │            │               • Unsubscribe links
     │            │            │               • Navigation elements
     │            │            │               (But announce: "Email from [Sender]")
     │            │            │
     │            │            └─ Strip: ads, scripts, styles, nav
     │            │
     │            └─ Mozilla Readability / Trafilatura
     │
     └─ HTML/DOM/Email body
```

### 3. Audio Generation Layer

```
TTS-Ready Text → Chunking → TTS Engine → Audio Post-Processing → Streaming/Cache
                    │           │                  │
                    │           │                  └─ Variable speed (0.5x-3x)
                    │           │                     Pitch preservation
                    │           │                     Silence trimming
                    │           │
                    │           └─ Engine Selection:
                    │              • Edge TTS (cloud, free, high quality)
                    │              • Piper (offline, open-source)
                    │              • OpenVoice (voice cloning, future)
                    │
                    └─ Smart chunking by:
                       • Sentence boundaries
                       • Paragraph breaks
                       • ~500 char chunks for streaming
```

---

## Data Flow

### Real-time Flow (Browser Extension)

```
1. User visits article page
2. Extension auto-detects readable content (Readability.js)
3. Shows floating "Listen" indicator if content detected
4. Content sent to backend (or processed locally)
5. NLP pipeline cleans & optionally summarizes
6. TTS generates audio stream
7. Audio plays immediately in browser
8. Optional: Cache locally for offline replay
```

### Email Flow

```
1. User authenticates Gmail OAuth
2. Backend polls/webhooks for new emails
3. Filter: newsletters, notifications (skip spam/promos)
4. Announce: "Email from [Sender Name]"
5. Extract & clean email body
6. Process through NLP pipeline
7. Generate audio, push to user queue
8. Delete processed content after 24h
```

---

## Tech Stack

### Backend (Microservices on AWS)

| Service | Technology | Rationale |
|---------|------------|-----------|
| **API Gateway** | AWS API Gateway + Lambda | Serverless, scales to 0, cost-effective |
| **Content Service** | Python (FastAPI) | Best NLP/ML ecosystem |
| **Processing Service** | Python (FastAPI) | Hugging Face integration |
| **Audio Service** | Node.js (Fastify) | Superior streaming performance |
| **Queue** | AWS SQS | Reliable, serverless |
| **Cache** | Redis (ElastiCache) | Fast ephemeral storage |
| **Audio Storage** | S3 + CloudFront | CDN delivery, 24h TTL policies |

### Frontend

| Platform | Technology | Rationale |
|----------|------------|-----------|
| **Browser Extension** | TypeScript + Manifest V3 | Chrome & Safari support |
| **iOS App** | React Native | Code sharing with Android |
| **Android App** | React Native | Code sharing with iOS |
| **Web App** | Next.js (PWA) | SEO + offline capability |

### AI/ML Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Content Extraction** | Readability.js + Trafilatura | Best accuracy for articles |
| **Summarization** | BART-large-CNN or T5 | Open-source, runs on Lambda |
| **Smart Filtering** | Custom regex + spaCy | Fast, deterministic |
| **TTS (Primary)** | Edge TTS | Free, high quality, 300+ voices |
| **TTS (Offline)** | Piper | Open-source, fast, small models |
| **Voice Cloning** | OpenVoice | Open-source, celebrity-style voices |

---

## Phased Roadmap

### Phase 0: MVP (Weeks 1-4) — Personal Use
**Goal:** Working prototype for your commute

| Week | Deliverable |
|------|-------------|
| 1 | Browser extension: auto-detect content, basic DOM extraction, Edge TTS |
| 2 | Content cleaning pipeline, smart filtering, reader view display |
| 3 | iOS app: basic player, offline cache, variable speed playback |
| 4 | Gmail integration (personal account), email announcements |

**MVP Features Checklist:**
- ✅ Chrome extension with auto-detect readable content
- ✅ Clean article extraction (strip ads, nav, footers)
- ✅ Edge TTS with 3-5 voice options
- ✅ iOS app with offline playback
- ✅ Variable speed (0.5x-3x) with pitch preservation
- ✅ Gmail newsletters → audio queue
- ✅ Smart filtering (remove promo content, keep sender announcement)

**MVP Tech:**
- Single FastAPI backend on AWS Lambda
- S3 for audio cache (24h TTL)
- React Native iOS app with Piper embedded
- ~$10-20/month AWS cost

---

### Phase 1: V1 (Weeks 5-10) — Beta Users (1K)
**Goal:** Stable product for early adopters

| Week | Deliverable |
|------|-------------|
| 5-6 | User auth (Cognito), multi-user support, usage tracking |
| 7 | Summarization options (user-configurable: verbatim/tldr/executive/condensed) |
| 8 | Safari extension, Android app |
| 9 | Voice selection UI (10+ voices), Piper offline fallback |
| 10 | Polish, bug fixes, TestFlight beta launch |

**V1 Features:**
- ✅ All MVP features
- ✅ User accounts & preferences sync
- ✅ Configurable summarization depth
- ✅ 10+ voice options (different accents, styles)
- ✅ Safari extension
- ✅ Android app
- ✅ Full offline TTS fallback (Piper)

**V1 Tech:**
- Microservices architecture
- AWS Cognito for auth
- ElastiCache for session/cache
- ~$40-60/month at 1K users

---

### Phase 2: Scale (Weeks 11-20) — Growth (10K-100K)
**Goal:** Production-ready, scalable infrastructure

| Milestone | Deliverable |
|-----------|-------------|
| Week 12 | Auto-scaling Lambda, SQS queues for async processing |
| Week 14 | Voice cloning integration (OpenVoice) - "celebrity-style" voices |
| Week 16 | Premium tier architecture (not monetized yet, but ready) |
| Week 18 | Analytics dashboard, usage metrics |
| Week 20 | Load testing, performance optimization |

**Scale Features:**
- ✅ All V1 features
- ✅ Celebrity-style voice options (with disclaimers)
- ✅ Smart content recommendations
- ✅ Cross-device sync (continue where you left off)
- ✅ Podcast-style playlists

---

### Phase 3: Product (Weeks 21-30) — Monetization Path
**Goal:** Sustainable free tier + premium options

- **Free tier:** 30 min/day audio, Edge TTS, 5 voices
- **Premium tier:** Unlimited, voice cloning, priority processing, custom voices
- **API access:** For developers/integrations

---

## TTS Strategy

### Primary: Edge TTS (Microsoft)

```python
# edge-tts library (Python)
import edge_tts
import asyncio

async def generate_audio(text: str, voice: str = "en-US-JennyNeural") -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data

# Streaming version for real-time playback
async def stream_audio(text: str, voice: str = "en-US-JennyNeural"):
    communicate = edge_tts.Communicate(text, voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]
```

**Pros:**
- Free (no API key required)
- 300+ voices, 75+ languages
- Natural prosody, SSML support
- Low latency streaming capable

**Cons:**
- Requires internet connection
- Microsoft ToS (gray area for large-scale commercial use)

### Offline Fallback: Piper

```python
# Piper TTS (runs locally)
import wave
from piper import PiperVoice

def generate_offline_audio(text: str, model_path: str = "en_US-lessac-medium.onnx") -> bytes:
    voice = PiperVoice.load(model_path)
    audio_bytes = b""
    for audio_chunk in voice.synthesize_stream_raw(text):
        audio_bytes += audio_chunk
    return audio_bytes
```

**Pros:**
- Fully offline (works on commute with no signal)
- Open-source (MIT license)
- Fast (~10x real-time on CPU)
- Small models (20-80MB)

**Cons:**
- Quality slightly below Edge TTS
- Limited voice variety (but growing)

### Future: OpenVoice (Voice Cloning)

```python
# OpenVoice for celebrity-style voices
from openvoice import se_extractor
from openvoice.api import ToneColorConverter

# Extract speaker embedding from reference audio
source_se = se_extractor.get_se("reference_voice.wav", tone_color_converter, vad=True)

# Apply voice characteristics to any TTS output
tone_color_converter.convert(
    audio_src_path="base_tts_output.wav",
    src_se=base_speaker_se,
    tgt_se=source_se,  # Target voice characteristics
    output_path="cloned_output.wav"
)
```

**Legal Note:** Voice cloning of actual celebrities carries legal risk:
- Use for personal/educational purposes only
- Add clear disclaimers ("AI-generated voice inspired by...")
- Consider creating "celebrity-style" generic voices instead
- Never impersonate for commercial or deceptive purposes

### Voice Selection Options

| Voice Type | Source | Voice ID | Character |
|------------|--------|----------|-----------|
| Professional Female | Edge TTS | en-US-JennyNeural | Warm, clear |
| Professional Male | Edge TTS | en-US-GuyNeural | Authoritative |
| Conversational Female | Edge TTS | en-US-AriaNeural | Friendly |
| British Female | Edge TTS | en-GB-SoniaNeural | Elegant |
| British Male | Edge TTS | en-GB-RyanNeural | Refined |
| Australian Female | Edge TTS | en-AU-NatashaNeural | Casual |
| Narrator (Offline) | Piper | lessac-medium | Podcast-style |
| Custom Clone | OpenVoice | user-provided | User preference |

---

## Content Ingestion

### Browser Extension Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Content Script (injected on every page)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Auto-detect article content (Readability.js)     │   │
│  │ 2. If readable: show floating "🎧 Listen" button    │   │
│  │ 3. On click: extract content → send to background   │   │
│  │ 4. Display cleaned "Reader View" before playing     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Background Service Worker                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Receive content from content script              │   │
│  │ 2. Send to backend API for NLP + TTS                │   │
│  │ 3. Receive audio stream                             │   │
│  │ 4. Play via Web Audio API / HTML5 Audio             │   │
│  │ 5. Handle playback controls (play/pause/speed)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Popup UI                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Play / Pause / Stop controls                      │   │
│  │ • Speed slider (0.5x - 3x)                          │   │
│  │ • Voice selector dropdown                           │   │
│  │ • Summary mode toggle (verbatim/tldr/exec/condensed)│   │
│  │ • Progress indicator                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Detection Logic

```javascript
// content-detector.ts (extension content script)
import { Readability, isProbablyReaderable } from '@mozilla/readability';

interface ArticleContent {
  title: string;
  content: string;
  textContent: string;
  wordCount: number;
  estimatedListenTime: number; // in minutes
  siteName: string | null;
}

function detectReadableContent(): ArticleContent | null {
  // Skip non-article pages
  if (!isProbablyReaderable(document)) {
    return null;
  }

  // Clone document to avoid modifying the original
  const documentClone = document.cloneNode(true) as Document;
  const article = new Readability(documentClone).parse();

  if (!article || !article.textContent) {
    return null;
  }

  const wordCount = article.textContent.split(/\s+/).length;

  // Skip very short content (likely not an article)
  if (wordCount < 100) {
    return null;
  }

  return {
    title: article.title,
    content: article.content,           // HTML
    textContent: article.textContent,   // Plain text
    wordCount,
    estimatedListenTime: Math.ceil(wordCount / 150), // ~150 wpm for TTS
    siteName: article.siteName,
  };
}

// Show listen button if content detected
function showListenButton(article: ArticleContent) {
  const button = document.createElement('div');
  button.id = 'tts-listen-button';
  button.innerHTML = `🎧 Listen (${article.estimatedListenTime} min)`;
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: #007AFF;
    color: white;
    border-radius: 25px;
    cursor: pointer;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  button.onclick = () => sendToBackground(article);
  document.body.appendChild(button);
}
```

### Email Ingestion (Gmail API)

```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from typing import List, Optional
from dataclasses import dataclass
import re

@dataclass
class EmailContent:
    sender_name: str
    sender_email: str
    subject: str
    body: str
    received_at: str

class GmailIngester:
    # Labels that typically contain newsletters
    NEWSLETTER_LABELS = ['CATEGORY_UPDATES', 'CATEGORY_FORUMS']

    # Patterns to identify promotional/skip content
    SKIP_SENDERS = ['noreply@', 'no-reply@', 'mailer-daemon']
    PROMO_PATTERNS = [
        r'unsubscribe',
        r'view\s+(this\s+)?(email\s+)?in\s+(your\s+)?browser',
        r'privacy\s+policy',
        r'terms\s+(of|and)\s+(service|use)',
        r'manage\s+(your\s+)?preferences',
        r'update\s+(your\s+)?subscription',
        r'©\s*\d{4}',
        r'all\s+rights\s+reserved',
    ]

    def __init__(self, credentials: Credentials):
        self.service = build('gmail', 'v1', credentials=credentials)

    async def fetch_newsletters(self, max_results: int = 10) -> List[EmailContent]:
        """Fetch recent newsletter emails"""
        results = self.service.users().messages().list(
            userId='me',
            labelIds=['UNREAD'] + self.NEWSLETTER_LABELS,
            maxResults=max_results
        ).execute()

        emails = []
        for msg in results.get('messages', []):
            email = await self._parse_email(msg['id'])
            if email and not self._should_skip(email):
                emails.append(email)

        return emails

    def _clean_body(self, html_body: str) -> str:
        """Remove promotional content from email body"""
        from trafilatura import extract
        text = extract(html_body) or ""

        # Remove promotional patterns
        for pattern in self.PROMO_PATTERNS:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def format_announcement(self, email: EmailContent) -> str:
        """Create spoken announcement for email"""
        return f"Email from {email.sender_name}. Subject: {email.subject}. "
```

---

## NLP Pipeline

### Content Cleaning Service

```python
from trafilatura import extract
from bs4 import BeautifulSoup
import re
from typing import Optional

class ContentCleaner:
    """Clean and prepare content for TTS"""

    # Patterns to remove (promotional, navigation, etc.)
    REMOVE_PATTERNS = [
        r'subscribe\s+(to|for|now)',
        r'(un)?subscribe',
        r'sign\s+up\s+(for|to)',
        r'privacy\s+policy',
        r'terms\s+(of|and)\s+(service|use)',
        r'follow\s+us\s+on',
        r'share\s+(this|on)\s+(twitter|facebook|linkedin)',
        r'related\s+(articles?|posts?|stories)',
        r'(read\s+)?more\s+(articles?|stories)',
        r'comments?\s*\(\d+\)',
        r'advertisement',
        r'sponsored\s+content',
        r'partner\s+content',
        r'©\s*\d{4}',
        r'all\s+rights\s+reserved',
        r'cookie\s+(policy|preferences)',
        r'we\s+use\s+cookies',
    ]

    # Elements to strip from HTML
    STRIP_TAGS = ['script', 'style', 'nav', 'header', 'footer', 'aside',
                  'advertisement', 'social-share', 'comments', 'related']

    def clean(self, html: str, source_url: Optional[str] = None) -> str:
        """Main cleaning pipeline"""
        # Step 1: Extract main content
        text = extract(
            html,
            include_comments=False,
            include_tables=False,
            include_images=False,
            url=source_url
        )

        if not text:
            # Fallback: BeautifulSoup extraction
            text = self._fallback_extract(html)

        # Step 2: Remove promotional patterns
        text = self._remove_promo_content(text)

        # Step 3: Clean up formatting
        text = self._normalize_text(text)

        return text

    def _remove_promo_content(self, text: str) -> str:
        """Remove promotional and boilerplate content"""
        for pattern in self.REMOVE_PATTERNS:
            text = re.sub(
                rf'[^.]*{pattern}[^.]*\.?\s*',
                '',
                text,
                flags=re.IGNORECASE
            )
        return text

    def _normalize_text(self, text: str) -> str:
        """Normalize whitespace and formatting"""
        # Collapse multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Collapse multiple spaces
        text = re.sub(r' {2,}', ' ', text)
        # Remove leading/trailing whitespace per line
        text = '\n'.join(line.strip() for line in text.split('\n'))
        return text.strip()

    def _fallback_extract(self, html: str) -> str:
        """Fallback extraction using BeautifulSoup"""
        soup = BeautifulSoup(html, 'html.parser')

        # Remove unwanted elements
        for tag in self.STRIP_TAGS:
            for element in soup.find_all(tag):
                element.decompose()

        # Try to find main content
        main = soup.find('main') or soup.find('article') or soup.find('body')
        return main.get_text(separator='\n') if main else ""
```

### Summarization Service

```python
from transformers import pipeline
from typing import Literal
from functools import lru_cache

SummaryMode = Literal['verbatim', 'tldr', 'executive', 'condensed']

class Summarizer:
    """Configurable summarization for TTS content"""

    def __init__(self, model_name: str = "facebook/bart-large-cnn"):
        self._model = None
        self._model_name = model_name

    @property
    def model(self):
        """Lazy load model"""
        if self._model is None:
            self._model = pipeline("summarization", model=self._model_name)
        return self._model

    def summarize(self, text: str, mode: SummaryMode = "verbatim") -> str:
        """Summarize text based on user preference"""
        if mode == "verbatim":
            return text

        word_count = len(text.split())

        # Configure based on mode
        config = {
            'tldr': {
                'max_length': 60,
                'min_length': 20,
                'description': '1-2 sentence summary'
            },
            'executive': {
                'max_length': 150,
                'min_length': 50,
                'description': '1 paragraph summary'
            },
            'condensed': {
                'max_length': max(100, int(word_count * 0.3)),
                'min_length': max(50, int(word_count * 0.2)),
                'description': '~30% of original'
            }
        }

        settings = config.get(mode, config['verbatim'])

        # Skip summarization for short content
        if word_count < settings['min_length'] * 2:
            return text

        # Chunk long text (BART has 1024 token limit)
        if word_count > 800:
            return self._summarize_long_text(text, settings)

        result = self.model(
            text,
            max_length=settings['max_length'],
            min_length=settings['min_length'],
            do_sample=False
        )

        return result[0]['summary_text']

    def _summarize_long_text(self, text: str, settings: dict) -> str:
        """Handle long text by chunking"""
        # Split into ~600 word chunks with overlap
        words = text.split()
        chunks = []
        chunk_size = 600
        overlap = 50

        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            chunks.append(chunk)

        # Summarize each chunk
        summaries = []
        for chunk in chunks:
            result = self.model(
                chunk,
                max_length=settings['max_length'] // len(chunks) + 50,
                min_length=20,
                do_sample=False
            )
            summaries.append(result[0]['summary_text'])

        return ' '.join(summaries)
```

### TTS-Optimized Text Formatter

```python
import re
from typing import List

class ProsodyFormatter:
    """Prepare text for natural-sounding TTS output"""

    def format(self, text: str) -> str:
        """Apply all formatting rules"""
        text = self._expand_abbreviations(text)
        text = self._handle_numbers(text)
        text = self._handle_urls(text)
        text = self._add_pauses(text)
        text = self._handle_lists(text)
        text = self._clean_for_speech(text)
        return text

    def _expand_abbreviations(self, text: str) -> str:
        """Expand common abbreviations for natural speech"""
        expansions = {
            r'\be\.g\.': 'for example',
            r'\bi\.e\.': 'that is',
            r'\betc\.': 'and so on',
            r'\bvs\.?': 'versus',
            r'\bw/': 'with',
            r'\bw/o': 'without',
            r'\baka': 'also known as',
            r'\basap': 'as soon as possible',
            r'\bFYI': 'for your information',
            r'\bIMO': 'in my opinion',
            r'\bTL;?DR': 'in summary',
        }
        for pattern, replacement in expansions.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        return text

    def _handle_numbers(self, text: str) -> str:
        """Format numbers for speech"""
        # Currency
        text = re.sub(r'\$(\d+(?:,\d{3})*(?:\.\d{2})?)', r'\1 dollars', text)
        text = re.sub(r'€(\d+(?:,\d{3})*(?:\.\d{2})?)', r'\1 euros', text)

        # Percentages
        text = re.sub(r'(\d+(?:\.\d+)?)\s*%', r'\1 percent', text)

        # Large numbers (add commas for clarity - TTS handles this)
        # Dates are usually handled well by TTS

        return text

    def _handle_urls(self, text: str) -> str:
        """Replace URLs with spoken indicator"""
        # Full URLs -> [link]
        text = re.sub(r'https?://\S+', '[link]', text)
        # Email addresses
        text = re.sub(r'\S+@\S+\.\S+', '[email]', text)
        return text

    def _add_pauses(self, text: str) -> str:
        """Add pause markers for natural rhythm"""
        # Longer pause after headers/titles (marked by being on own line)
        text = re.sub(r'^(.{1,80})$\n', r'\1...\n', text, flags=re.MULTILINE)

        # Pause before "however", "therefore", etc.
        transition_words = ['however', 'therefore', 'furthermore', 'moreover',
                          'nevertheless', 'consequently', 'meanwhile']
        for word in transition_words:
            text = re.sub(
                rf'([.!?])\s+({word})',
                rf'\1 ... \2',
                text,
                flags=re.IGNORECASE
            )

        return text

    def _handle_lists(self, text: str) -> str:
        """Format lists for clear speech"""
        # Bullet points
        text = re.sub(r'^[-*•]\s+', 'Item: ', text, flags=re.MULTILINE)
        # Numbered lists
        text = re.sub(r'^(\d+)[.)]\s+', r'Number \1: ', text, flags=re.MULTILINE)
        return text

    def _clean_for_speech(self, text: str) -> str:
        """Final cleanup for TTS"""
        # Remove markdown formatting
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # Bold
        text = re.sub(r'\*(.+?)\*', r'\1', text)      # Italic
        text = re.sub(r'`(.+?)`', r'\1', text)        # Code

        # Remove excessive punctuation
        text = re.sub(r'[!?]{2,}', '!', text)
        text = re.sub(r'\.{4,}', '...', text)

        return text

    def chunk_for_streaming(self, text: str, max_chars: int = 500) -> List[str]:
        """Split text into chunks for streaming TTS"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_chunk = ""

        for sentence in sentences:
            if len(current_chunk) + len(sentence) < max_chars:
                current_chunk += sentence + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + " "

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks
```

---

## Non-Functional Requirements

### Latency Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Content detection | < 100ms | Client-side Readability.js |
| Content extraction | < 500ms | Readability.js + Trafilatura |
| Content cleaning | < 200ms | Regex + rules (no ML) |
| Summarization | < 2s | BART on Lambda (CPU) or skip |
| TTS first byte | < 1s | Edge TTS streaming |
| Full article audio | < 5s | Parallel chunk processing |

### Architecture for Low Latency

```
Streaming Pipeline (Real-time):
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │───▶│  Clean   │───▶│  Chunk   │───▶│   TTS    │
│  Request │    │  Content │    │   Text   │    │  Stream  │
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                      │
                    ┌─────────────────────────────────┘
                    │ Audio chunks streamed back immediately
                    ▼
            ┌──────────────┐
            │   Playback   │ (starts within 1s)
            └──────────────┘
```

### Cost Analysis

```
MVP Monthly Estimate (Personal Use - You Only):
├── AWS Lambda:        $0-5  (fits in free tier: 1M requests/month)
├── API Gateway:       $0-3  (fits in free tier: 1M requests/month)
├── S3 Storage:        $1-2  (5GB with 24h TTL)
├── CloudFront:        $2-5  (50GB transfer)
├── ElastiCache:       $0    (skip for MVP, use Lambda /tmp)
├── Cognito:           $0    (skip for MVP)
└── Total:             ~$5-15/month

V1 Monthly Estimate (1K Active Users):
├── Lambda:            ~$10-15  (assuming 100 articles/user/month)
├── API Gateway:       ~$5-8
├── S3 + CloudFront:   ~$15-20
├── ElastiCache:       ~$15     (t3.micro)
├── Cognito:           ~$0      (50K MAU free)
└── Total:             ~$45-60/month ✓ Within budget

Scale Estimate (100K Users):
├── Lambda:            ~$150-200
├── API Gateway:       ~$100-150
├── S3 + CloudFront:   ~$200-300
├── ElastiCache:       ~$100    (t3.medium cluster)
├── Cognito:           ~$50
└── Total:             ~$600-800/month
```

### Privacy & Security

| Concern | Implementation |
|---------|----------------|
| Email content | Process in Lambda, never persisted, deleted after TTS generation |
| Article content | Processed ephemerally, only audio cached (24h TTL) |
| Audio files | S3 with user-specific prefixes, 24h auto-delete |
| OAuth tokens | Stored encrypted in Cognito, rotated regularly |
| User data | Minimal collection: email (for auth), preferences only |
| API access | Rate limiting: 100 req/min per user, JWT authentication |
| Data in transit | TLS 1.3 everywhere |

### Offline Strategy

```
Mobile App Offline Architecture:
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                        │
├─────────────────────────────────────────────────────────────┤
│  Online Mode:                                                │
│  ├── Fetch articles via API                                 │
│  ├── Stream audio from Edge TTS (backend)                   │
│  └── Cache audio locally (up to 100MB)                      │
│                                                             │
│  Offline Mode:                                              │
│  ├── Play cached audio (previously downloaded)              │
│  ├── OR: Process new text with Piper TTS (on-device)       │
│  │       └── Piper model embedded in app (~50MB)            │
│  └── Queue articles for processing when online              │
├─────────────────────────────────────────────────────────────┤
│  Storage Management:                                         │
│  ├── Max cache: 100MB (~60-90 min of audio)                 │
│  ├── LRU eviction for old content                           │
│  └── User can pin important items                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Browser Extension & Mobile App Details

### Extension API Communication

```typescript
// extension/src/services/api.ts

interface TTSRequest {
  content: string;
  title: string;
  url: string;
  options: {
    voice: string;
    speed: number;
    summaryMode: 'verbatim' | 'tldr' | 'executive' | 'condensed';
  };
}

interface TTSResponse {
  audioUrl?: string;        // For cached audio
  streamUrl?: string;       // For streaming
  estimatedDuration: number;
  wordCount: number;
}

const API_BASE = process.env.API_URL || 'https://api.tts-assistant.com';

export async function requestTTS(request: TTSRequest): Promise<TTSResponse> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE}/v1/tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  return response.json();
}

export async function streamTTS(request: TTSRequest): Promise<ReadableStream<Uint8Array>> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE}/v1/tts/stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.body) {
    throw new Error('Streaming not supported');
  }

  return response.body;
}
```

### Mobile App Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                        │
├─────────────────────────────────────────────────────────────┤
│  Navigation (React Navigation)                              │
│  ├── HomeScreen (Queue of articles/emails to listen)        │
│  ├── PlayerScreen (Now Playing with controls)               │
│  ├── SettingsScreen (Voice, speed, summary preferences)     │
│  └── AccountScreen (Gmail connection, usage stats)          │
├─────────────────────────────────────────────────────────────┤
│  Core Services                                              │
│  ├── AudioService (react-native-track-player)               │
│  │   ├── Background playback                                │
│  │   ├── Lock screen controls                               │
│  │   ├── Variable speed (0.5x-3x)                           │
│  │   └── Seek, skip, chapter markers                        │
│  ├── OfflineService                                         │
│  │   ├── AsyncStorage (metadata, preferences)               │
│  │   ├── FileSystem (cached audio files)                    │
│  │   └── PiperBridge (native module for offline TTS)        │
│  ├── APIService (REST client to backend)                    │
│  └── SyncService (background fetch for new content)         │
├─────────────────────────────────────────────────────────────┤
│  Native Modules                                             │
│  ├── PiperTTS (C++ via JSI for on-device TTS)              │
│  ├── ShareExtension (iOS) / ShareIntent (Android)           │
│  └── BackgroundFetch (periodic content sync)                │
├─────────────────────────────────────────────────────────────┤
│  State Management (Zustand or Redux Toolkit)                │
│  ├── playerSlice (current track, playback state)            │
│  ├── queueSlice (list of items to play)                     │
│  ├── settingsSlice (voice, speed, summary mode)             │
│  └── authSlice (user session, Gmail tokens)                 │
└─────────────────────────────────────────────────────────────┘
```

### iOS Share Extension

```swift
// ios/ShareExtension/ShareViewController.swift
import UIKit
import Social
import MobileCoreServices

class ShareViewController: SLComposeServiceViewController {

    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }

        for attachment in attachments {
            // Handle URLs (shared from Safari, Chrome, etc.)
            if attachment.hasItemConformingToTypeIdentifier(kUTTypeURL as String) {
                attachment.loadItem(forTypeIdentifier: kUTTypeURL as String, options: nil) { (item, error) in
                    if let url = item as? URL {
                        self.sendToMainApp(url: url)
                    }
                }
            }

            // Handle plain text (selected text)
            if attachment.hasItemConformingToTypeIdentifier(kUTTypePlainText as String) {
                attachment.loadItem(forTypeIdentifier: kUTTypePlainText as String, options: nil) { (item, error) in
                    if let text = item as? String {
                        self.sendToMainApp(text: text)
                    }
                }
            }
        }
    }

    private func sendToMainApp(url: URL? = nil, text: String? = nil) {
        // Use App Groups to share data with main app
        let sharedDefaults = UserDefaults(suiteName: "group.com.tts-assistant")

        var queue = sharedDefaults?.array(forKey: "pendingItems") as? [[String: Any]] ?? []

        let newItem: [String: Any] = [
            "id": UUID().uuidString,
            "url": url?.absoluteString ?? "",
            "text": text ?? "",
            "addedAt": Date().timeIntervalSince1970
        ]

        queue.append(newItem)
        sharedDefaults?.set(queue, forKey: "pendingItems")

        self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }
}
```

---

## Project File Structure

```
personal-tts-assistant/
├── backend/
│   ├── services/
│   │   ├── content/                 # Content extraction & cleaning
│   │   │   ├── __init__.py
│   │   │   ├── extractor.py         # Readability/Trafilatura wrapper
│   │   │   ├── cleaner.py           # Content cleaning pipeline
│   │   │   ├── gmail.py             # Gmail API integration
│   │   │   └── filters.py           # Smart filtering rules
│   │   ├── processing/              # NLP & summarization
│   │   │   ├── __init__.py
│   │   │   ├── summarizer.py        # BART/T5 summarization
│   │   │   ├── formatter.py         # TTS-optimized formatting
│   │   │   └── chunker.py           # Text chunking for streaming
│   │   └── audio/                   # TTS generation
│   │       ├── __init__.py
│   │       ├── edge_tts.py          # Edge TTS integration
│   │       ├── piper_tts.py         # Piper offline TTS
│   │       ├── voice_clone.py       # OpenVoice integration (future)
│   │       └── post_process.py      # Speed/pitch adjustment
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI application
│   │   ├── routes/
│   │   │   ├── tts.py               # TTS endpoints
│   │   │   ├── content.py           # Content processing endpoints
│   │   │   ├── auth.py              # Authentication endpoints
│   │   │   └── gmail.py             # Gmail webhook endpoints
│   │   ├── middleware/
│   │   │   ├── auth.py              # JWT validation
│   │   │   └── rate_limit.py        # Rate limiting
│   │   └── schemas/                 # Pydantic models
│   ├── infrastructure/
│   │   ├── terraform/               # AWS infrastructure as code
│   │   │   ├── main.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api_gateway.tf
│   │   │   ├── s3.tf
│   │   │   └── variables.tf
│   │   └── docker/
│   │       ├── Dockerfile.api
│   │       └── docker-compose.yml   # Local development
│   ├── tests/
│   │   ├── test_extractor.py
│   │   ├── test_cleaner.py
│   │   ├── test_summarizer.py
│   │   └── test_tts.py
│   ├── requirements.txt
│   └── pyproject.toml
├── extension/
│   ├── src/
│   │   ├── content/                 # Content scripts (injected)
│   │   │   ├── detector.ts          # Auto-detect readable content
│   │   │   ├── extractor.ts         # Extract article content
│   │   │   └── ui.ts                # Floating listen button
│   │   ├── background/              # Service worker
│   │   │   ├── index.ts
│   │   │   ├── audio-player.ts      # Web Audio API playback
│   │   │   └── api-client.ts        # Backend communication
│   │   ├── popup/                   # Extension popup UI
│   │   │   ├── App.tsx
│   │   │   ├── Player.tsx
│   │   │   └── Settings.tsx
│   │   ├── options/                 # Options page
│   │   │   └── Options.tsx
│   │   └── lib/                     # Shared utilities
│   │       ├── readability.ts       # Readability.js wrapper
│   │       ├── storage.ts           # Chrome storage helpers
│   │       └── types.ts             # TypeScript types
│   ├── public/
│   │   ├── icons/
│   │   └── _locales/
│   ├── manifest.json                # Extension manifest (v3)
│   ├── package.json
│   ├── tsconfig.json
│   └── webpack.config.js
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx       # Queue of items
│   │   │   ├── PlayerScreen.tsx     # Now playing
│   │   │   ├── SettingsScreen.tsx   # Preferences
│   │   │   └── AccountScreen.tsx    # Auth & usage
│   │   ├── components/
│   │   │   ├── ArticleCard.tsx
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── SpeedSlider.tsx
│   │   │   └── VoiceSelector.tsx
│   │   ├── services/
│   │   │   ├── AudioService.ts      # Track player wrapper
│   │   │   ├── APIService.ts        # Backend client
│   │   │   ├── OfflineService.ts    # Cache management
│   │   │   └── SyncService.ts       # Background sync
│   │   ├── native/
│   │   │   └── PiperTTS.ts          # Native module bridge
│   │   ├── store/
│   │   │   ├── index.ts
│   │   │   ├── playerSlice.ts
│   │   │   ├── queueSlice.ts
│   │   │   └── settingsSlice.ts
│   │   └── navigation/
│   │       └── AppNavigator.tsx
│   ├── ios/
│   │   ├── TTSAssistant/
│   │   ├── ShareExtension/          # iOS share extension
│   │   └── Podfile
│   ├── android/
│   │   └── app/
│   ├── package.json
│   └── metro.config.js
├── shared/
│   ├── types/                       # Shared TypeScript types
│   │   ├── api.ts
│   │   ├── content.ts
│   │   └── audio.ts
│   └── constants/
│       └── voices.ts                # Voice configurations
├── docs/
│   ├── plan.md                      # This document
│   ├── api-spec.yaml                # OpenAPI specification
│   └── architecture-diagrams/       # Visual diagrams
└── README.md
```

---

## Immediate Next Steps

### Week 1 Sprint Tasks

1. **Day 1-2: Project Setup**
   - [ ] Initialize monorepo structure
   - [ ] Set up Python backend with FastAPI
   - [ ] Configure AWS Lambda deployment (SAM or Serverless Framework)
   - [ ] Set up basic CI/CD (GitHub Actions)

2. **Day 3-4: Core TTS Pipeline**
   - [ ] Implement Edge TTS integration
   - [ ] Build content extraction (Trafilatura + Readability)
   - [ ] Create cleaning pipeline with smart filters
   - [ ] Test end-to-end: URL → clean text → audio

3. **Day 5-6: Browser Extension MVP**
   - [ ] Chrome extension scaffolding (Manifest V3)
   - [ ] Content detection script (Readability.js)
   - [ ] Floating "Listen" button UI
   - [ ] Basic popup with play/pause

4. **Day 7: Integration Testing**
   - [ ] Test on 10 real articles (Medium, Substack, news sites)
   - [ ] Measure latency metrics
   - [ ] Fix edge cases in content extraction

### Key Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary TTS | Edge TTS | Free, high quality, streaming support |
| Offline TTS | Piper | MIT license, fast, small models |
| Backend Language | Python | Best NLP/ML ecosystem |
| Backend Framework | FastAPI | Async, fast, great docs |
| Cloud Provider | AWS | Lambda + S3 cost-effective |
| Mobile Framework | React Native | Code sharing, mature ecosystem |
| State Management | Zustand | Simple, lightweight |
| Auth | AWS Cognito | Managed, free tier generous |

### Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Edge TTS rate limits | Medium | High | Implement caching, queue processing |
| Edge TTS ToS issues | Low | High | Piper fallback ready, explore Azure pricing |
| Voice cloning legal | Medium | Medium | Use "inspired by" voices, clear disclaimers |
| Gmail API quotas | Low | Medium | Request quota increase, implement backoff |
| App Store rejection | Low | Medium | Clear privacy policy, minimal permissions |
| Content extraction failures | Medium | Low | Multiple extractors, graceful fallbacks |

---

## Success Metrics

### MVP (Week 4)
- [ ] Successfully process 10 articles/day for personal use
- [ ] Audio quality subjectively rated 4/5+
- [ ] Offline playback works during 30-min commute
- [ ] End-to-end latency < 5s for average article (2000 words)
- [ ] Monthly AWS cost < $20

### V1 (Week 10)
- [ ] 100 beta users onboarded
- [ ] < 2% error rate in content processing
- [ ] Monthly cost < $60 at 1K users
- [ ] NPS > 40 from beta users
- [ ] App Store approval (iOS)

---

*Document Version: 1.0*
*Created: 2025-01-25*
*Author: AI Systems Architect*
