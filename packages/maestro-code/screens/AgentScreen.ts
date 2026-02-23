// @ts-nocheck
/**
 * AgentScreen — HOME screen: agent conversation + activity overlay.
 *
 * This is where the user talks to the Maestro agent.
 * Like the Flipper Zero's dolphin screen — the main interface.
 *
 * Layout:
 * ┌─ AGENT ──────────────────────────────────────┐
 * │ [Agent activity overlay when working]         │
 * │ ─────────────────────────────────────────     │
 * │ > User: Add a login page                     │
 * │   Creating session...                         │
 * │   Session: abcdef12                           │
 * │   ▶ Plan                                      │
 * │   ✓ Plan                                      │
 * │   ▶ Implement                                 │
 * │                                               │
 * ├───────────────────────────────────────────────┤
 * │ > Describe your task...                       │
 * └───────────────────────────────────────────────┘
 */

import { createElement as h, useState, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { Panel } from '@maestro/tui/components';
import type { AgentState, LogLine, Widget } from '../types.ts';
import { AgentActivity } from '../panels/AgentActivity.ts';

// ── Timestamp helper ──────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

// ── OutputPanel (inline — renders log lines) ──────────────────

const OutputPanel = ({ lines, height }) => {
  const maxLines = Math.max(height - 2, 1);
  const visible = lines.slice(-maxLines);

  return h(Box, {
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
    ...visible.map((line, i) =>
      h(Box, { key: i },
        line.timestamp
          ? h(Text, { color: 'gray', dimColor: true }, `${line.timestamp} `)
          : null,
        h(Text, {
          color: (line.color || 'white'),
          bold: line.bold,
          dimColor: line.dim,
        }, line.text)
      )
    ),
    visible.length === 0
      ? h(Text, { color: 'gray', dimColor: true }, 'Waiting for input...')
      : null
  );
};

// ── InputPrompt ───────────────────────────────────────────────

const InputPrompt = ({ onSubmit, disabled, placeholder, onUpArrow, onDownArrow }) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const valueRef = useRef('');
  const cursorRef = useRef(0);

  useInput((input, key) => {
    if (disabled) return;

    let v = valueRef.current;
    let c = cursorRef.current;

    if (key.return) {
      if (v.trim()) {
        onSubmit(v.trim());
        v = '';
        c = 0;
      }
    } else if (key.upArrow && !v && onUpArrow) {
      const hist = onUpArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.downArrow && onDownArrow) {
      const hist = onDownArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.backspace || key.delete) {
      if (c > 0) { v = v.slice(0, c - 1) + v.slice(c); c = c - 1; }
    } else if (key.leftArrow) {
      c = Math.max(0, c - 1);
    } else if (key.rightArrow) {
      c = Math.min(v.length, c + 1);
    } else if (input === 'a' && key.ctrl) {
      c = 0;
    } else if (input === 'e' && key.ctrl) {
      c = v.length;
    } else if (input && !key.ctrl && !key.meta) {
      v = v.slice(0, c) + input + v.slice(c);
      c = c + input.length;
    }

    valueRef.current = v;
    cursorRef.current = c;
    setValue(v);
    setCursor(c);
  });

  const prompt = disabled ? '...' : '>';
  const promptColor = disabled ? 'gray' : 'green';

  return h(Box, {
    borderStyle: 'round',
    borderColor: disabled ? 'gray' : 'cyan',
    paddingX: 1,
    flexShrink: 0,
  },
    h(Text, { color: promptColor, bold: true }, `${prompt} `),
    h(Text, null,
      value || h(Text, { color: 'gray', dimColor: true }, placeholder || 'Describe your task...')
    )
  );
};

// ── AgentScreen ───────────────────────────────────────────────

interface AgentScreenProps {
  lines: LogLine[];
  busy: boolean;
  agentState: AgentState;
  agentIsHere: boolean;
  sessionId: string | null;
  taskSummary?: string;
  currentWidget: Widget | null;
  pendingInteractive: Widget | null;
  onSubmit: (input: string) => void;
  onUpArrow?: () => string | null;
  onDownArrow?: () => string | null;
  height: number;
}

const AgentScreen = ({
  lines,
  busy,
  agentState,
  agentIsHere,
  sessionId,
  taskSummary,
  currentWidget,
  pendingInteractive,
  onSubmit,
  onUpArrow,
  onDownArrow,
  height,
}: AgentScreenProps) => {
  // Calculate output height: total - activity panel (3) - input (3) - margins
  const activityHeight = agentIsHere && agentState !== 'idle' ? 3 : 0;
  const outputHeight = Math.max(height - activityHeight - 5, 3);

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    // Agent activity overlay (only when agent is here and active)
    agentIsHere && agentState !== 'idle'
      ? h(AgentActivity, {
          agentState,
          taskSummary,
          sessionId,
        })
      : null,

    // Conversation output
    h(Panel, { title: 'AGENT', focused: true, flexGrow: 1 },
      h(OutputPanel, { lines, height: outputHeight }),
    ),

    // Input prompt
    h(InputPrompt, {
      onSubmit,
      disabled: false,
      placeholder: pendingInteractive
        ? 'Respond to the agent...'
        : busy
          ? 'Send a message to the agent...'
          : 'Describe your task...',
      onUpArrow,
      onDownArrow,
    }),
  );
};

export { AgentScreen, OutputPanel, InputPrompt };
