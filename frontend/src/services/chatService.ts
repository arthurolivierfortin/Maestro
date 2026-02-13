const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  content: string;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export async function sendChatCompletion(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<ChatCompletionResponse> {
  const res = await fetch(`${API_URL}/api/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Chat request failed: ${res.status}`);
  }
  return res.json();
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {},
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    onError(err.error || `Stream request failed: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        onDone();
        return;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          onError(parsed.error);
          return;
        }
        if (parsed.content) {
          onChunk(parsed.content);
        }
      } catch {
        // Non-JSON line, skip
      }
    }
  }

  onDone();
}

export async function fetchLLMModels(category?: string) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${API_URL}/api/provider/models${query}`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export async function fetchLLMHealth() {
  const res = await fetch(`${API_URL}/api/provider/health`);
  if (!res.ok) throw new Error(`Failed to fetch LLM health: ${res.status}`);
  return res.json();
}

export async function fetchLLMCapabilities() {
  const res = await fetch(`${API_URL}/api/provider/capabilities`);
  if (!res.ok) throw new Error(`Failed to fetch capabilities: ${res.status}`);
  return res.json();
}

export async function loadModel(modelId: string, use8bit = false) {
  const res = await fetch(`${API_URL}/api/provider/models/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, use8bit }),
  });
  if (!res.ok) throw new Error(`Failed to load model: ${res.status}`);
  return res.json();
}

export async function switchModel(modelId: string, use8bit = false) {
  const res = await fetch(`${API_URL}/api/provider/models/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, use8bit }),
  });
  if (!res.ok) throw new Error(`Failed to switch model: ${res.status}`);
  return res.json();
}
