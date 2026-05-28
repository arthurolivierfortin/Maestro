import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('renders the cmdline vocabulary with a prompt glyph', () => {
    const { container } = render(
      <ChatInput onSend={vi.fn()} onSlashCommand={vi.fn()} isLoading={false} />
    );
    expect(container.querySelector('.cmdline')).not.toBeNull();
    expect(container.querySelector('.cmdline .prompt')).not.toBeNull();
  });

  it('shows autocomplete when "/" is typed', () => {
    render(<ChatInput onSend={vi.fn()} onSlashCommand={vi.fn()} isLoading={false} />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: '/' } });
    expect(screen.getByText('/help')).toBeDefined();
  });

  it('hides autocomplete when input does not start with "/"', () => {
    render(<ChatInput onSend={vi.fn()} onSlashCommand={vi.fn()} isLoading={false} />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.queryByText('/help')).toBeNull();
  });

  it('calls onSlashCommand with parsed command on Enter when autocomplete is visible', () => {
    const onSlashCommand = vi.fn();
    render(<ChatInput onSend={vi.fn()} onSlashCommand={onSlashCommand} isLoading={false} />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: '/help' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSlashCommand).toHaveBeenCalledWith('help', '');
  });

  it('calls onSend for non-slash input on Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} onSlashCommand={vi.fn()} isLoading={false} />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('hides autocomplete on Escape', () => {
    render(<ChatInput onSend={vi.fn()} onSlashCommand={vi.fn()} isLoading={false} />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: '/' } });
    expect(screen.getByText('/help')).toBeDefined();
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByText('/help')).toBeNull();
  });

  it('navigates autocomplete with ArrowDown and selects with Enter', () => {
    const onSlashCommand = vi.fn();
    render(<ChatInput onSend={vi.fn()} onSlashCommand={onSlashCommand} isLoading={false} />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...');
    fireEvent.change(textarea, { target: { value: '/' } });
    // Move down once to select second item (/clear)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSlashCommand).toHaveBeenCalledWith('clear', '');
  });

  it('clears input after command execution', () => {
    render(<ChatInput onSend={vi.fn()} onSlashCommand={vi.fn()} isLoading={false} />);
    const textarea = screen.getByPlaceholderText('Type a message or / for commands...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '/help' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('');
  });
});
