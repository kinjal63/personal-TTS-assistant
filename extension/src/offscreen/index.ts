// Offscreen document for audio playback (Manifest V3 requirement)
// Supports chunked playback with queue management

interface AudioChunk {
  index: number;
  audioData: Uint8Array;
  blobUrl?: string;
}

interface AudioState {
  isPlaying: boolean;
  progress: number;
  duration: number;
  currentChunkIndex: number;
  totalChunks: number;
  isBuffering: boolean;
}

let audio: HTMLAudioElement | null = null;
let audioQueue: AudioChunk[] = [];
let currentChunkIndex = -1;
let totalChunks = 0;
let playbackSpeed = 1.0;
let totalDuration = 0;
let elapsedDuration = 0;

function getState(): AudioState {
  const isBuffering = audioQueue.length === 0 && currentChunkIndex < totalChunks - 1;

  if (!audio) {
    return {
      isPlaying: false,
      progress: 0,
      duration: totalDuration,
      currentChunkIndex,
      totalChunks,
      isBuffering,
    };
  }

  return {
    isPlaying: !audio.paused,
    progress: elapsedDuration + audio.currentTime,
    duration: totalDuration || audio.duration || 0,
    currentChunkIndex,
    totalChunks,
    isBuffering,
  };
}

function notifyStateChange() {
  chrome.runtime.sendMessage({
    type: 'AUDIO_STATE_CHANGE',
    payload: getState(),
  }).catch(() => {
    // Background might not be listening
  });
}

function notifyChunkNeeded() {
  // Request more chunks when queue is running low
  if (audioQueue.length < 2 && currentChunkIndex < totalChunks - 1) {
    const nextNeeded = currentChunkIndex + audioQueue.length + 1;
    if (nextNeeded < totalChunks) {
      chrome.runtime.sendMessage({
        type: 'NEED_MORE_CHUNKS',
        payload: {
          startIndex: nextNeeded,
          count: 2,
        },
      }).catch(() => {});
    }
  }
}

async function playNextChunk(): Promise<void> {
  if (audioQueue.length === 0) {
    console.log('[Offscreen] Queue empty, waiting for more chunks...');
    notifyStateChange();
    notifyChunkNeeded();
    return;
  }

  const chunk = audioQueue.shift()!;
  currentChunkIndex = chunk.index;

  // Clean up previous audio
  if (audio) {
    elapsedDuration += audio.duration || 0;
    audio.pause();
    if (chunk.blobUrl) {
      URL.revokeObjectURL(chunk.blobUrl);
    }
  }

  // Create blob URL
  const blob = new Blob([chunk.audioData.buffer as ArrayBuffer], { type: 'audio/mpeg' });
  const blobUrl = URL.createObjectURL(blob);
  chunk.blobUrl = blobUrl;

  audio = new Audio(blobUrl);
  audio.playbackRate = playbackSpeed;

  audio.addEventListener('play', notifyStateChange);
  audio.addEventListener('pause', notifyStateChange);
  audio.addEventListener('timeupdate', () => {
    notifyStateChange();
    // Preemptively request more chunks
    if (audio && audio.currentTime > audio.duration * 0.7) {
      notifyChunkNeeded();
    }
  });
  audio.addEventListener('loadedmetadata', notifyStateChange);

  audio.addEventListener('ended', () => {
    console.log(`[Offscreen] Chunk ${chunk.index} ended, playing next...`);
    URL.revokeObjectURL(blobUrl);

    if (audioQueue.length > 0 || currentChunkIndex < totalChunks - 1) {
      playNextChunk();
    } else {
      // All done
      console.log('[Offscreen] Playback complete');
      elapsedDuration = 0;
      currentChunkIndex = -1;
      notifyStateChange();
    }
  });

  try {
    await audio.play();
    console.log(`[Offscreen] Playing chunk ${chunk.index}/${totalChunks - 1}`);
    notifyStateChange();
  } catch (error) {
    console.error('[Offscreen] Play failed:', error);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Offscreen] Received message:', message.type);

  switch (message.type) {
    case 'INIT_CHUNKED_PLAYBACK': {
      // Initialize for chunked playback
      totalChunks = message.payload.totalChunks;
      totalDuration = message.payload.estimatedDuration || 0;
      playbackSpeed = message.payload.speed || 1.0;
      audioQueue = [];
      currentChunkIndex = -1;
      elapsedDuration = 0;

      if (audio) {
        audio.pause();
        audio = null;
      }

      console.log(`[Offscreen] Initialized for ${totalChunks} chunks`);
      sendResponse({ success: true });
      break;
    }

    case 'ADD_CHUNKS': {
      // Add chunks to the queue
      const chunks = message.payload.chunks as Array<{ index: number; audioData: number[] }>;

      for (const chunk of chunks) {
        audioQueue.push({
          index: chunk.index,
          audioData: new Uint8Array(chunk.audioData),
        });
      }

      // Sort queue by index to handle out-of-order arrivals
      audioQueue.sort((a, b) => a.index - b.index);

      console.log(`[Offscreen] Added ${chunks.length} chunks, queue size: ${audioQueue.length}`);

      // Start playing if not already playing
      if (!audio || audio.paused) {
        playNextChunk();
      }

      sendResponse({ success: true, queueSize: audioQueue.length });
      break;
    }

    case 'PLAY_AUDIO': {
      // Legacy: play entire audio at once
      if (audio) {
        audio.pause();
        audio = null;
      }
      audioQueue = [];
      currentChunkIndex = 0;
      totalChunks = 1;
      elapsedDuration = 0;

      const audioData = new Uint8Array(message.payload.audioData);
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);

      audio = new Audio(blobUrl);
      audio.playbackRate = message.payload.speed || 1.0;
      playbackSpeed = message.payload.speed || 1.0;

      audio.addEventListener('play', notifyStateChange);
      audio.addEventListener('pause', notifyStateChange);
      audio.addEventListener('ended', () => {
        notifyStateChange();
        URL.revokeObjectURL(blobUrl);
      });
      audio.addEventListener('timeupdate', notifyStateChange);
      audio.addEventListener('loadedmetadata', () => {
        totalDuration = audio?.duration || 0;
        notifyStateChange();
      });

      audio.play()
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));

      return true;
    }

    case 'PAUSE_AUDIO':
      if (audio && !audio.paused) {
        audio.pause();
      }
      sendResponse({ success: true });
      break;

    case 'RESUME_AUDIO':
      if (audio && audio.paused) {
        audio.play();
      } else if (!audio && audioQueue.length > 0) {
        playNextChunk();
      }
      sendResponse({ success: true });
      break;

    case 'STOP_AUDIO':
      if (audio) {
        audio.pause();
        audio = null;
      }
      audioQueue = [];
      currentChunkIndex = -1;
      totalChunks = 0;
      elapsedDuration = 0;
      totalDuration = 0;
      notifyStateChange();
      sendResponse({ success: true });
      break;

    case 'SET_SPEED':
      playbackSpeed = message.payload.speed;
      if (audio) {
        audio.playbackRate = playbackSpeed;
      }
      sendResponse({ success: true });
      break;

    case 'SEEK_AUDIO':
      if (audio) {
        audio.currentTime = message.payload.time;
      }
      sendResponse({ success: true });
      break;

    case 'GET_AUDIO_STATE':
      sendResponse(getState());
      break;

    default:
      return false;
  }

  return false;
});

console.log('[Offscreen] Audio player ready (chunked playback supported)');
