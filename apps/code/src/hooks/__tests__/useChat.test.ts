import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '../useChat';

vi.mock('../../services/chatService', () => ({
  streamChatCompletion: vi.fn(),
  sendChatCompletion: vi.fn(),
}));

import { streamChatCompletion } from '../../services/chatService';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useChat', () => {
  it('adds user message and sets isLoading on sendMessage', async () => {
    const mockStream = vi.mocked(streamChatCompletion);
    mockStream.mockImplementation(async (_msgs, _opts, _onChunk, onDone) => {
      onDone();
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'hello' }),
      ])
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('stopGeneration sets isLoading false and saves partial streaming content', async () => {
    const mockStream = vi.mocked(streamChatCompletion);
    let capturedOnChunk: ((text: string) => void) | undefined;

    mockStream.mockImplementation(async (_msgs, _opts, onChunk) => {
      capturedOnChunk = onChunk;
      onChunk('partial');
      await new Promise(() => {});
    });

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.sendMessage('hello');
    });

    await vi.waitFor(() => {
      expect(capturedOnChunk).toBeDefined();
    });

    await vi.waitFor(() => {
      expect(result.current.streamingContent).toBe('partial');
    });

    act(() => {
      result.current.stopGeneration();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: 'partial' }),
      ])
    );
  });
});
