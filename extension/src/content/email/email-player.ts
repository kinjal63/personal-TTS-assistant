import { EmailContent, PlayerState, MessageType } from '../../lib/types';
import { getSettings } from '../../lib/storage';

/**
 * Floating email player for single email view
 * Shows a compact trigger button that expands to reveal controls
 * No progress bar - only play/pause and ±10s skip controls
 */
export class EmailPlayer {
  private container!: HTMLElement;
  private email: EmailContent;
  private isPlaying: boolean = false;
  private isExpanded: boolean = false;

  constructor(email: EmailContent, headerElement: HTMLElement) {
    this.email = email;
    this.createPlayer(headerElement);
  }

  private createPlayer(headerElement: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'tts-email-player';

    // Inline styles to ensure isolation from Gmail's CSS
    this.container.style.cssText = `
      all: initial;
      position: absolute !important;
      top: 10px !important;
      right: 10px !important;
      z-index: 10000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    `;

    this.container.innerHTML = `
      <div class="tts-player-trigger" style="display: inline-block;">
        <button class="tts-play-btn" style="
          all: initial;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          border: none !important;
          border-radius: 50% !important;
          width: 36px !important;
          height: 36px !important;
          cursor: pointer !important;
          font-size: 16px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          transition: transform 0.2s !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        ">🎧</button>
      </div>
      <div class="tts-player-controls" style="
        all: initial;
        display: none !important;
        align-items: center !important;
        gap: 8px !important;
        margin-top: 8px !important;
        padding: 8px 12px !important;
        background: white !important;
        border-radius: 20px !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1) !important;
      ">
        <button class="tts-skip" data-action="skip-back" title="Skip back 10s" style="
          all: initial;
          background: transparent !important;
          border: none !important;
          color: #667eea !important;
          cursor: pointer !important;
          font-size: 11px !important;
          padding: 6px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        ">◀ 10s</button>

        <button class="tts-play-toggle" data-action="play" title="Play email" style="
          all: initial;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          border: none !important;
          border-radius: 50% !important;
          width: 32px !important;
          height: 32px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        ">▶</button>

        <button class="tts-skip" data-action="skip-forward" title="Skip forward 10s" style="
          all: initial;
          background: transparent !important;
          border: none !important;
          color: #667eea !important;
          cursor: pointer !important;
          font-size: 11px !important;
          padding: 6px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        ">10s ▶</button>

        <span class="tts-time" style="
          all: initial;
          color: #666 !important;
          font-size: 12px !important;
          margin-left: 4px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          display: inline-block !important;
        ">~${this.email.estimatedListenTime} min</span>
      </div>
    `;

    // Position near email header
    headerElement.style.position = 'relative';
    headerElement.appendChild(this.container);

    // Event listeners
    const triggerBtn = this.container.querySelector('.tts-play-btn') as HTMLElement;
    triggerBtn?.addEventListener('click', () => this.toggleExpand());
    triggerBtn?.addEventListener('mouseenter', () => {
      triggerBtn.style.transform = 'scale(1.1)';
    });
    triggerBtn?.addEventListener('mouseleave', () => {
      triggerBtn.style.transform = 'scale(1)';
    });

    this.container.querySelector('[data-action="play"]')?.addEventListener('click', () => {
      this.handlePlayPause();
    });

    this.container.querySelector('[data-action="skip-back"]')?.addEventListener('click', () => {
      this.handleSkip(-10);
    });

    this.container.querySelector('[data-action="skip-forward"]')?.addEventListener('click', () => {
      this.handleSkip(10);
    });

    console.log('[TTS] Email player created for:', this.email.subject);
  }

  private toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    const controls = this.container.querySelector('.tts-player-controls') as HTMLElement;

    if (this.isExpanded) {
      controls.style.display = 'flex';
      // If not playing, auto-start on expand
      if (!this.isPlaying) {
        setTimeout(() => this.handlePlayPause(), 100);
      }
    } else {
      controls.style.display = 'none';
    }
  }

  private async handlePlayPause(): Promise<void> {
    console.log('[TTS Email Player] Play/Pause clicked, current state:', this.isPlaying);

    if (!this.isPlaying) {
      // Start playback
      const settings = await getSettings();

      const articleData = {
        title: `Email: ${this.email.subject}`,
        content: this.email.body,
        textContent: this.email.textContent,
        wordCount: this.email.wordCount,
        estimatedListenTime: this.email.estimatedListenTime,
        siteName: this.email.sender,
        url: this.email.url,
      };

      console.log('[TTS Email Player] ==========================================');
      console.log('[TTS Email Player] SENDING TO BACKGROUND SCRIPT');
      console.log('[TTS Email Player] ==========================================');
      console.log('[TTS Email Player] Article title:', articleData.title);
      console.log('[TTS Email Player] HTML content length:', articleData.content.length);
      console.log('[TTS Email Player] Text content length:', articleData.textContent.length);
      console.log('[TTS Email Player] Text content preview (first 500):', articleData.textContent.substring(0, 500));
      console.log('[TTS Email Player] Text content end (last 200):', articleData.textContent.substring(articleData.textContent.length - 200));
      console.log('[TTS Email Player] Word count:', articleData.wordCount);
      console.log('[TTS Email Player] Estimated time:', articleData.estimatedListenTime, 'minutes');
      console.log('[TTS Email Player] ==========================================');

      chrome.runtime.sendMessage({
        type: 'PLAY',
        payload: {
          article: articleData,
          settings,
        },
      } as MessageType);
    } else {
      // Pause playback
      chrome.runtime.sendMessage({ type: 'PAUSE' } as MessageType);
    }
  }

  private handleSkip(seconds: number): void {
    console.log('[TTS] Skip clicked:', seconds);

    chrome.runtime.sendMessage({
      type: 'SEEK_AUDIO',
      payload: { time: seconds },
    } as MessageType);
  }

  updateState(state: PlayerState): void {
    this.isPlaying = state.isPlaying;

    const playBtn = this.container.querySelector('.tts-play-toggle') as HTMLElement;
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';

      // Update button color
      if (this.isPlaying) {
        playBtn.style.background = 'linear-gradient(135deg, #e94560 0%, #d63447 100%)';
      } else {
        playBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }
    }

    // Update time remaining (no progress bar, just time left)
    const timeEl = this.container.querySelector('.tts-time') as HTMLElement;
    if (timeEl && state.duration && state.progress !== undefined) {
      const remaining = Math.ceil((state.duration - state.progress) / 60);
      if (remaining > 0) {
        timeEl.textContent = `${remaining} min left`;
      } else {
        timeEl.textContent = `~${this.email.estimatedListenTime} min`;
      }
    }
  }

  destroy(): void {
    this.container.remove();
  }
}
