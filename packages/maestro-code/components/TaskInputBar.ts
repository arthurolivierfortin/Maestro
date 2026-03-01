// @ts-nocheck
/**
 * TaskInputBar — Fixed text input for task submission.
 *
 * Shown above StatusBar. Handles text input, cursor, Enter to submit,
 * Up/Down for input history, Ctrl+A/E for home/end.
 *
 * Extracted from InputPrompt in the original App.ts.
 */

import { createElement as h, useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

export interface TaskInputBarProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onUpArrow?: () => string | null;
  onDownArrow?: () => string | null;
  captureInput?: boolean;
}

const TaskInputBar = ({ onSubmit, disabled, placeholder, onUpArrow, onDownArrow, captureInput }: TaskInputBarProps) => {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const valueRef = useRef('');
  const cursorRef = useRef(0);

  // Clear value when input loses focus (Escape)
  useEffect(() => {
    if (!captureInput) {
      setValue('');
      setCursor(0);
      valueRef.current = '';
      cursorRef.current = 0;
    }
  }, [captureInput]);

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
    } else if (key.upArrow && onUpArrow) {
      const hist = onUpArrow();
      if (hist != null) { v = hist; c = hist.length; }
    } else if (key.downArrow && onDownArrow) {
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
    setValue(v);
    setCursor(c);
  }, { isActive: !!captureInput });

  const prompt = disabled ? '...' : captureInput ? '>' : '/';
  const promptColor = disabled ? 'gray' : captureInput ? 'green' : 'gray';
  const borderColor = disabled ? 'gray' : captureInput ? 'cyan' : 'gray';

  return h(Box, {
    borderStyle: 'round',
    borderColor,
    paddingX: 1,
    flexShrink: 0,
  },
    h(Text, { color: promptColor, bold: true }, `${prompt} `),
    h(Text, null,
      value || h(Text, { color: 'gray', dimColor: true },
        captureInput ? (placeholder || 'Describe your task...') : 'Press / to type...'
      )
    )
  );
};

export { TaskInputBar };
