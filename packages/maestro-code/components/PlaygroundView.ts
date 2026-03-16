/**
 * PlaygroundView — Interactive model testing component.
 *
 * Provides quick capability tests (1-6) and custom prompt input (/).
 * Used from both ModelsScreen (via [T] in ModelDetail) and /playground command.
 *
 * Props:
 *   modelId     string — selected model ID
 *   modelName   string — display name
 *   apiClient   API client instance
 *   onBack      () => void — return to previous view
 *   keyboardActive  boolean — whether this component owns keyboard
 */

import { createElement as h, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import {
  theme,
  T, muted, primary, bold,
} from '../theme.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { Panel } from './Panel.ts';

// ── Types ─────────────────────────────────────────────────────

interface PlaygroundViewProps {
  modelId: string;
  modelName?: string;
  apiClient: any;
  onBack: () => void;
  keyboardActive?: boolean;
}

type PlaygroundMode = 'menu' | 'test-running' | 'test-result' | 'custom-prompt' | 'custom-running' | 'custom-result';

interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  content: string;
  validationDetails: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
}

interface CustomResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

// ── Quick test labels ─────────────────────────────────────────

const QUICK_TESTS = [
  { id: 'structured-output', label: 'Structured output', key: '1' },
  { id: 'tool-calling', label: 'Tool calling', key: '2' },
  { id: 'long-context', label: 'Long context', key: '3' },
  { id: 'code-generation', label: 'Code generation', key: '4' },
  { id: 'instruction-following', label: 'Instruction following', key: '5' },
  { id: 'multi-lang', label: 'Multi-language', key: '6' },
];

// ── Subcomponents ─────────────────────────────────────────────

const TestResultPanel = ({ result }: { result: TestResult }): ReactNode => {
  const passColor = result.passed ? theme.status.success : theme.status.error;
  const passIcon = result.passed ? '\u2713' : '\u2717';
  const passLabel = result.passed ? 'PASS' : 'FAIL';
  const totalTokens = result.promptTokens + result.completionTokens;
  const timeStr = result.latencyMs < 1000
    ? `${result.latencyMs}ms`
    : `${(result.latencyMs / 1000).toFixed(1)}s`;

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row', marginBottom: 1 },
      h(Text, { color: passColor, bold: true }, `${passIcon} ${passLabel}`),
      h(Text, null, '  '),
      primary(result.testName),
    ),
    result.content
      ? h(Box, { flexDirection: 'column', paddingLeft: 1, marginBottom: 1 },
          h(Box, { borderStyle: 'single', borderColor: theme.panel.border, paddingX: 1 },
            h(Text, { wrap: 'truncate-end' }, result.content.length > 200 ? result.content.substring(0, 200) + '...' : result.content),
          ),
        )
      : null,
    result.validationDetails
      ? h(Box, { flexDirection: 'row', paddingLeft: 1, marginBottom: 1 },
          muted('Details: '),
          h(Text, null, result.validationDetails),
        )
      : null,
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('Tokens: '),
      primary(`${result.promptTokens} + ${result.completionTokens} = ${totalTokens}`),
      h(Text, null, '  '),
      muted('Cost: '),
      primary(`$${result.costUsd.toFixed(4)}`),
      h(Text, null, '  '),
      muted('Time: '),
      primary(timeStr),
    ),
  );
};

const CustomResultPanel = ({ result, prompt }: { result: CustomResult; prompt: string }): ReactNode => {
  const totalTokens = result.promptTokens + result.completionTokens;
  const timeStr = result.latencyMs < 1000
    ? `${result.latencyMs}ms`
    : `${(result.latencyMs / 1000).toFixed(1)}s`;

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row', marginBottom: 1 },
      muted('Prompt: '),
      h(Text, { dimColor: true }, prompt.length > 60 ? prompt.substring(0, 60) + '...' : prompt),
    ),
    h(Box, { flexDirection: 'column', paddingLeft: 1, marginBottom: 1 },
      h(Box, { borderStyle: 'single', borderColor: theme.panel.border, paddingX: 1 },
        h(Text, { wrap: 'truncate-end' }, result.content.length > 400 ? result.content.substring(0, 400) + '...' : result.content),
      ),
    ),
    h(Box, { flexDirection: 'row', paddingLeft: 1 },
      muted('Tokens: '),
      primary(`${result.promptTokens} + ${result.completionTokens} = ${totalTokens}`),
      h(Text, null, '  '),
      muted('Cost: '),
      primary(`$${result.costUsd.toFixed(4)}`),
      h(Text, null, '  '),
      muted('Time: '),
      primary(timeStr),
    ),
  );
};

// ── PlaygroundView component ──────────────────────────────────

const PlaygroundView = ({ modelId, modelName, apiClient, onBack, keyboardActive }: PlaygroundViewProps): ReactNode => {
  const displayName = modelName || modelId;
  const [mode, setMode] = useState<PlaygroundMode>('menu');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [customResult, setCustomResult] = useState<CustomResult | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptBuffer, setPromptBuffer] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runTest = useCallback(async (testId: string) => {
    setMode('test-running');
    setError(null);
    try {
      const result = await apiClient.playgroundRunTest({ modelId, testId });
      setTestResult(result);
      setMode('test-result');
    } catch (err: any) {
      setError(err?.message || 'Failed to run test');
      setMode('menu');
    }
  }, [apiClient, modelId]);

  const sendCustomPrompt = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setMode('menu');
      return;
    }
    setCustomPrompt(prompt);
    setMode('custom-running');
    setError(null);
    try {
      const result = await apiClient.playgroundSend({ modelId, prompt });
      setCustomResult(result);
      setMode('custom-result');
    } catch (err: any) {
      setError(err?.message || 'Failed to send prompt');
      setMode('menu');
    }
  }, [apiClient, modelId]);

  // Keyboard handling
  useKeyboard({
    number: (n: number) => {
      if (mode === 'custom-prompt') return; // don't intercept typing
      if (n >= 1 && n <= 6 && (mode === 'menu' || mode === 'test-result' || mode === 'custom-result')) {
        const test = QUICK_TESTS[n - 1];
        if (test) runTest(test.id);
      }
    },
    escape: () => {
      if (mode === 'custom-prompt') {
        setMode('menu');
        setPromptBuffer('');
      } else {
        onBack();
      }
    },
  }, { isActive: keyboardActive !== false && mode !== 'custom-prompt' });

  // Render content based on mode
  let content: ReactNode;

  switch (mode) {
    case 'menu':
      content = h(Box, { flexDirection: 'column' },
        h(Box, { flexDirection: 'column', marginBottom: 1 },
          h(Text, { bold: true, color: theme.panel.borderFocused }, '  Quick tests:'),
          h(Box, { flexDirection: 'row', paddingLeft: 2, flexWrap: 'wrap' },
            ...QUICK_TESTS.slice(0, 3).map(t =>
              h(Box, { key: t.id, marginRight: 2 },
                h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
                h(Text, { color: theme.shortcut.key }, t.key),
                h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
                muted(t.label),
              ),
            ),
          ),
          h(Box, { flexDirection: 'row', paddingLeft: 2, flexWrap: 'wrap' },
            ...QUICK_TESTS.slice(3, 6).map(t =>
              h(Box, { key: t.id, marginRight: 2 },
                h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
                h(Text, { color: theme.shortcut.key }, t.key),
                h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
                muted(t.label),
              ),
            ),
          ),
        ),
        h(Text, { color: theme.text.muted, dimColor: true }, '  Press 1-6 to run a test, Esc to go back'),
        error
          ? h(Box, { marginTop: 1, paddingLeft: 2 },
              h(Text, { color: 'red' }, `Error: ${error}`),
            )
          : null,
      );
      break;

    case 'test-running':
      content = h(Box, { flexDirection: 'column', paddingLeft: 2 },
        h(Text, { color: theme.status.warning }, 'Running test...'),
      );
      break;

    case 'test-result':
      content = h(Box, { flexDirection: 'column', paddingLeft: 1 },
        testResult ? h(TestResultPanel, { result: testResult }) : null,
        h(Text, null, ''),
        h(Text, { color: theme.text.muted, dimColor: true }, '  Press 1-6 for another test, Esc to go back'),
      );
      break;

    case 'custom-running':
      content = h(Box, { flexDirection: 'column', paddingLeft: 2 },
        h(Text, { color: theme.status.warning }, 'Sending prompt...'),
      );
      break;

    case 'custom-result':
      content = h(Box, { flexDirection: 'column', paddingLeft: 1 },
        customResult ? h(CustomResultPanel, { result: customResult, prompt: customPrompt }) : null,
        h(Text, null, ''),
        h(Text, { color: theme.text.muted, dimColor: true }, '  Press 1-6 for a test, Esc to go back'),
      );
      break;

    default:
      content = null;
  }

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Header
    h(Panel, { title: `PLAYGROUND: ${displayName}`, width: '100%' },
      h(Box, { flexDirection: 'column', paddingLeft: 1 },
        h(Box, { flexDirection: 'row' },
          muted('Model: '),
          bold(modelId),
        ),
      ),
    ),

    // Main content
    h(Panel, { title: 'TEST', flexGrow: 1 },
      content,
    ),

    // Footer shortcuts
    h(Box, { flexDirection: 'row', paddingLeft: 1, paddingY: 0 },
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, '1-6'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Run test'),
      h(Text, null, '  '),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'Esc'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Back'),
    ),
  );
};

export { PlaygroundView };
