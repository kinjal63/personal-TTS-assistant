export interface AudioPlayerState {
  isPlaying: boolean;
  progress: number;
  duration: number;
}

type StateChangeCallback = (state: AudioPlayerState) => void;

class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private onStateChange: StateChangeCallback | null = null;

  setStateChangeCallback(callback: StateChangeCallback) {
    this.onStateChange = callback;
  }

  async play(audioData: ArrayBuffer): Promise<void> {
    // Stop any existing playback
    this.stop();

    // Create blob URL from audio data
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    this.audio = new Audio(url);

    // Set up event listeners
    this.audio.addEventListener('play', () => this.notifyStateChange());
    this.audio.addEventListener('pause', () => this.notifyStateChange());
    this.audio.addEventListener('ended', () => {
      this.notifyStateChange();
      URL.revokeObjectURL(url);
    });
    this.audio.addEventListener('timeupdate', () => this.notifyStateChange());
    this.audio.addEventListener('loadedmetadata', () => this.notifyStateChange());

    await this.audio.play();
  }

  pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  resume(): void {
    if (this.audio && this.audio.paused) {
      this.audio.play();
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.notifyStateChange();
  }

  setSpeed(speed: number): void {
    if (this.audio) {
      this.audio.playbackRate = speed;
    }
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  getState(): AudioPlayerState {
    if (!this.audio) {
      return { isPlaying: false, progress: 0, duration: 0 };
    }

    return {
      isPlaying: !this.audio.paused,
      progress: this.audio.currentTime,
      duration: this.audio.duration || 0,
    };
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }
}

export const audioPlayer = new AudioPlayer();
