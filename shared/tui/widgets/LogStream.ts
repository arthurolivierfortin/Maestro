import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface LogEntry {
  time: string;
  level: string;
  msg: string;
}

interface LogStreamProps {
  entries: LogEntry[];
  maxVisible?: number;
}

const levelColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'error': return 'red';
    case 'warning': case 'warn': return 'yellow';
    case 'success': return 'green';
    case 'info': return 'cyan';
    default: return 'gray';
  }
};

const levelIcon = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'error': return '✗';
    case 'warning': case 'warn': return '⚠';
    case 'success': return '✓';
    case 'info': return '●';
    default: return '·';
  }
};

export const LogStream = ({ entries, maxVisible = 15 }: LogStreamProps) => {
  const visible = entries.slice(-maxVisible);

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'gray', paddingX: 1 },
    h(Text, { bold: true, color: 'gray' }, `Log (${entries.length} entries)`),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      ...visible.map((entry, i) =>
        h(Box, { key: i },
          h(Text, { color: 'gray', dimColor: true },
            entry.time ? `${entry.time.slice(11, 19)} ` : ''
          ),
          h(Text, { color: levelColor(entry.level) as any },
            `${levelIcon(entry.level)} `
          ),
          h(Text, { color: 'white' },
            entry.msg.length > 80 ? entry.msg.slice(0, 80) + '...' : entry.msg
          )
        )
      ),
      visible.length === 0 ? h(Text, { color: 'gray', dimColor: true }, 'No log entries yet') : null
    )
  );
};
