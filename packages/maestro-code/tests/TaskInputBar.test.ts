// @ts-nocheck
/**
 * Tests for TaskInputBar component (Phase 42).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, cleanup } from 'ink-testing-library';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

function typeText(stdin: any, text: string) {
  for (const ch of text) {
    stdin.write(ch);
  }
}

const ENTER = '\r';
const BACKSPACE = '\x7F';

describe('TaskInputBar', () => {
  afterEach(() => cleanup());

  it('shows default placeholder', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const { lastFrame } = render(h(TaskInputBar, { onSubmit: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Describe your task...');
  });

  it('shows custom placeholder', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const { lastFrame } = render(h(TaskInputBar, { onSubmit: vi.fn(), placeholder: 'Send...' }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Send...');
  });

  it('shows > prompt when enabled', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const { lastFrame } = render(h(TaskInputBar, { onSubmit: vi.fn() }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('>');
  });

  it('shows ... prompt when disabled', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const { lastFrame } = render(h(TaskInputBar, { onSubmit: vi.fn(), disabled: true }));
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('...');
  });

  it('renders typed text', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit: vi.fn() }));
    await delay();
    typeText(stdin, 'hello');
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('hello');
  });

  it('submits on Enter and clears', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit }));
    await delay();
    typeText(stdin, 'my task');
    await delay();
    stdin.write(ENTER);
    await delay();
    expect(onSubmit).toHaveBeenCalledWith('my task');
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Describe your task...');
  });

  it('does not submit empty input', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const onSubmit = vi.fn();
    const { stdin } = render(h(TaskInputBar, { onSubmit }));
    await delay();
    stdin.write(ENTER);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores input when disabled', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit, disabled: true }));
    await delay();
    typeText(stdin, 'test');
    stdin.write(ENTER);
    expect(onSubmit).not.toHaveBeenCalled();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).not.toContain('test');
  });

  it('handles backspace', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const { lastFrame, stdin } = render(h(TaskInputBar, { onSubmit: vi.fn() }));
    await delay();
    typeText(stdin, 'hello');
    stdin.write(BACKSPACE);
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('hell');
    expect(frame).not.toContain('hello');
  });

  it('calls onUpArrow for history navigation', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const onUp = vi.fn().mockReturnValue('previous command');
    const { lastFrame, stdin } = render(h(TaskInputBar, {
      onSubmit: vi.fn(),
      onUpArrow: onUp,
    }));
    await delay();
    stdin.write('\x1B[A'); // Up arrow
    await delay();
    expect(onUp).toHaveBeenCalled();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('previous command');
  });

  it('has round border style', async () => {
    const { TaskInputBar } = await import('../components/TaskInputBar.ts');
    const { lastFrame } = render(h(TaskInputBar, { onSubmit: vi.fn() }));
    const frame = lastFrame() || '';
    // Round border uses ╭ ╮ ╰ ╯ characters
    expect(frame).toMatch(/[╭╮╰╯]/);
  });
});
