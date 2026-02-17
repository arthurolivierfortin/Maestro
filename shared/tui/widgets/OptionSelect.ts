import { createElement as h, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

interface OptionSelectProps {
  question: string;
  options: string[];
  defaultOption?: string;
  onSelect: (value: string) => void;
}

export const OptionSelect = ({ question, options, defaultOption, onSelect }: OptionSelectProps) => {
  const defaultIdx = defaultOption ? options.indexOf(defaultOption) : 0;
  const [cursor, setCursor] = useState(Math.max(0, defaultIdx));

  useInput((input, key) => {
    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    if (key.downArrow) setCursor(c => Math.min(options.length - 1, c + 1));
    if (key.return) onSelect(options[cursor]);
  });

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'cyan', paddingX: 1 },
    h(Text, { bold: true, color: 'cyan' }, question),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      ...options.map((opt, i) =>
        h(Box, { key: opt },
          h(Text, { color: i === cursor ? 'cyan' : 'gray' },
            i === cursor ? '❯ ' : '  '
          ),
          h(Text, { color: i === cursor ? 'white' : 'gray', bold: i === cursor }, opt)
        )
      )
    ),
    h(Text, { color: 'gray', dimColor: true, marginTop: 1 }, '↑/↓ navigate  Enter select')
  );
};
