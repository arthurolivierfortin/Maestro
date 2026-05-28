import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpacesPage } from '../SpacesPage';

vi.mock('../../hooks/useSessions', () => ({
  useSessions: vi.fn(),
}));

vi.mock('../../hooks/useWorkspaces', () => ({
  useWorkspaces: vi.fn(),
}));

import { useSessions } from '../../hooks/useSessions';
import { useWorkspaces } from '../../hooks/useWorkspaces';

beforeEach(() => {
  vi.mocked(useSessions).mockReturnValue({
    sessions: [],
    isLoading: false,
    error: null,
    startSession: vi.fn(),
    stopSession: vi.fn(),
    createSession: vi.fn(),
    pauseSession: vi.fn(),
    resumeSession: vi.fn(),
    deleteSession: vi.fn(),
  });
  vi.mocked(useWorkspaces).mockReturnValue({
    workspaces: [],
    isLoading: false,
    error: null,
  });
});

describe('SpacesPage', () => {
  it('renders Sessions tab by default', () => {
    render(<SpacesPage />);
    expect(screen.getByText('No sessions found.')).toBeDefined();
  });

  it('renders session rows when sessions exist', () => {
    vi.mocked(useSessions).mockReturnValue({
      sessions: [
        { id: 's1', name: 'Dev Session', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01T00:00:00Z', commandCount: 5 },
        { id: 's2', name: 'Test Session', status: 'created', type: 'project', authority: 'human', createdAt: '2026-01-02T00:00:00Z', commandCount: 0 },
      ],
      isLoading: false,
      error: null,
      startSession: vi.fn(),
      stopSession: vi.fn(),
      createSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
    });

    render(<SpacesPage />);

    expect(screen.getByText('Dev Session')).toBeDefined();
    expect(screen.getByText('Test Session')).toBeDefined();
  });

  it('toggles to Workspaces tab and shows workspace rows', () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      workspaces: [
        { id: 'w1', name: 'My Workspace', type: 'Custom', status: 'Active', sessionIds: ['s1'], projectIds: [], createdAt: '2026-01-01T00:00:00Z' },
      ],
      isLoading: false,
      error: null,
    });

    render(<SpacesPage />);

    fireEvent.click(screen.getByText('Workspaces'));

    expect(screen.getByText('My Workspace')).toBeDefined();
  });

  it('shows empty state for workspaces when none exist', () => {
    render(<SpacesPage />);

    fireEvent.click(screen.getByText('Workspaces'));

    expect(screen.getByText('No workspaces found.')).toBeDefined();
  });

  it('shows loading state', () => {
    vi.mocked(useSessions).mockReturnValue({
      sessions: [],
      isLoading: true,
      error: null,
      startSession: vi.fn(),
      stopSession: vi.fn(),
      createSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
    });

    render(<SpacesPage />);

    expect(screen.getByText('Loading sessions...')).toBeDefined();
  });

  it('shows error state', () => {
    vi.mocked(useSessions).mockReturnValue({
      sessions: [],
      isLoading: false,
      error: 'Connection failed',
      startSession: vi.fn(),
      stopSession: vi.fn(),
      createSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
    });

    render(<SpacesPage />);

    expect(screen.getByText('Error: Connection failed')).toBeDefined();
  });

  it('shows the New Session form when the New Session button is clicked', () => {
    render(<SpacesPage />);

    fireEvent.click(screen.getByText(/New Session/i));

    expect(screen.getByPlaceholderText(/repository path/i)).toBeDefined();
  });

  it('shows both Start and Stop for an idle session row (real backend status)', () => {
    vi.mocked(useSessions).mockReturnValue({
      sessions: [
        { id: 's1', name: 'Idle Session', status: 'idle', type: 'project', authority: 'human', createdAt: '2026-01-01T00:00:00Z', commandCount: 5 },
      ],
      isLoading: false,
      error: null,
      startSession: vi.fn(),
      stopSession: vi.fn(),
      createSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
    });

    render(<SpacesPage />);

    expect(screen.getByText('Start')).toBeDefined();
    expect(screen.getByText('Stop')).toBeDefined();
  });

  it('shows session detail when a session row is clicked', () => {
    vi.mocked(useSessions).mockReturnValue({
      sessions: [
        { id: 's1', name: 'Dev Session', status: 'active', type: 'project', authority: 'human', createdAt: '2026-01-01T00:00:00Z', commandCount: 5 },
      ],
      isLoading: false,
      error: null,
      startSession: vi.fn(),
      stopSession: vi.fn(),
      createSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
    });

    render(<SpacesPage />);

    fireEvent.click(screen.getByText('Dev Session'));

    expect(screen.getByText('Close')).toBeDefined();
  });
});
