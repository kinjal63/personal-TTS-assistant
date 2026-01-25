const API_BASE = 'http://localhost:8000';

export interface TTSGenerateRequest {
  text: string;
  voice: string;
  speed: number;
}

export async function generateTTS(request: TTSGenerateRequest): Promise<ArrayBuffer> {
  const response = await fetch(`${API_BASE}/v1/tts/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`TTS generation failed: ${response.status}`);
  }

  return response.arrayBuffer();
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
