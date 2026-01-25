import { generateTTS } from './api-client';
import { audioPlayer } from './audio-player';
import { ArticleContent, MessageType, PlayerState, Settings } from '../lib/types';

let currentArticle: ArticleContent | null = null;
let currentSettings: Settings = { voice: 'en-US-JennyNeural', speed: 1.0 };

// Set up state change callback
audioPlayer.setStateChangeCallback((audioState) => {
  const state: PlayerState = {
    isPlaying: audioState.isPlaying,
    progress: audioState.progress,
    duration: audioState.duration,
    article: currentArticle,
  };

  // Broadcast state to all tabs
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
});

// Handle messages
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  console.log('[TTS Background] Received message:', message.type);

  switch (message.type) {
    case 'CONTENT_DETECTED':
      currentArticle = message.payload;
      console.log('[TTS Background] Content detected:', currentArticle?.title);
      sendResponse({ success: true });
      break;

    case 'PLAY':
      handlePlay(message.payload.article, message.payload.settings)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'PAUSE':
      audioPlayer.pause();
      sendResponse({ success: true });
      break;

    case 'STOP':
      audioPlayer.stop();
      currentArticle = null;
      sendResponse({ success: true });
      break;

    case 'GET_STATE':
      const audioState = audioPlayer.getState();
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

  console.log('[TTS Background] Generating audio for:', article.title);

  try {
    const audioData = await generateTTS({
      text: article.textContent,
      voice: settings.voice,
      speed: settings.speed,
    });

    console.log('[TTS Background] Audio generated, size:', audioData.byteLength);

    await audioPlayer.play(audioData);
    audioPlayer.setSpeed(settings.speed);
  } catch (error) {
    console.error('[TTS Background] Failed to generate audio:', error);
    throw error;
  }
}

// Log when service worker starts
console.log('[TTS Background] Service worker started');
