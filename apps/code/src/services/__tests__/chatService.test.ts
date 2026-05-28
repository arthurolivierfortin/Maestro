import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamChatCompletion, sendChatCompletion } from '../chatService';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('streamChatCompletion', () => {
  it('parses SSE chunks and calls onChunk then onDone', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('data: {"content":"hello"}\n\n'),
      encoder.encode('data: {"content":" world"}\n\n'),
      encoder.encode('data: [DONE]\n\n'),
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (chunkIndex < chunks.length) {
          const value = chunks[chunkIndex++];
          return Promise.resolve({ done: false, value });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamChatCompletion(
      [{ role: 'user', content: 'hi' }],
      {},
      onChunk,
      onDone,
      onError
    );

    expect(onChunk).toHaveBeenCalledWith('hello');
    expect(onChunk).toHaveBeenCalledWith(' world');
    expect(onDone).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('sendChatCompletion', () => {
  it('throws on non-ok response with error message from body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'LLM provider down' }),
    } as unknown as Response);

    await expect(
      sendChatCompletion([{ role: 'user', content: 'hi' }])
    ).rejects.toThrow('LLM provider down');
  });
});
