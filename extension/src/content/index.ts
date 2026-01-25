import { detectReadableContent } from './detector';
import { showListenButton, removeListenButton, updateButtonState } from './ui';
import { ArticleContent, MessageType } from '../lib/types';

let detectedArticle: ArticleContent | null = null;

function init() {
  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectAndShowButton);
  } else {
    // Small delay to ensure content is rendered
    setTimeout(detectAndShowButton, 500);
  }
}

function detectAndShowButton() {
  detectedArticle = detectReadableContent();

  if (detectedArticle) {
    console.log('[TTS Assistant] Readable content detected:', {
      title: detectedArticle.title,
      wordCount: detectedArticle.wordCount,
      estimatedTime: detectedArticle.estimatedListenTime,
    });

    showListenButton(detectedArticle, handleListenClick);

    // Notify background script
    chrome.runtime.sendMessage({
      type: 'CONTENT_DETECTED',
      payload: detectedArticle,
    } as MessageType);
  } else {
    console.log('[TTS Assistant] No readable content detected on this page');
    removeListenButton();
  }
}

function handleListenClick() {
  if (!detectedArticle) return;

  // Send message to background to start playing
  chrome.runtime.sendMessage({
    type: 'PLAY',
    payload: {
      article: detectedArticle,
      settings: {
        voice: 'en-US-JennyNeural',
        speed: 1.0,
      },
    },
  } as MessageType);

  updateButtonState(true);
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === 'GET_CONTENT') {
    sendResponse(detectedArticle);
    return true;
  }

  if (message.type === 'STATE_UPDATE') {
    updateButtonState(message.payload.isPlaying);
    return true;
  }

  return false;
});

// Initialize
init();
