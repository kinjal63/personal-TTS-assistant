const API_BASE = 'http://localhost:8000';

export interface TTSGenerateRequest {
  text: string;
  voice: string;
  speed: number;
  format_text?: boolean;
}

export interface ChunkInfo {
  index: number;
  text_preview: string;
  char_count: number;
  word_count: number;
}

export interface ChunksInfoResponse {
  total_chunks: number;
  chunks: ChunkInfo[];
  total_words: number;
  estimated_duration_seconds: number;
}

export interface GeneratedChunk {
  index: number;
  audio_base64: string;
  word_count: number;
  char_count: number;
}

export interface ChunkedTTSResponse {
  total_chunks: number;
  generated_chunks: GeneratedChunk[];
  next_chunk_indices: number[];
  is_complete: boolean;
}

/**
 * Generate TTS audio for the entire text at once
 */
export async function generateTTS(request: TTSGenerateRequest): Promise<ArrayBuffer> {
  const response = await fetch(`${API_BASE}/v1/tts/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...request,
      format_text: request.format_text ?? true,
    }),
  });

  if (!response.ok) {
    throw new Error(`TTS generation failed: ${response.status}`);
  }

  return response.arrayBuffer();
}

/**
 * Get information about how text will be chunked
 */
export async function getChunksInfo(text: string): Promise<ChunksInfoResponse> {
  const response = await fetch(`${API_BASE}/v1/tts/chunks/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get chunks info: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate audio for specific chunks
 */
export async function generateChunks(
  text: string,
  voice: string,
  speed: number,
  chunkIndices: number[]
): Promise<ChunkedTTSResponse> {
  const response = await fetch(`${API_BASE}/v1/tts/chunks/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice,
      speed,
      chunk_indices: chunkIndices,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chunk generation failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Convert base64 audio to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function fetchVoices(): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(`${API_BASE}/v1/tts/voices`);

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
