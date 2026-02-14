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
const rewindBtn = document.getElementById('rewind-btn') as HTMLButtonElement;
const forwardBtn = document.getElementById('forward-btn') as HTMLButtonElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const progressEl = document.getElementById('progress') as HTMLDivElement;
const currentTimeEl = document.getElementById('current-time') as HTMLSpanElement;
const totalTimeEl = document.getElementById('total-time') as HTMLSpanElement;
const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
const speedValue = document.getElementById('speed-value') as HTMLSpanElement;

// Player state
let currentProgress = 0;
let currentDuration = 0;

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
  rewindBtn.addEventListener('click', handleRewind);
  forwardBtn.addEventListener('click', handleForward);
  progressBar.addEventListener('click', handleProgressClick);
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePlayButton() {
  const path = isPlaying
    ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' // Pause icon
    : 'M8 5v14l11-7z'; // Play icon

  playIcon.innerHTML = `<path d="${path}"/>`;
  playBtn.title = isPlaying ? 'Pause' : 'Play';

  // Update button styling
  if (isPlaying) {
    playBtn.classList.add('playing');
  } else {
    playBtn.classList.remove('playing');
  }
}

function updateProgress(current: number, total: number) {
  currentProgress = current;
  currentDuration = total;

  if (total > 0) {
    const percent = (current / total) * 100;
    progressEl.style.width = `${percent}%`;
  }

  // Update time display
  currentTimeEl.textContent = formatTime(current);
  totalTimeEl.textContent = formatTime(total);
}

async function handlePlayClick() {
  if (!currentArticle) return;

  if (isPlaying) {
    chrome.runtime.sendMessage({ type: 'PAUSE' } as MessageType);
    isPlaying = false;
  } else {
    // If we have progress, resume instead of starting over
    if (currentProgress > 0 || currentDuration > 0) {
      chrome.runtime.sendMessage({ type: 'RESUME' } as MessageType);
    } else {
      const settings: Settings = {
        voice: voiceSelect.value,
        speed: parseFloat(speedSlider.value),
      };

      chrome.runtime.sendMessage({
        type: 'PLAY',
        payload: { article: currentArticle, settings },
      } as MessageType);
    }
    isPlaying = true;
  }

  updatePlayButton();
}

async function handleVoiceChange() {
  await saveSettings({ voice: voiceSelect.value });

  // If currently playing or paused with progress, restart with new voice
  if (isPlaying || currentProgress > 0) {
    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { voice: voiceSelect.value, speed: parseFloat(speedSlider.value) },
    } as MessageType);

    // Stop and restart with new voice
    chrome.runtime.sendMessage({ type: 'STOP' } as MessageType);

    setTimeout(() => {
      if (currentArticle) {
        chrome.runtime.sendMessage({
          type: 'PLAY',
          payload: {
            article: currentArticle,
            settings: { voice: voiceSelect.value, speed: parseFloat(speedSlider.value) },
          },
        } as MessageType);
        isPlaying = true;
        updatePlayButton();
      }
    }, 100);
  }
}

async function handleSpeedChange() {
  const speed = parseFloat(speedSlider.value);
  speedValue.textContent = `${speed.toFixed(1)}x`;
  await saveSettings({ speed });

  // Send speed update to offscreen document
  chrome.runtime.sendMessage({
    type: 'SET_SPEED',
    payload: { speed },
  } as MessageType);
}

function handleRewind() {
  const newTime = Math.max(0, currentProgress - 10);
  chrome.runtime.sendMessage({
    type: 'SEEK_AUDIO',
    payload: { time: newTime },
  } as MessageType);
}

function handleForward() {
  const newTime = Math.min(currentDuration, currentProgress + 10);
  chrome.runtime.sendMessage({
    type: 'SEEK_AUDIO',
    payload: { time: newTime },
  } as MessageType);
}

function handleProgressClick(event: MouseEvent) {
  if (currentDuration === 0) return;

  const rect = progressBar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percent = clickX / rect.width;
  const newTime = percent * currentDuration;

  chrome.runtime.sendMessage({
    type: 'SEEK_AUDIO',
    payload: { time: newTime },
  } as MessageType);
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
