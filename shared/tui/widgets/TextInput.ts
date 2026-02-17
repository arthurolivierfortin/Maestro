import { createElement as h, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

interface TextInputProps {
  question: string;
  placeholder?: string;
  multiline?: boolean;
  onSubmit: (value: string) => void;
}

export const TextInput = ({ question, placeholder, multiline, onSubmit }: TextInputProps) => {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return && !multiline) {
      onSubmit(value || placeholder || '');
      return;
    }
    if (key.return && multiline && key.ctrl) {
      onSubmit(value || placeholder || '');
      return;
    }
    if (key.backspace || key.delete) {
      setValue(v => v.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setValue(v => v + input);
    }
  });

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'cyan', paddingX: 1 },
    h(Text, { bold: true, color: 'cyan' }, question),
    h(Box, { marginTop: 1 },
      h(Text, { color: 'green' }, '> '),
      h(Text, null, value || h(Text, { color: 'gray', dimColor: true }, placeholder || 'Type your answer...'))
    ),
    h(Text, { color: 'gray', dimColor: true, marginTop: 1 },
      multiline ? 'Ctrl+Enter to submit' : 'Enter to submit'
    )
  );
};
