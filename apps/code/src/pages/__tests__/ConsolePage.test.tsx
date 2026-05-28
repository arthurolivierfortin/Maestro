import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsolePage } from '../ConsolePage';

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

const mockSendMessage = vi.fn();
const mockClearMessages = vi.fn();
const mockStopGeneration = vi.fn();

vi.mock('../../hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    isLoading: false,
    error: null,
    streamingContent: '',
    sendMessage: mockSendMessage,
    clearMessages: mockClearMessages,
    stopGeneration: mockStopGeneration,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConsolePage', () => {
  it('renders chat input with slash command support', () => {
    render(<ConsolePage />);
    expect(screen.getByPlaceholderText('Type a message or / for commands...')).toBeDefined();
  });

  it('/clear command calls clearMessages', () => {
    render(<ConsolePage />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: '/clear' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(mockClearMessages).toHaveBeenCalledOnce();
  });

  it('/stop command calls stopGeneration', () => {
    render(<ConsolePage />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: '/stop' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(mockStopGeneration).toHaveBeenCalledOnce();
  });

  it('/new command calls clearMessages', () => {
    render(<ConsolePage />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: '/new' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(mockClearMessages).toHaveBeenCalledOnce();
  });

  it('/help command toggles help overlay', () => {
    render(<ConsolePage />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');

    // First /help shows overlay
    fireEvent.change(textarea, { target: { value: '/help' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();

    // Second /help hides overlay
    fireEvent.change(textarea, { target: { value: '/help' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
  });

  it('shows empty state when no messages', () => {
    render(<ConsolePage />);
    expect(screen.getByText('Type a message to start a conversation.')).toBeDefined();
  });

  it('wraps messages in a conv container', () => {
    const { container } = render(<ConsolePage />);
    expect(container.querySelector('.conv')).not.toBeNull();
  });
});
