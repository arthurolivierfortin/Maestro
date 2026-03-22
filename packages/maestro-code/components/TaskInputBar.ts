/**
 * TaskInputBar -- Fixed text input for task submission.
 *
 * Shown above StatusBar. Handles text input, cursor, Enter to submit,
 * Up/Down for input history, Ctrl+A/E for home/end.
 *
 * Phase 63-FIX: Added slash command autocomplete and alwaysActive mode.
 */

import { createElement as h, useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useManagedInput } from '../hooks/useManagedInput.ts';
import { SlashAutocomplete, SLASH_COMMANDS } from './SlashAutocomplete.ts';

export interface TaskInputBarProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onUpArrow?: () => string | null;
  onDownArrow?: () => string | null;
  captureInput?: boolean;
  /** When true, input is always active (chat-first mode). No slash-to-focus needed. */
  alwaysActive?: boolean;
  /** Shared ref for the current input value — allows parent to read/clear input. */
  inputValueRef?: React.MutableRefObject<string>;
}

const TaskInputBar = ({ onSubmit, disabled, placeholder, onUpArrow, onDownArrow, captureInput, alwaysActive, inputValueRef }: TaskInputBarProps) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const [acIndex, setAcIndex] = useState(0);
  const valueRef = useRef('');
  const cursorRef = useRef(0);
  const acIndexRef = useRef(0);

  // Clear value when input loses focus (Escape) -- only in classic mode
  useEffect(() => {
    if (!captureInput && !alwaysActive) {
      setValue('');
      setCursor(0);
      valueRef.current = '';
      cursorRef.current = 0;
    }
  }, [captureInput, alwaysActive]);

  // Reset autocomplete index when value changes
  useEffect(() => {
    setAcIndex(0);
    acIndexRef.current = 0;
  }, [value]);

  // Determine if autocomplete is showing
  const showAutocomplete = value.startsWith('/') && value.indexOf(' ') === -1 && value.length > 0;
  const acFiltered = showAutocomplete
    ? SLASH_COMMANDS.filter(cmd => cmd.command.startsWith(value.toLowerCase()))
    : [];

  // Use raw useInput for the input handler. In chat-first mode (alwaysActive),
  // useManagedInput('input') can be blocked by focus layer conflicts.
  // Raw useInput always fires, with manual gating via captureInput/alwaysActive.
  useInput((input: string, key: import('ink').Key) => {
    if (disabled) return;
    if (!(captureInput || alwaysActive)) return;

    let v = valueRef.current;
    let c = cursorRef.current;

    // When autocomplete is visible, Tab/Enter selects the current suggestion
    const isAcVisible = v.startsWith('/') && v.indexOf(' ') === -1 && v.length > 0;
    const filtered = isAcVisible
      ? SLASH_COMMANDS.filter(cmd => cmd.command.startsWith(v.toLowerCase()))
      : [];

    if (isAcVisible && filtered.length > 0 && key.tab) {
      // Tab-complete: replace input with selected command + space
      const selected = filtered[Math.min(acIndexRef.current, filtered.length - 1)];
      v = selected.command + ' ';
      c = v.length;
      valueRef.current = v;
      cursorRef.current = c;
      setValue(v);
      setCursor(c);
      return;
    }

    if (isAcVisible && filtered.length > 0 && (key.upArrow || key.downArrow)) {
      // Arrow keys navigate autocomplete instead of history
      const maxIdx = Math.min(filtered.length - 1, 7); // max 8 visible
      if (key.upArrow) {
        acIndexRef.current = Math.max(0, acIndexRef.current - 1);
      } else {
        acIndexRef.current = Math.min(maxIdx, acIndexRef.current + 1);
      }
      setAcIndex(acIndexRef.current);
      return;
    }

    if (key.return) {
      // If autocomplete is visible, handle completion/submission
      if (isAcVisible && filtered.length > 0) {
        const exact = filtered.find(cmd => cmd.command === v.toLowerCase());
        if (exact) {
          // Exact match — submit directly (e.g., /quit, /help, /status)
          v = exact.command;
        } else if (filtered.length === 1) {
          // Single match — auto-complete and submit
          v = filtered[0].command;
        } else {
          // Multiple matches — complete with selected suggestion
          const selected = filtered[Math.min(acIndexRef.current, filtered.length - 1)];
          v = selected.command;
        }
      }
      if (v.trim()) {
        onSubmit(v.trim());
        v = '';
        c = 0;
      }
    } else if (key.upArrow && onUpArrow && !isAcVisible) {
      const hist = onUpArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.downArrow && onDownArrow && !isAcVisible) {
      const hist = onDownArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.backspace || key.delete) {
      if (c > 0) {
        v = v.slice(0, c - 1) + v.slice(c);
        c = c - 1;
      }
    } else if (key.leftArrow) {
      c = Math.max(0, c - 1);
    } else if (key.rightArrow) {
      c = Math.min(v.length, c + 1);
    } else if (input === 'a' && key.ctrl) {
      c = 0;
    } else if (input === 'e' && key.ctrl) {
      c = v.length;
    } else if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
      v = v.slice(0, c) + input + v.slice(c);
      c = c + input.length;
    }

    valueRef.current = v;
    cursorRef.current = c;
    if (inputValueRef) inputValueRef.current = v;
    setValue(v);
    setCursor(c);
  });

  const isActive = captureInput || alwaysActive;
  const prompt = disabled ? '...' : isActive ? '>' : '/';
  const promptColor = disabled ? 'gray' : isActive ? 'green' : 'gray';
  const borderColor = disabled ? 'gray' : isActive ? 'cyan' : 'gray';

  return h(Box, { flexDirection: 'column', flexShrink: 0 },
    // Autocomplete dropdown (above input)
    showAutocomplete && acFiltered.length > 0
      ? h(SlashAutocomplete, { input: value, selectedIndex: acIndex })
      : null,
    // Input bar
    h(Box, {
      borderStyle: 'round',
      borderColor,
      paddingX: 1,
      flexShrink: 0,
    },
      h(Text, { color: promptColor, bold: true }, `${prompt} `),
      h(Text, null,
        value || h(Text, { color: 'gray', dimColor: true },
          disabled ? 'Agent is working...'
            : isActive ? (placeholder || 'Describe your task...') : 'Press / to type...'
        )
      ),
    ),
  );
};

export { TaskInputBar };
