import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StatusBar } from '../StatusBar';

let backendStatus = { connected: true, checking: false };
vi.mock('../../hooks/useBackendStatus', () => ({
  useBackendStatus: () => backendStatus,
}));

describe('StatusBar', () => {
  it('renders the status line with a mode badge', () => {
    backendStatus = { connected: true, checking: false };
    const { container } = render(<StatusBar />);
    expect(container.querySelector('.status')).not.toBeNull();
    expect(container.querySelector('.mode')?.textContent).toBe('NORMAL');
  });

  it('renders keybind hints and the backend pip', () => {
    backendStatus = { connected: true, checking: false };
    const { container } = render(<StatusBar />);
    expect(container.querySelector('.k')).not.toBeNull();
    expect(container.querySelector('.pip')).not.toBeNull();
  });

  it('reflects the disconnected state on the pip', () => {
    backendStatus = { connected: false, checking: false };
    const { container } = render(<StatusBar />);
    expect(container.querySelector('.pip.off')).not.toBeNull();
  });
});
