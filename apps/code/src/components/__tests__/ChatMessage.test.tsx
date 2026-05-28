import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage role lines', () => {
  it('renders a user line with a prefix', () => {
    const { container } = render(<ChatMessage role="user" content="hi" />);
    expect(container.querySelector('.line.user')).not.toBeNull();
    expect(container.querySelector('.line.user .pre')).not.toBeNull();
  });

  it('renders an agent line', () => {
    const { container } = render(<ChatMessage role="assistant" content="ok" />);
    expect(container.querySelector('.line.agent')).not.toBeNull();
  });

  it('shows a caret while streaming', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="..." isStreaming />
    );
    expect(container.querySelector('.caret')).not.toBeNull();
  });

  it('renders the message content', () => {
    const { container } = render(<ChatMessage role="user" content="hello world" />);
    expect(container.querySelector('.line.user .body')?.textContent).toContain('hello world');
  });
});
