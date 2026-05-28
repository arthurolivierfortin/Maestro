import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/sessionService', () => ({
  getSessions: vi.fn(),
  startSession: vi.fn(),
  stopSession: vi.fn(),
  createSession: vi.fn(),
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
  deleteSession: vi.fn(),
}));

import { useSessions } from '../useSessions';
import {
  getSessions,
  startSession,
  stopSession,
  createSession,
  pauseSession,
  resumeSession,
  deleteSession,
} from '../../services/sessionService';

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getSessions).mockReset();
  vi.mocked(startSession).mockReset();
  vi.mocked(stopSession).mockReset();
  vi.mocked(createSession).mockReset();
  vi.mocked(pauseSession).mockReset();
  vi.mocked(resumeSession).mockReset();
  vi.mocked(deleteSession).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSessions', () => {
  it('fetches sessions on mount and exposes them', async () => {
    const mockSessions = [
      { id: 's1', name: 'Test Session', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 },
    ];
    vi.mocked(getSessions).mockResolvedValue(mockSessions);

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(getSessions).toHaveBeenCalledTimes(1);
    expect(result.current.sessions).toEqual(mockSessions);
    expect(result.current.isLoading).toBe(false);
  });

  it('polls every 5 seconds', async () => {
    vi.mocked(getSessions).mockResolvedValue([]);

    renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getSessions).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getSessions).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getSessions).toHaveBeenCalledTimes(3);
  });

  it('cleans up interval on unmount', async () => {
    vi.mocked(getSessions).mockResolvedValue([]);

    const { unmount } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    // Should not have been called again after unmount
    expect(getSessions).toHaveBeenCalledTimes(1);
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(getSessions).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.sessions).toEqual([]);
  });

  it('exposes startSession that calls service and refreshes', async () => {
    vi.mocked(getSessions).mockResolvedValue([
      { id: 's1', name: 'Test', status: 'created', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 },
    ]);
    vi.mocked(startSession).mockResolvedValue({ id: 's1', name: 'Test', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.startSession('s1');
    });

    expect(startSession).toHaveBeenCalledWith('s1');
    // Should have re-fetched after start
    expect(getSessions).toHaveBeenCalledTimes(2);
  });

  it('exposes stopSession that calls service and refreshes', async () => {
    vi.mocked(getSessions).mockResolvedValue([
      { id: 's1', name: 'Test', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 },
    ]);
    vi.mocked(stopSession).mockResolvedValue({ id: 's1', name: 'Test', status: 'stopped', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.stopSession('s1');
    });

    expect(stopSession).toHaveBeenCalledWith('s1');
    expect(getSessions).toHaveBeenCalledTimes(2);
  });

  it('createSession action calls service and refreshes', async () => {
    vi.mocked(getSessions).mockResolvedValue([]);
    vi.mocked(createSession).mockResolvedValue({ id: 's9', name: 'N', status: 'created', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.createSession({ repositoryPath: 'C:/P' });
    });

    expect(createSession).toHaveBeenCalledWith({ repositoryPath: 'C:/P' });
    expect(getSessions).toHaveBeenCalledTimes(2);
  });

  it('pauseSession action calls service and refreshes', async () => {
    vi.mocked(getSessions).mockResolvedValue([]);
    vi.mocked(pauseSession).mockResolvedValue({ id: 's1', name: 'N', status: 'paused', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.pauseSession('s1');
    });

    expect(pauseSession).toHaveBeenCalledWith('s1');
    expect(getSessions).toHaveBeenCalledTimes(2);
  });

  it('resumeSession action calls service and refreshes', async () => {
    vi.mocked(getSessions).mockResolvedValue([]);
    vi.mocked(resumeSession).mockResolvedValue({ id: 's1', name: 'N', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01', commandCount: 0 });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.resumeSession('s1');
    });

    expect(resumeSession).toHaveBeenCalledWith('s1');
    expect(getSessions).toHaveBeenCalledTimes(2);
  });

  it('deleteSession action calls service and refreshes', async () => {
    vi.mocked(getSessions).mockResolvedValue([]);
    vi.mocked(deleteSession).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.deleteSession('s1');
    });

    expect(deleteSession).toHaveBeenCalledWith('s1');
    expect(getSessions).toHaveBeenCalledTimes(2);
  });
});
