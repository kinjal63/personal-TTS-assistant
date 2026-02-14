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

// Chunk duration tracking for cross-chunk seeking
let chunkDurations: number[] = []; // Actual durations of played chunks (0 if not played yet)
let estimatedChunkDuration = 0; // Fallback estimate per chunk
let pendingSeekTime: number | null = null; // Time to seek to when target chunk loads

// Audio chunk cache - keeps played chunks in memory for faster seeking
const audioChunkCache: Map<number, Uint8Array> = new Map();

function getState(): AudioState {
  const isBuffering = (audioQueue.length === 0 && currentChunkIndex < totalChunks - 1) || pendingSeekTime !== null;

  if (!audio) {
    // When seeking to a different chunk, show the pending seek time instead of 0
    const progress = pendingSeekTime !== null ? pendingSeekTime : elapsedDuration;
    return {
      isPlaying: pendingSeekTime !== null, // Show as "playing" when loading a seek target
      progress,
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

// Get the duration of a chunk (actual if played, estimated otherwise)
function getChunkDuration(index: number): number {
  if (index < 0 || index >= totalChunks) return 0;
  return chunkDurations[index] > 0 ? chunkDurations[index] : estimatedChunkDuration;
}

// Calculate elapsed time up to (but not including) a given chunk
function getElapsedBeforeChunk(chunkIndex: number): number {
  let elapsed = 0;
  for (let i = 0; i < chunkIndex && i < totalChunks; i++) {
    elapsed += getChunkDuration(i);
  }
  return elapsed;
}

// Find which chunk contains a given time
function findChunkForTime(targetTime: number): { chunkIndex: number; timeWithinChunk: number } {
  let accumulatedTime = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunkDur = getChunkDuration(i);
    if (accumulatedTime + chunkDur > targetTime) {
      return {
        chunkIndex: i,
        timeWithinChunk: targetTime - accumulatedTime,
      };
    }
    accumulatedTime += chunkDur;
  }

  // If beyond all chunks, return last chunk at end
  return {
    chunkIndex: totalChunks - 1,
    timeWithinChunk: getChunkDuration(totalChunks - 1),
  };
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

// Play a specific chunk from cache (for seeking)
async function playChunkFromCache(chunkIndex: number, seekWithin: number): Promise<void> {
  const cachedData = audioChunkCache.get(chunkIndex);
  if (!cachedData) {
    console.error(`[Offscreen] Chunk ${chunkIndex} not in cache`);
    return;
  }

  // Stop current audio
  if (audio) {
    audio.pause();
    audio = null;
  }

  currentChunkIndex = chunkIndex;
  elapsedDuration = getElapsedBeforeChunk(chunkIndex);

  // Create blob URL from cached data
  const blob = new Blob([cachedData.buffer as ArrayBuffer], { type: 'audio/mpeg' });
  const blobUrl = URL.createObjectURL(blob);

  audio = new Audio(blobUrl);
  audio.playbackRate = playbackSpeed;

  audio.addEventListener('play', notifyStateChange);
  audio.addEventListener('pause', notifyStateChange);
  audio.addEventListener('timeupdate', () => {
    notifyStateChange();
    if (audio && audio.currentTime > audio.duration * 0.7) {
      notifyChunkNeeded();
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    if (audio && currentChunkIndex >= 0 && currentChunkIndex < chunkDurations.length) {
      chunkDurations[currentChunkIndex] = audio.duration;
    }
    // Seek to the requested position
    if (audio) {
      audio.currentTime = Math.max(0, Math.min(seekWithin, audio.duration));
    }
    pendingSeekTime = null;
    notifyStateChange();
  });

  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(blobUrl);
    if (audioQueue.length > 0 || currentChunkIndex < totalChunks - 1) {
      playNextChunk();
    } else {
      console.log('[Offscreen] Playback complete');
      elapsedDuration = 0;
      currentChunkIndex = -1;
      notifyStateChange();
    }
  });

  try {
    await audio.play();
    console.log(`[Offscreen] Playing cached chunk ${chunkIndex}/${totalChunks - 1}`);
    notifyStateChange();
  } catch (error) {
    console.error('[Offscreen] Play from cache failed:', error);
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
  const previousChunkIndex = currentChunkIndex;
  currentChunkIndex = chunk.index;

  // Clean up previous audio and record its duration
  if (audio) {
    const prevDuration = audio.duration || 0;
    // Record actual duration for the previous chunk
    if (previousChunkIndex >= 0 && previousChunkIndex < chunkDurations.length) {
      chunkDurations[previousChunkIndex] = prevDuration;
    }
    audio.pause();
    if (chunk.blobUrl) {
      URL.revokeObjectURL(chunk.blobUrl);
    }
  }

  // Cache this chunk for future seeking
  if (!audioChunkCache.has(chunk.index)) {
    audioChunkCache.set(chunk.index, chunk.audioData);
    console.log(`[Offscreen] Cached chunk ${chunk.index}, cache size: ${audioChunkCache.size}`);
  }

  // Update elapsedDuration to reflect time before current chunk
  elapsedDuration = getElapsedBeforeChunk(chunk.index);

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

  // Apply pending seek time when metadata is loaded
  audio.addEventListener('loadedmetadata', () => {
    // Record actual duration for this chunk
    if (audio && currentChunkIndex >= 0 && currentChunkIndex < chunkDurations.length) {
      chunkDurations[currentChunkIndex] = audio.duration;
    }

    // Apply pending seek if this is the target chunk
    if (pendingSeekTime !== null && audio) {
      const seekWithin = pendingSeekTime - elapsedDuration;
      audio.currentTime = Math.max(0, Math.min(seekWithin, audio.duration));
      console.log(`[Offscreen] Applied pending seek to ${pendingSeekTime.toFixed(1)}s (within chunk: ${seekWithin.toFixed(1)}s)`);
      pendingSeekTime = null;
    }

    notifyStateChange();
  });

  audio.addEventListener('ended', () => {
    console.log(`[Offscreen] Chunk ${chunk.index} ended, playing next...`);
    // Record duration before cleanup
    if (audio && currentChunkIndex >= 0 && currentChunkIndex < chunkDurations.length) {
      chunkDurations[currentChunkIndex] = audio.duration;
    }
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

      // Initialize chunk duration tracking
      chunkDurations = new Array(totalChunks).fill(0);
      estimatedChunkDuration = totalChunks > 0 ? totalDuration / totalChunks : 0;
      pendingSeekTime = null;

      if (audio) {
        audio.pause();
        audio = null;
      }

      console.log(`[Offscreen] Initialized for ${totalChunks} chunks, estimated ${estimatedChunkDuration.toFixed(1)}s per chunk`);
      sendResponse({ success: true });
      break;
    }

    case 'ADD_CHUNKS': {
      // Add chunks to the queue
      const chunks = message.payload.chunks as Array<{ index: number; audioData: number[] }>;

      console.log(`[Offscreen] Adding ${chunks.length} chunks to queue, chunks: ${chunks}`);

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
      chunkDurations = [];
      estimatedChunkDuration = 0;
      pendingSeekTime = null;
      audioChunkCache.clear(); // Clear cache when stopping
      console.log('[Offscreen] Cleared audio chunk cache');
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

    case 'SEEK_AUDIO': {
      const requestedTime = Math.max(0, Math.min(message.payload.time, totalDuration));
      const { chunkIndex: targetChunk, timeWithinChunk } = findChunkForTime(requestedTime);

      console.log(`[Offscreen] Seek requested to ${requestedTime.toFixed(1)}s -> chunk ${targetChunk}, within: ${timeWithinChunk.toFixed(1)}s`);

      if (targetChunk === currentChunkIndex && audio) {
        // Same chunk - seek within it
        audio.currentTime = Math.max(0, Math.min(timeWithinChunk, audio.duration));
        notifyStateChange();
      } else if (audioChunkCache.has(targetChunk)) {
        // Chunk is cached - play directly from cache (instant seek)
        console.log(`[Offscreen] Using cached chunk ${targetChunk} for seek`);
        audioQueue = []; // Clear queue
        pendingSeekTime = requestedTime; // Set for progress display until loaded
        playChunkFromCache(targetChunk, timeWithinChunk);
      } else {
        // Different chunk, not cached - need to load it
        console.log(`[Offscreen] Cross-chunk seek: current=${currentChunkIndex}, target=${targetChunk} (not cached)`);

        // Stop current playback
        if (audio) {
          audio.pause();
          audio = null;
        }

        // Clear the queue
        audioQueue = [];

        // Set pending seek time
        pendingSeekTime = requestedTime;

        // Request the target chunk from background
        chrome.runtime.sendMessage({
          type: 'SEEK_TO_CHUNK',
          payload: {
            chunkIndex: targetChunk,
            seekTime: requestedTime,
          },
        }).catch(() => {});

        notifyStateChange();
      }
      sendResponse({ success: true });
      break;
    }

    case 'GET_AUDIO_STATE':
      sendResponse(getState());
      break;

    default:
      return false;
  }

  return false;
});

console.log('[Offscreen] Audio player ready (chunked playback supported)');
