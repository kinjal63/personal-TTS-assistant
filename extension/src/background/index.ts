import { generateChunks, getChunksInfo, base64ToArrayBuffer } from './api-client';
import { ArticleContent, MessageType, PlayerState, Settings } from '../lib/types';

let currentArticle: ArticleContent | null = null;
let currentSettings: Settings = { voice: 'en-US-JennyNeural', speed: 1.0 };
let audioState = { isPlaying: false, progress: 0, duration: 0 };

// Chunked playback state
let currentText: string = '';
let totalChunks: number = 0;
let pendingChunkGeneration: boolean = false;

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

// Broadcast state to all tabs
function broadcastState() {
  const state: PlayerState = {
    isPlaying: audioState.isPlaying,
    progress: audioState.progress,
    duration: audioState.duration,
    article: currentArticle,
  };

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'STATE_UPDATE',
          payload: state,
        } as MessageType).catch(() => {
          // Tab might not have content script
        });
      }
    });
  });
}

// Generate and send chunks to offscreen document
async function generateAndQueueChunks(chunkIndices: number[]): Promise<void> {
  if (pendingChunkGeneration || chunkIndices.length === 0) return;

  pendingChunkGeneration = true;
  console.log(`[TTS Background] Generating chunks: ${chunkIndices.join(', ')}`);

  try {
    const response = await generateChunks(
      currentText,
      currentSettings.voice,
      currentSettings.speed,
      chunkIndices
    );

    // Convert base64 audio to arrays and send to offscreen
    const chunks = response.generated_chunks.map((chunk) => ({
      index: chunk.index,
      audioData: Array.from(new Uint8Array(base64ToArrayBuffer(chunk.audio_base64))),
    }));

    await chrome.runtime.sendMessage({
      type: 'ADD_CHUNKS',
      payload: { chunks },
    });

    console.log(`[TTS Background] Sent ${chunks.length} chunks to offscreen`);
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
    for (let i = startIndex; i < Math.min(startIndex + count, totalChunks); i++) {
      indices.push(i);
    }
    if (indices.length > 0) {
      generateAndQueueChunks(indices);
    }
    return false;
  }

  console.log('[TTS Background] Received message:', message.type);

  switch (message.type) {
    case 'CONTENT_DETECTED': {
      const msg = message as { type: 'CONTENT_DETECTED'; payload: ArticleContent };
      currentArticle = msg.payload;
      console.log('[TTS Background] Content detected:', currentArticle?.title);
      sendResponse({ success: true });
      break;
    }

    case 'PLAY': {
      const msg = message as { type: 'PLAY'; payload: { article: ArticleContent; settings: Settings } };
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
      currentText = '';
      totalChunks = 0;
      sendResponse({ success: true });
      break;

    case 'GET_STATE':
      const state: PlayerState = {
        isPlaying: audioState.isPlaying,
        progress: audioState.progress,
        duration: audioState.duration,
        article: currentArticle,
      };
      sendResponse(state);
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return false;
});

async function handlePlay(article: ArticleContent, settings: Settings): Promise<void> {
  currentArticle = article;
  currentSettings = settings;
  currentText = article.textContent;

  console.log('[TTS Background] Starting chunked playback for:', article.title);

  try {
    // Get chunk info first
    const chunksInfo = await getChunksInfo(article.textContent);
    totalChunks = chunksInfo.total_chunks;

    console.log(`[TTS Background] Content split into ${totalChunks} chunks, estimated ${chunksInfo.estimated_duration_seconds.toFixed(0)}s`);

    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    // Initialize chunked playback in offscreen
    await chrome.runtime.sendMessage({
      type: 'INIT_CHUNKED_PLAYBACK',
      payload: {
        totalChunks,
        estimatedDuration: chunksInfo.estimated_duration_seconds,
        speed: settings.speed,
      },
    });

    // Generate first 2 chunks immediately for fast start
    const firstChunkIndices = [];
    for (let i = 0; i < Math.min(2, totalChunks); i++) {
      firstChunkIndices.push(i);
    }

    await generateAndQueueChunks(firstChunkIndices);

    console.log('[TTS Background] Initial chunks queued, playback starting...');
  } catch (error) {
    console.error('[TTS Background] Failed to start chunked playback:', error);
    throw error;
  }
}

// Log when service worker starts
console.log('[TTS Background] Service worker started (chunked playback enabled)');
