import { ArticleContent, Settings, AudioState, MessageType, PlayerState } from '../lib/types';
import { saveSettings } from '../lib/storage';
import './modal-player.css';

const VOICES = [
  { id: 'en-US-JennyNeural', name: 'Jenny (US)' },
  { id: 'en-US-GuyNeural', name: 'Guy (US)' },
  { id: 'en-US-AriaNeural', name: 'Aria (US)' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK)' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha (AU)' },
];

export class ModalPlayer {
  private container: HTMLElement;
  private backdrop: HTMLElement | null = null;
  private fullModal: HTMLElement | null = null;
  private miniModal: HTMLElement | null = null;
  private isMinimized: boolean = false;
  private currentArticle: ArticleContent;
  private currentSettings: Settings;
  private isPlaying: boolean = false;
  private progress: number = 0;
  private duration: number = 0;
  private sourceTabId: number | null = null;
  private isSourceTab: boolean = true;

  // DOM Elements - Full Modal
  private playButton: HTMLButtonElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressFill: HTMLElement | null = null;
  private currentTimeEl: HTMLElement | null = null;
  private totalTimeEl: HTMLElement | null = null;
  private voiceSelect: HTMLSelectElement | null = null;
  private speedSlider: HTMLInputElement | null = null;
  private speedValue: HTMLElement | null = null;

  // DOM Elements - Mini Modal
  private miniPlayButton: HTMLButtonElement | null = null;
  private miniProgressFill: HTMLElement | null = null;
  private miniTimeEl: HTMLElement | null = null;

  constructor(article: ArticleContent, settings: Settings, isSourceTab: boolean = true) {
    this.currentArticle = article;
    this.currentSettings = settings;
    this.isSourceTab = isSourceTab;
    this.isMinimized = !isSourceTab;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'tts-modal-container';

    // Create both modal versions
    this.createFullModal();
    this.createMiniModal();

    // Show appropriate modal
    if (this.isMinimized) {
      this.showMini();
    } else {
      this.showFull();
    }

    // Attach to DOM
    document.body.appendChild(this.container);
  }

  private createFullModal(): void {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'tts-modal-backdrop tts-modal-hidden';
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.handleMinimize();
      }
    });

    // Create modal
    this.fullModal = document.createElement('div');
    this.fullModal.className = 'tts-modal-full';
    this.fullModal.addEventListener('click', (e) => e.stopPropagation());

    // Header
    const header = document.createElement('div');
    header.className = 'tts-modal-header';
    header.innerHTML = `
      <div class="tts-modal-title">
        <span>🎧</span>
        <span>Now Playing</span>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tts-modal-close-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => this.handleMinimize());
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'tts-modal-body';

    // Article info
    const articleInfo = document.createElement('div');
    articleInfo.className = 'tts-modal-article-info';
    articleInfo.innerHTML = `
      <div class="tts-modal-article-title">${this.escapeHtml(this.currentArticle.title)}</div>
      <div class="tts-modal-article-meta">~${this.currentArticle.estimatedListenTime} min listen • ${this.currentArticle.wordCount.toLocaleString()} words</div>
    `;

    // Progress section
    const progressSection = document.createElement('div');
    progressSection.className = 'tts-modal-progress-section';
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'tts-modal-progress-bar';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'tts-modal-progress-fill';
    this.progressBar.appendChild(this.progressFill);

    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'tts-modal-time';
    this.currentTimeEl = document.createElement('span');
    this.currentTimeEl.textContent = '0:00';
    this.totalTimeEl = document.createElement('span');
    this.totalTimeEl.textContent = `${this.currentArticle.estimatedListenTime}:00`;
    timeDisplay.appendChild(this.currentTimeEl);
    timeDisplay.appendChild(this.totalTimeEl);

    progressSection.appendChild(this.progressBar);
    progressSection.appendChild(timeDisplay);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'tts-modal-controls';

    // Skip back button
    const skipBackBtn = document.createElement('button');
    skipBackBtn.className = 'tts-modal-control-btn skip';
    skipBackBtn.innerHTML = `
      <div class="tts-modal-control-icon">⏮</div>
      <div class="tts-modal-control-label">-10s</div>
    `;
    skipBackBtn.addEventListener('click', () => this.handleSkipBackward());

    // Play/pause button
    this.playButton = document.createElement('button');
    this.playButton.className = 'tts-modal-control-btn play';
    this.playButton.innerHTML = `
      <div class="tts-modal-control-icon">▶️</div>
      <div class="tts-modal-control-label">Play</div>
    `;
    this.playButton.addEventListener('click', () => this.handlePlayPause());

    // Skip forward button
    const skipForwardBtn = document.createElement('button');
    skipForwardBtn.className = 'tts-modal-control-btn skip';
    skipForwardBtn.innerHTML = `
      <div class="tts-modal-control-icon">⏭</div>
      <div class="tts-modal-control-label">+10s</div>
    `;
    skipForwardBtn.addEventListener('click', () => this.handleSkipForward());

    controls.appendChild(skipBackBtn);
    controls.appendChild(this.playButton);
    controls.appendChild(skipForwardBtn);

    // Settings
    const settings = document.createElement('div');
    settings.className = 'tts-modal-settings';

    // Voice select
    const voiceGroup = document.createElement('div');
    voiceGroup.className = 'tts-modal-setting-group';
    const voiceLabel = document.createElement('div');
    voiceLabel.className = 'tts-modal-setting-label';
    voiceLabel.textContent = 'Voice';
    this.voiceSelect = document.createElement('select');
    this.voiceSelect.className = 'tts-modal-select';
    VOICES.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = voice.name;
      if (voice.id === this.currentSettings.voice) {
        option.selected = true;
      }
      this.voiceSelect!.appendChild(option);
    });
    this.voiceSelect.addEventListener('change', () => this.handleVoiceChange());
    voiceGroup.appendChild(voiceLabel);
    voiceGroup.appendChild(this.voiceSelect);

    // Speed control
    const speedGroup = document.createElement('div');
    speedGroup.className = 'tts-modal-setting-group';
    const speedControl = document.createElement('div');
    speedControl.className = 'tts-modal-speed-control';
    const speedLabel = document.createElement('div');
    speedLabel.className = 'tts-modal-setting-label';
    speedLabel.textContent = 'Speed';

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'tts-modal-speed-slider-wrapper';
    this.speedSlider = document.createElement('input');
    this.speedSlider.type = 'range';
    this.speedSlider.min = '0.5';
    this.speedSlider.max = '2.0';
    this.speedSlider.step = '0.1';
    this.speedSlider.value = this.currentSettings.speed.toString();
    this.speedSlider.className = 'tts-modal-speed-slider';
    this.speedValue = document.createElement('span');
    this.speedValue.className = 'tts-modal-speed-value';
    this.speedValue.textContent = `${this.currentSettings.speed.toFixed(1)}x`;
    this.speedSlider.addEventListener('input', () => this.handleSpeedChange());
    sliderWrapper.appendChild(this.speedSlider);
    sliderWrapper.appendChild(this.speedValue);

    const speedLabels = document.createElement('div');
    speedLabels.className = 'tts-modal-speed-labels';
    speedLabels.innerHTML = '<span>0.5x</span><span>2.0x</span>';

    speedControl.appendChild(speedLabel);
    speedControl.appendChild(sliderWrapper);
    speedControl.appendChild(speedLabels);
    speedGroup.appendChild(speedControl);

    settings.appendChild(voiceGroup);
    settings.appendChild(speedGroup);

    // Assemble body
    body.appendChild(articleInfo);
    body.appendChild(progressSection);
    body.appendChild(controls);
    body.appendChild(settings);

    // Assemble full modal
    this.fullModal.appendChild(header);
    this.fullModal.appendChild(body);
    this.backdrop.appendChild(this.fullModal);
    this.container.appendChild(this.backdrop);
  }

  private createMiniModal(): void {
    this.miniModal = document.createElement('div');
    this.miniModal.className = 'tts-modal-mini tts-modal-hidden';

    // Header
    const header = document.createElement('div');
    header.className = 'tts-modal-mini-header';

    const title = document.createElement('div');
    title.className = 'tts-modal-mini-title';
    title.innerHTML = `
      <span>🎧</span>
      <span class="tts-modal-mini-title-text">${this.isSourceTab ? 'Now Playing' : 'Playing'}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'tts-modal-mini-actions';

    const expandBtn = document.createElement('button');
    expandBtn.className = 'tts-modal-mini-btn';
    expandBtn.innerHTML = '⤢';
    expandBtn.title = 'Expand';
    expandBtn.addEventListener('click', () => this.handleExpand());

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tts-modal-mini-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => this.destroy());

    actions.appendChild(expandBtn);
    actions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(actions);

    // Body
    const body = document.createElement('div');
    body.className = 'tts-modal-mini-body';

    const article = document.createElement('div');
    article.className = 'tts-modal-mini-article';
    article.textContent = this.currentArticle.title;

    const controls = document.createElement('div');
    controls.className = 'tts-modal-mini-controls';

    this.miniPlayButton = document.createElement('button');
    this.miniPlayButton.className = 'tts-modal-mini-play-btn';
    this.miniPlayButton.innerHTML = '▶️';
    this.miniPlayButton.addEventListener('click', () => this.handlePlayPause());

    const info = document.createElement('div');
    info.className = 'tts-modal-mini-info';

    this.miniTimeEl = document.createElement('div');
    this.miniTimeEl.className = 'tts-modal-mini-time';
    this.miniTimeEl.textContent = `0:00 / ${this.currentArticle.estimatedListenTime}:00`;

    const progress = document.createElement('div');
    progress.className = 'tts-modal-mini-progress';
    this.miniProgressFill = document.createElement('div');
    this.miniProgressFill.className = 'tts-modal-mini-progress-fill';
    progress.appendChild(this.miniProgressFill);

    info.appendChild(this.miniTimeEl);
    info.appendChild(progress);

    // Source indicator (if not source tab)
    if (!this.isSourceTab) {
      const sourceIndicator = document.createElement('div');
      sourceIndicator.className = 'tts-modal-source-indicator';
      sourceIndicator.textContent = 'Playing from another tab';
      info.appendChild(sourceIndicator);
    }

    controls.appendChild(this.miniPlayButton);
    controls.appendChild(info);
    body.appendChild(article);
    body.appendChild(controls);

    this.miniModal.appendChild(header);
    this.miniModal.appendChild(body);
    this.container.appendChild(this.miniModal);
  }

  showFull(): void {
    if (this.backdrop && this.fullModal && this.miniModal) {
      this.miniModal.classList.add('tts-modal-hidden');
      this.backdrop.classList.remove('tts-modal-hidden');
      this.isMinimized = false;
    }
  }

  showMini(): void {
    if (this.backdrop && this.miniModal) {
      this.backdrop.classList.add('tts-modal-hidden');
      this.miniModal.classList.remove('tts-modal-hidden');
      this.isMinimized = true;
    }
  }

  toggle(): void {
    if (this.isMinimized) {
      this.showFull();
    } else {
      this.showMini();
    }
  }

  updateState(state: PlayerState): void {
    const audioState = state as any; // Contains audio state properties

    // Update source tab info
    if (state.sourceTabId !== undefined) {
      this.sourceTabId = state.sourceTabId;
    }

    // Determine if we are the source tab
    chrome.tabs.getCurrent((tab) => {
      const wasSourceTab = this.isSourceTab;
      this.isSourceTab = !this.sourceTabId || this.sourceTabId === tab?.id;

      // Auto-minimize if we're no longer the source tab
      if (wasSourceTab && !this.isSourceTab && !this.isMinimized) {
        this.showMini();
      }
    });

    // Update playback state
    this.isPlaying = state.isPlaying;
    this.progress = state.progress;
    this.duration = state.duration || this.currentArticle.estimatedListenTime * 60;

    // Update UI
    this.updateProgressBars();
    this.updatePlayButtons();
    this.updateTimeDisplays();
  }

  private updateProgressBars(): void {
    const percentage = this.duration > 0 ? (this.progress / this.duration) * 100 : 0;

    // Full modal progress
    if (this.progressFill) {
      this.progressFill.style.width = `${percentage}%`;
      if (this.isPlaying) {
        this.progressFill.classList.add('playing');
      } else {
        this.progressFill.classList.remove('playing');
      }
    }

    // Mini modal progress
    if (this.miniProgressFill) {
      this.miniProgressFill.style.width = `${percentage}%`;
      if (this.isPlaying) {
        this.miniProgressFill.classList.add('playing');
      } else {
        this.miniProgressFill.classList.remove('playing');
      }
    }
  }

  private updatePlayButtons(): void {
    const icon = this.isPlaying ? '⏸' : '▶️';
    const label = this.isPlaying ? 'Pause' : 'Play';

    // Full modal button
    if (this.playButton) {
      const iconEl = this.playButton.querySelector('.tts-modal-control-icon');
      const labelEl = this.playButton.querySelector('.tts-modal-control-label');
      if (iconEl) iconEl.textContent = icon;
      if (labelEl) labelEl.textContent = label;

      if (this.isPlaying) {
        this.playButton.classList.add('playing');
      } else {
        this.playButton.classList.remove('playing');
      }
    }

    // Mini modal button
    if (this.miniPlayButton) {
      this.miniPlayButton.innerHTML = icon;
      if (this.isPlaying) {
        this.miniPlayButton.classList.add('playing');
      } else {
        this.miniPlayButton.classList.remove('playing');
      }
    }
  }

  private updateTimeDisplays(): void {
    const currentFormatted = this.formatTime(this.progress);
    const totalFormatted = this.formatTime(this.duration);

    // Full modal time
    if (this.currentTimeEl) {
      this.currentTimeEl.textContent = currentFormatted;
    }
    if (this.totalTimeEl) {
      this.totalTimeEl.textContent = totalFormatted;
    }

    // Mini modal time
    if (this.miniTimeEl) {
      this.miniTimeEl.textContent = `${currentFormatted} / ${totalFormatted}`;
    }
  }

  private handlePlayPause(): void {
    if (this.isPlaying) {
      chrome.runtime.sendMessage({ type: 'PAUSE' } as MessageType);
    } else {
      // If we have progress, we're resuming from a paused state
      // If progress is 0 and duration is 0, we need to start fresh
      if (this.progress > 0 || this.duration > 0) {
        chrome.runtime.sendMessage({ type: 'RESUME' } as MessageType);
      } else {
        chrome.runtime.sendMessage({
          type: 'PLAY',
          payload: {
            article: this.currentArticle,
            settings: this.currentSettings,
          },
        } as MessageType);
      }
    }
  }

  private handleSkipForward(): void {
    const newTime = Math.min(this.progress + 10, this.duration);
    chrome.runtime.sendMessage({
      type: 'SEEK_AUDIO',
      payload: { time: newTime },
    } as MessageType);
  }

  private handleSkipBackward(): void {
    const newTime = Math.max(this.progress - 10, 0);
    chrome.runtime.sendMessage({
      type: 'SEEK_AUDIO',
      payload: { time: newTime },
    } as MessageType);
  }

  private async handleVoiceChange(): Promise<void> {
    if (!this.voiceSelect) return;

    const newVoice = this.voiceSelect.value;
    this.currentSettings.voice = newVoice;

    // Save to storage
    await saveSettings({ voice: newVoice });

    // Send message to background
    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: this.currentSettings,
    } as MessageType);

    // If currently playing or paused with progress, restart with new voice
    // Voice change requires regenerating audio, so we need to restart
    if (this.isPlaying || this.progress > 0) {
      // Stop current playback
      chrome.runtime.sendMessage({ type: 'STOP' } as MessageType);

      // Small delay to ensure stop is processed, then restart
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'PLAY',
          payload: {
            article: this.currentArticle,
            settings: this.currentSettings,
          },
        } as MessageType);
      }, 100);
    }
  }

  private async handleSpeedChange(): Promise<void> {
    if (!this.speedSlider || !this.speedValue) return;

    const newSpeed = parseFloat(this.speedSlider.value);
    this.currentSettings.speed = newSpeed;
    this.speedValue.textContent = `${newSpeed.toFixed(1)}x`;

    // Save to storage
    await saveSettings({ speed: newSpeed });

    // Send message to offscreen for real-time speed change
    chrome.runtime.sendMessage({
      type: 'SET_SPEED',
      payload: { speed: newSpeed },
    } as MessageType);
  }

  private handleExpand(): void {
    this.showFull();
  }

  private handleMinimize(): void {
    this.showMini();
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    if (this.container && this.container.parentElement) {
      // Fade out animation
      if (this.backdrop) {
        this.backdrop.style.animation = 'tts-fade-out 0.2s ease-out';
      }
      if (this.miniModal) {
        this.miniModal.style.animation = 'tts-fade-out 0.2s ease-out';
      }

      setTimeout(() => {
        this.container.remove();
      }, 200);
    }
  }
}
