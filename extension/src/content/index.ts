import { detectReadableContent } from './detector';
import { showListenButton, removeListenButton, updateButtonState, openExtensionPopup, updateModalPlayer } from './ui';
import { ArticleContent, MessageType } from '../lib/types';
import { detectAndInjectEmailUI, updateEmailPlayerState } from './email';

let detectedArticle: ArticleContent | null = null;
let lastUrl: string = window.location.href;
let detectionTimeout: ReturnType<typeof setTimeout> | null = null;

function init() {
  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleDetection(500));
  } else {
    scheduleDetection(500);
  }

  // Listen for URL changes (SPA navigation)
  setupUrlChangeDetection();

  // Re-detect when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Check if URL changed while tab was hidden
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        scheduleDetection(300);
      }
    }
  });

  // Listen for popstate (browser back/forward)
  window.addEventListener('popstate', () => {
    scheduleDetection(300);
  });
}

function setupUrlChangeDetection() {
  // Intercept pushState and replaceState for SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    handleUrlChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    handleUrlChange();
  };

  // Also observe DOM changes that might indicate new content
  const observer = new MutationObserver((mutations) => {
    // Check if significant content changes occurred
    const hasSignificantChanges = mutations.some(
      (m) => m.addedNodes.length > 5 || (m.target as Element).tagName === 'MAIN'
    );
    if (hasSignificantChanges && window.location.href !== lastUrl) {
      handleUrlChange();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function handleUrlChange() {
  if (window.location.href !== lastUrl) {
    console.log('[TTS Assistant] URL changed:', lastUrl, '->', window.location.href);
    lastUrl = window.location.href;
    scheduleDetection(500);
  }
}

function scheduleDetection(delay: number) {
  // Debounce detection to avoid multiple rapid calls
  if (detectionTimeout) {
    clearTimeout(detectionTimeout);
  }
  detectionTimeout = setTimeout(() => {
    detectAndShowButton();
    // Also detect and inject email UI (runs in parallel)
    detectAndInjectEmailUI();
    detectionTimeout = null;
  }, delay);
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

async function handleListenClick() {
  if (!detectedArticle) return;

  // Open extension popup automatically
  await openExtensionPopup();
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === 'GET_CONTENT') {
    sendResponse(detectedArticle);
    return true;
  }

  if (message.type === 'STATE_UPDATE') {
    updateButtonState(message.payload.isPlaying);
    updateModalPlayer(message.payload);
    // Also update email player state
    updateEmailPlayerState(message.payload);
    return true;
  }

  return false;
});

// Initialize
init();
