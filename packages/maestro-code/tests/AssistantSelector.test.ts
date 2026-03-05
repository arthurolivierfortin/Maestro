/**
 * Tests for AssistantSelector — contract-based assistant selection component.
 */
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { render } from 'ink-testing-library';
import { DemoApiClient } from '../mocks/DemoApiClient.ts';
import { AssistantSelector } from '../components/AssistantSelector.ts';

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

describe('AssistantSelector', () => {
  it('renders loading state initially', () => {
    const client = new DemoApiClient();
    const onSelect = vi.fn();
    const { lastFrame } = render(h(AssistantSelector, { apiClient: client, onSelect }));
    expect(lastFrame()).toContain('Loading');
  });

  it('shows assistant blocks after loading', async () => {
    const client = new DemoApiClient();
    const onSelect = vi.fn();
    const { lastFrame } = render(h(AssistantSelector, { apiClient: client, onSelect }));
    await delay(500);
    const frame = lastFrame() || '';
    expect(frame).toContain('Choose Your Assistant');
    expect(frame).toContain('Maestro Assistant');
    expect(frame).toContain('Recommended');
  });

  it('shows active features for selected block', async () => {
    const client = new DemoApiClient();
    const onSelect = vi.fn();
    const { lastFrame } = render(h(AssistantSelector, { apiClient: client, onSelect }));
    await delay(500);
    const frame = lastFrame() || '';
    // Full assistant should show features as active (+ prefix)
    // Feature names come from DemoApiClient's DEMO_CONTRACTS (lowercase keys)
    expect(frame).toContain('+');
    expect(frame).toContain('5/5 active');
  });

  it('shows feature count for compact block', async () => {
    const client = new DemoApiClient();
    const onSelect = vi.fn();
    const { lastFrame } = render(h(AssistantSelector, { apiClient: client, onSelect }));
    await delay(500);
    const frame = lastFrame() || '';
    // Compact has only 1 active feature (conversation)
    expect(frame).toContain('1/5 active');
  });
});
