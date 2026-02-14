import { generateAudioForChunk } from './api-client';
import { ArticleContent, EmailContent, MessageType, PlayerState, Settings } from '../lib/types';
import { chunkText, estimateDuration, TextChunk } from '../lib/text-chunker';

let currentArticle: ArticleContent | null = null;
let currentSettings: Settings = { voice: 'en-US-JennyNeural', speed: 1.0 };
let audioState = { isPlaying: false, progress: 0, duration: 0 };

// Tab session tracking
let playbackSourceTabId: number | null = null;
let playbackSourceUrl: string | null = null;

// Chunked playback state - now using frontend chunking
let textChunks: TextChunk[] = [];
let pendingChunkGeneration: boolean = false;

// Audio buffer cache - avoids regenerating chunks that were already generated
const audioBufferCache: Map<number, ArrayBuffer> = new Map();

// Offscreen document management
let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Playing TTS audio in background',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

// Broadcast state to all tabs AND the popup/extension context
function broadcastState() {
  const state: PlayerState = {
    isPlaying: audioState.isPlaying,
    progress: audioState.progress,
    duration: audioState.duration,
    article: currentArticle,
    sourceTabId: playbackSourceTabId,
    sourceUrl: playbackSourceUrl,
  };

  const message = {
    type: 'STATE_UPDATE',
    payload: state,
  } as MessageType;

  // Send to all tabs (content scripts)
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script
        });
      }
    });
  });

  // Also send to extension context (popup, other extension pages)
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might not be open
  });
}

// Generate and send chunks to offscreen document using frontend-chunked text
async function generateAndQueueChunks(chunkIndices: number[]): Promise<void> {
  if (pendingChunkGeneration || chunkIndices.length === 0) return;

  pendingChunkGeneration = true;
  console.log(`[TTS Background] Generating chunks: ${chunkIndices.join(', ')}`);

  try {
    const chunks: Array<{ index: number; audioData: number[] }> = [];

    // Generate audio for each chunk directly (faster than sending all text to backend)
    for (const idx of chunkIndices) {
      if (idx >= 0 && idx < textChunks.length) {
        let audioBuffer: ArrayBuffer;

        // Check cache first
        if (audioBufferCache.has(idx)) {
          audioBuffer = audioBufferCache.get(idx)!;
          console.log(`[TTS Background] Using cached audio for chunk ${idx}`);
        } else {
          const chunk = textChunks[idx];
          console.log(`[TTS Background] Generating audio for chunk ${idx} (${chunk.wordCount} words)`);

          audioBuffer = await generateAudioForChunk(
            chunk.text,
            currentSettings.voice,
            currentSettings.speed
          );

          // Cache the generated audio
          audioBufferCache.set(idx, audioBuffer);
          console.log(`[TTS Background] Cached chunk ${idx}, cache size: ${audioBufferCache.size}`);
        }

        chunks.push({
          index: idx,
          audioData: Array.from(new Uint8Array(audioBuffer)),
        });
      }
    }

    if (chunks.length > 0) {
      await chrome.runtime.sendMessage({
        type: 'ADD_CHUNKS',
        payload: { chunks },
      });
      console.log(`[TTS Background] Sent ${chunks.length} chunks to offscreen`);
    }
  } catch (error) {
    console.error('[TTS Background] Failed to generate chunks:', error);
  } finally {
    pendingChunkGeneration = false;
  }
}

// Handle messages
chrome.runtime.onMessage.addListener((message: MessageType | { type: string; payload?: unknown }, sender, sendResponse) => {
  // Handle audio state changes from offscreen
  if (message.type === 'AUDIO_STATE_CHANGE') {
    audioState = message.payload as typeof audioState;
    broadcastState();
    return false;
  }

  // Handle chunk requests from offscreen
  if (message.type === 'NEED_MORE_CHUNKS') {
    const { startIndex, count } = message.payload as { startIndex: number; count: number };
    const indices = [];
    for (let i = startIndex; i < Math.min(startIndex + count, textChunks.length); i++) {
      indices.push(i);
    }
    if (indices.length > 0) {
      generateAndQueueChunks(indices);
    }
    return false;
  }

  // Handle seek to specific chunk (for cross-chunk seeking)
  if (message.type === 'SEEK_TO_CHUNK') {
    const { chunkIndex } = message.payload as { chunkIndex: number; seekTime: number };
    console.log(`[TTS Background] Seek to chunk ${chunkIndex} requested`);

    // Force generate even if pendingChunkGeneration is true (seeking takes priority)
    pendingChunkGeneration = false;
    generateAndQueueChunks([chunkIndex]);
    return false;
  }

  console.log('[TTS Background] Received message:', message.type);

  switch (message.type) {
    case 'OPEN_POPUP':
      // Try to open the popup (requires user gesture in Manifest V3)
      try {
        chrome.action.openPopup();
        sendResponse({ success: true });
      } catch (error) {
        console.log('[TTS Background] Could not open popup:', error);
        sendResponse({ success: false, error: 'Cannot open popup automatically' });
      }
      break;

    case 'CONTENT_DETECTED': {
      const msg = message as { type: 'CONTENT_DETECTED'; payload: ArticleContent };
      currentArticle = msg.payload;
      console.log('[TTS Background] Content detected:', currentArticle?.title);
      sendResponse({ success: true });
      break;
    }

    case 'EMAIL_DETECTED': {
      const msg = message as { type: 'EMAIL_DETECTED'; payload: EmailContent };
      const email = msg.payload;

      // Convert EmailContent to ArticleContent format for compatibility with existing playback system
      currentArticle = {
        title: `Email: ${email.subject}`,
        content: email.body,
        textContent: email.textContent,
        wordCount: email.wordCount,
        estimatedListenTime: email.estimatedListenTime,
        siteName: email.sender,
        url: email.url,
      };

      console.log('[TTS Background] Email detected:', email.subject, 'from', email.sender);
      sendResponse({ success: true });
      break;
    }

    case 'PLAY': {
      const msg = message as { type: 'PLAY'; payload: { article: ArticleContent; settings: Settings } };
      const tabId = sender.tab?.id || null;

      // Track source tab for this playback
      playbackSourceTabId = tabId;
      playbackSourceUrl = msg.payload.article.url;

      handlePlay(msg.payload.article, msg.payload.settings)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'PAUSE':
      ensureOffscreenDocument().then(() => {
        chrome.runtime.sendMessage({ type: 'PAUSE_AUDIO' });
      });
      sendResponse({ success: true });
      break;

    case 'RESUME':
      ensureOffscreenDocument().then(() => {
        chrome.runtime.sendMessage({ type: 'RESUME_AUDIO' });
      });
      sendResponse({ success: true });
      break;

    case 'STOP':
      ensureOffscreenDocument().then(() => {
        chrome.runtime.sendMessage({ type: 'STOP_AUDIO' });
      });
      currentArticle = null;
      textChunks = [];
      audioBufferCache.clear(); // Clear audio cache
      console.log('[TTS Background] Cleared audio buffer cache');
      audioState = { isPlaying: false, progress: 0, duration: 0 };
      broadcastState();
      sendResponse({ success: true });
      break;

    case 'GET_STATE': {
      const state: PlayerState = {
        isPlaying: audioState.isPlaying,
        progress: audioState.progress,
        duration: audioState.duration,
        article: currentArticle,
        sourceTabId: playbackSourceTabId,
        sourceUrl: playbackSourceUrl,
      };
      sendResponse(state);
      break;
    }

    case 'UPDATE_SETTINGS': {
      const msg = message as { type: 'UPDATE_SETTINGS'; payload: Settings };
      currentSettings = { ...currentSettings, ...msg.payload };
      console.log('[TTS Background] Settings updated:', currentSettings);
      sendResponse({ success: true });
      break;
    }

    case 'SET_SPEED':
    case 'SEEK_AUDIO':
      // Forward to offscreen document
      ensureOffscreenDocument().then(() => {
        chrome.runtime.sendMessage(message);
      });
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return false;
});

async function handlePlay(article: ArticleContent, settings: Settings): Promise<void> {
  currentArticle = article;
  currentSettings = settings;

  // Clear previous cache for new content
  audioBufferCache.clear();

  console.log('[TTS Background] ==========================================');
  console.log('[TTS Background] STARTING PLAYBACK');
  console.log('[TTS Background] ==========================================');
  console.log('[TTS Background] Title:', article.title);
  console.log('[TTS Background] HTML content length:', article.content?.length || 0);
  console.log('[TTS Background] Text content length:', article.textContent?.length || 0);
  console.log('[TTS Background] HTML preview (first 300):', article.content?.substring(0, 300));
  console.log('[TTS Background] Text preview (first 300):', article.textContent?.substring(0, 300));
  console.log('[TTS Background] Text end (last 200):', article.textContent?.substring(article.textContent.length - 200));

  try {
    // IMPORTANT: Use textContent if available (already cleaned), fallback to content (HTML)
    const contentToChunk = article.textContent || article.content;
    console.log('[TTS Background] Using:', article.textContent ? 'textContent (clean)' : 'content (HTML)');
    console.log('[TTS Background] Content to chunk length:', contentToChunk.length);

    // Chunk text on the frontend (much faster than backend round-trip)
    textChunks = chunkText(contentToChunk);
    const estimatedDuration = estimateDuration(textChunks, settings.speed);

    console.log(`[TTS Background] Content split into ${textChunks.length} chunks, estimated ${estimatedDuration.toFixed(0)}s`);
    console.log('[TTS Background] First chunk preview:', textChunks[0]?.text.substring(0, 200));
    console.log('[TTS Background] Last chunk preview:', textChunks[textChunks.length - 1]?.text.substring(0, 200));
    console.log('[TTS Background] ==========================================');

    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    // Initialize chunked playback in offscreen
    await chrome.runtime.sendMessage({
      type: 'INIT_CHUNKED_PLAYBACK',
      payload: {
        totalChunks: textChunks.length,
        estimatedDuration,
        speed: settings.speed,
      },
    });

    // Generate ONLY the first chunk for fastest possible start
    // Additional chunks will be requested by offscreen as needed
    await generateAndQueueChunks([0]);

    console.log('[TTS Background] First chunk queued, playback starting...');
  } catch (error) {
    console.error('[TTS Background] Failed to start playback:', error);
    throw error;
  }
}

// Log when service worker starts
console.log('[TTS Background] Service worker started (frontend chunking enabled)');
