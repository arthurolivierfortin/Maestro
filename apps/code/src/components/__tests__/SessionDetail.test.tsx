import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionDetail } from '../SessionDetail';
import type { SessionDto } from '../../services/sessionService';

const base: SessionDto = {
  id: 's1',
  name: 'Sess',
  status: 'active',
  type: 'project',
  authority: 'human',
  createdAt: '2026-01-01T00:00:00Z',
  commandCount: 3,
  repositoryPath: 'C:/P',
};

function renderDetail(session: SessionDto, overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const handlers = {
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SessionDetail session={session} {...handlers} />);
  return handlers;
}

describe('SessionDetail', () => {
  it('renders session fields', () => {
    renderDetail(base);
    expect(screen.getByText('Sess')).toBeDefined();
    expect(screen.getByText('C:/P')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows Pause and Stop for an active session, not Resume', () => {
    renderDetail(base);
    expect(screen.queryByText('Pause')).not.toBeNull();
    expect(screen.queryByText('Stop')).not.toBeNull();
    expect(screen.queryByText('Resume')).toBeNull();
  });

  it('shows Resume and Stop for a paused session, not Pause', () => {
    renderDetail({ ...base, status: 'paused' });
    expect(screen.queryByText('Resume')).not.toBeNull();
    expect(screen.queryByText('Stop')).not.toBeNull();
    expect(screen.queryByText('Pause')).toBeNull();
  });

  it('shows Start for a created session', () => {
    renderDetail({ ...base, status: 'created' });
    expect(screen.queryByText('Start')).not.toBeNull();
    expect(screen.queryByText('Pause')).toBeNull();
  });

  it('shows both Start and Stop for an idle session (real backend status)', () => {
    renderDetail({ ...base, status: 'idle' });
    expect(screen.queryByText('Start')).not.toBeNull();
    expect(screen.queryByText('Stop')).not.toBeNull();
    expect(screen.queryByText('Pause')).toBeNull();
    expect(screen.queryByText('Resume')).toBeNull();
  });

  it('shows Stop (not Start) for a running session', () => {
    renderDetail({ ...base, status: 'running' });
    expect(screen.queryByText('Stop')).not.toBeNull();
    expect(screen.queryByText('Pause')).not.toBeNull();
    expect(screen.queryByText('Start')).toBeNull();
  });

  it('calls onDelete with the session id and onClose', () => {
    const handlers = renderDetail(base);
    fireEvent.click(screen.getByText('Delete'));
    expect(handlers.onDelete).toHaveBeenCalledWith('s1');
    fireEvent.click(screen.getByText('Close'));
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('calls onPause with the session id', () => {
    const handlers = renderDetail(base);
    fireEvent.click(screen.getByText('Pause'));
    expect(handlers.onPause).toHaveBeenCalledWith('s1');
  });
});
