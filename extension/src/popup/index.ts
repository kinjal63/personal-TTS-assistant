import { ArticleContent, MessageType, PlayerState, Settings } from '../lib/types';
import { getSettings, saveSettings } from '../lib/storage';

let currentArticle: ArticleContent | null = null;
let isPlaying = false;

// DOM elements
const statusEl = document.getElementById('status') as HTMLDivElement;
const playerEl = document.getElementById('player') as HTMLDivElement;
const titleEl = document.getElementById('article-title') as HTMLDivElement;
const metaEl = document.getElementById('article-meta') as HTMLDivElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const playIcon = document.getElementById('play-icon') as unknown as SVGElement;
const progressEl = document.getElementById('progress') as HTMLDivElement;
const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
const speedValue = document.getElementById('speed-value') as HTMLSpanElement;

async function init() {
  // Load saved settings
  const settings = await getSettings();
  voiceSelect.value = settings.voice;
  speedSlider.value = settings.speed.toString();
  speedValue.textContent = `${settings.speed}x`;

  // Get current tab's content
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CONTENT' } as MessageType);
      if (response) {
        currentArticle = response as ArticleContent;
        showPlayer();
      }
    } catch {
      // Content script might not be loaded
      console.log('Could not get content from page');
    }
  }

  // Get current player state
  chrome.runtime.sendMessage({ type: 'GET_STATE' } as MessageType, (state: PlayerState) => {
    if (state && state.article) {
      currentArticle = state.article;
      isPlaying = state.isPlaying;
      showPlayer();
      updatePlayButton();
      updateProgress(state.progress, state.duration);
    }
  });

  // Set up event listeners
  playBtn.addEventListener('click', handlePlayClick);
  voiceSelect.addEventListener('change', handleVoiceChange);
  speedSlider.addEventListener('input', handleSpeedChange);
}

function showPlayer() {
  if (!currentArticle) return;

  statusEl.style.display = 'none';
  playerEl.style.display = 'block';

  titleEl.textContent = currentArticle.title;
  metaEl.textContent = `~${currentArticle.estimatedListenTime} min listen · ${currentArticle.wordCount} words`;
}

function updatePlayButton() {
  const path = isPlaying
    ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' // Pause icon
    : 'M8 5v14l11-7z'; // Play icon

  playIcon.innerHTML = `<path d="${path}"/>`;
  playBtn.title = isPlaying ? 'Pause' : 'Play';
}

function updateProgress(current: number, total: number) {
  if (total > 0) {
    const percent = (current / total) * 100;
    progressEl.style.width = `${percent}%`;
  }
}

async function handlePlayClick() {
  if (!currentArticle) return;

  if (isPlaying) {
    chrome.runtime.sendMessage({ type: 'PAUSE' } as MessageType);
    isPlaying = false;
  } else {
    const settings: Settings = {
      voice: voiceSelect.value,
      speed: parseFloat(speedSlider.value),
    };

    chrome.runtime.sendMessage({
      type: 'PLAY',
      payload: { article: currentArticle, settings },
    } as MessageType);
    isPlaying = true;
  }

  updatePlayButton();
}

async function handleVoiceChange() {
  await saveSettings({ voice: voiceSelect.value });
}

async function handleSpeedChange() {
  const speed = parseFloat(speedSlider.value);
  speedValue.textContent = `${speed.toFixed(1)}x`;
  await saveSettings({ speed });
}

// Listen for state updates
chrome.runtime.onMessage.addListener((message: MessageType) => {
  if (message.type === 'STATE_UPDATE') {
    const state = message.payload;
    isPlaying = state.isPlaying;
    updatePlayButton();
    updateProgress(state.progress, state.duration);
  }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
