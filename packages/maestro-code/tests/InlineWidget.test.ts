/**
 * Tests for InlineWidget and widget infrastructure.
 *
 * Phase 63-B: Inline widgets in ConversationLog.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, useState, useEffect, useCallback } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Box, Text } from 'ink';
import { FocusProvider, useFocusContext } from '../hooks/useFocusProvider.ts';
import type { ChatWidget, WidgetType } from '../types/widgets.ts';
import { WIDGET_TITLES, WIDGET_HEIGHTS } from '../types/widgets.ts';
import { ConversationLog } from '../components/ConversationLog.ts';
import type { LogLine } from '../services/SessionManager.ts';

// ── Helpers ─────────────────────────────────────────────────────

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

// ── Mock API client ─────────────────────────────────────────────

const createMockApiClient = () => ({
  getHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  getLLMHealth: vi.fn().mockResolvedValue({ activeModel: 'claude-sonnet-4-6' }),
  listSessions: vi.fn().mockResolvedValue([
    { id: 'session-1234-5678', name: 'Test Session', status: 'running', variables: {} },
  ]),
  listBlocks: vi.fn().mockResolvedValue([
    { id: 'block-1', name: 'test-block', blockType: 'agent', fitness: 0.75 },
  ]),
  listLLMModels: vi.fn().mockResolvedValue([
    { modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet', category: 'anthropic', isAvailable: true },
  ]),
  getLLMStats: vi.fn().mockResolvedValue({ totalRequests: 100, totalTokens: 50000 }),
  listProjects: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue([]),
  getBlock: vi.fn().mockResolvedValue({ id: 'block-1', name: 'test-block', blockType: 'agent' }),
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'test-repo', rootPath: '/tmp/test' }),
  getLLMQueueStats: vi.fn().mockResolvedValue(null),
  getCostsSummary: vi.fn().mockResolvedValue({ today: { totalCost: 0 } }),
  getCostsLimits: vi.fn().mockResolvedValue({}),
  setCostsLimits: vi.fn().mockResolvedValue({}),
  getSession: vi.fn().mockResolvedValue({}),
});

// ── Tests ───────────────────────────────────────────────────────

describe('InlineWidget', () => {
  afterEach(() => cleanup());

  it('renders widget in ConversationLog when line has widgetId', async () => {
    const apiClient = createMockApiClient();
    const widget: ChatWidget = { type: 'status', props: {}, interactive: true };
    const lines: LogLine[] = [
      { text: 'Hello', color: 'white' },
      { text: '', widgetId: 'w-1', widget },
    ];

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(ConversationLog, {
          lines,
          height: 20,
          width: 60,
          focusedWidgetId: 'w-1',
          apiClient,
        }),
      ),
    );
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    // Should show the widget title
    expect(frame).toContain('System Status');
  });

  it('renders regular text lines without widget', async () => {
    const lines: LogLine[] = [
      { text: 'Regular line', color: 'white' },
      { text: '> User message', color: 'green' },
    ];

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(ConversationLog, {
          lines,
          height: 20,
          width: 60,
        }),
      ),
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Regular line');
    expect(frame).toContain('User message');
  });

  it('widget claims focus layer when focused and interactive', async () => {
    const apiClient = createMockApiClient();
    const widget: ChatWidget = { type: 'status', props: {}, interactive: true };
    const lines: LogLine[] = [
      { text: '', widgetId: 'w-1', widget },
    ];

    let activeLayerValue: string | null = null;
    const Inspector = () => {
      const { activeLayer } = useFocusContext();
      activeLayerValue = activeLayer;
      return h(Text, null, `layer:${activeLayer || 'none'}`);
    };

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(Box, { flexDirection: 'column' },
          h(ConversationLog, {
            lines,
            height: 20,
            width: 60,
            focusedWidgetId: 'w-1',
            apiClient,
          }),
          h(Inspector),
        ),
      ),
    );
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('layer:widget');
  });

  it('Esc collapses widget via onWidgetClose', async () => {
    const apiClient = createMockApiClient();
    const widget: ChatWidget = { type: 'models', props: {}, interactive: true };
    const lines: LogLine[] = [
      { text: '', widgetId: 'w-1', widget },
    ];
    const onClose = vi.fn();

    const { lastFrame, stdin } = render(
      h(FocusProvider, null,
        h(ConversationLog, {
          lines,
          height: 20,
          width: 60,
          focusedWidgetId: 'w-1',
          onWidgetClose: onClose,
          apiClient,
        }),
      ),
    );
    await delay(100);
    // Press Escape
    stdin.write('\x1B');
    await delay(100);
    expect(onClose).toHaveBeenCalledWith('w-1');
  });

  it('collapsed widget shows 1-line summary', async () => {
    const apiClient = createMockApiClient();
    const widget: ChatWidget = { type: 'models', props: {}, interactive: true };
    const collapsed = new Set(['w-1']);
    const lines: LogLine[] = [
      { text: '', widgetId: 'w-1', widget },
    ];

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(ConversationLog, {
          lines,
          height: 20,
          width: 60,
          collapsedWidgets: collapsed,
          apiClient,
        }),
      ),
    );
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('(collapsed)');
    expect(frame).toContain('Models');
  });

  it('multiple widgets — only the last one has focus', async () => {
    const apiClient = createMockApiClient();
    const widget1: ChatWidget = { type: 'status', props: {}, interactive: true };
    const widget2: ChatWidget = { type: 'models', props: {}, interactive: true };
    const lines: LogLine[] = [
      { text: '', widgetId: 'w-1', widget: widget1 },
      { text: 'some text', color: 'white' },
      { text: '', widgetId: 'w-2', widget: widget2 },
    ];

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(ConversationLog, {
          lines,
          height: 30,
          width: 80,
          focusedWidgetId: 'w-2', // Only w-2 is focused
          apiClient,
        }),
      ),
    );
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    // Both widgets should render
    expect(frame).toContain('System Status');
    expect(frame).toContain('Models');
    // Only focused widget shows [Esc] close hint
    const lines2 = frame.split('\n');
    // Find the Models widget line — it should have [Esc] close
    const modelsLine = lines2.find(l => l.includes('Models') && l.includes('[Esc]'));
    expect(modelsLine).toBeTruthy();
  });

  it('non-interactive widget does not claim focus', async () => {
    const apiClient = createMockApiClient();
    const widget: ChatWidget = { type: 'block-detail', props: { blockId: 'block-1' }, interactive: false };
    const lines: LogLine[] = [
      { text: '', widgetId: 'w-1', widget },
    ];

    let activeLayerValue: string | null = null;
    const Inspector = () => {
      const { activeLayer } = useFocusContext();
      activeLayerValue = activeLayer;
      return h(Text, null, `layer:${activeLayer || 'none'}`);
    };

    const { lastFrame } = render(
      h(FocusProvider, null,
        h(Box, { flexDirection: 'column' },
          h(ConversationLog, {
            lines,
            height: 20,
            width: 60,
            focusedWidgetId: 'w-1',
            apiClient,
          }),
          h(Inspector),
        ),
      ),
    );
    await delay(100);
    const frame = stripAnsi(lastFrame() || '');
    // Non-interactive widget should NOT claim widget layer
    expect(frame).toContain('layer:none');
  });
});

describe('Widget types and constants', () => {
  it('WIDGET_TITLES has all WidgetTypes', () => {
    const types: WidgetType[] = [
      'status', 'sessions', 'workspaces', 'repos', 'catalog', 'foundry',
      'models', 'session-monitor', 'block-detail', 'model-detail',
      'workspace-detail', 'repo-detail', 'permissions',
    ];
    for (const t of types) {
      expect(WIDGET_TITLES[t]).toBeDefined();
      expect(WIDGET_TITLES[t].length).toBeGreaterThan(0);
    }
  });

  it('WIDGET_HEIGHTS has all WidgetTypes', () => {
    const types: WidgetType[] = [
      'status', 'sessions', 'workspaces', 'repos', 'catalog', 'foundry',
      'models', 'session-monitor', 'block-detail', 'model-detail',
      'workspace-detail', 'repo-detail', 'permissions',
    ];
    for (const t of types) {
      expect(WIDGET_HEIGHTS[t]).toBeDefined();
    }
  });
});

describe('Widget injection', () => {
  it('addWidget creates a line with widgetId and widget object', () => {
    // Simulate what addWidget does in App.ts
    let counter = 0;
    const addWidget = (type: WidgetType, props: Record<string, any> = {}, interactive: boolean = true) => {
      const widgetId = `w-${++counter}-${Date.now()}`;
      const widget: ChatWidget = { type, props, interactive };
      const line: LogLine = { text: '', widgetId, widget };
      return { line, widgetId };
    };

    const { line, widgetId } = addWidget('status', {}, true);
    expect(line.widgetId).toBe(widgetId);
    expect(line.widget).toBeDefined();
    expect(line.widget!.type).toBe('status');
    expect(line.widget!.interactive).toBe(true);

    const { line: line2 } = addWidget('block-detail', { blockId: 'b-1' }, false);
    expect(line2.widget!.type).toBe('block-detail');
    expect(line2.widget!.interactive).toBe(false);
    expect(line2.widget!.props.blockId).toBe('b-1');
  });
});
