import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface TableWidgetProps {
  columns: string[];
  rows: Array<Record<string, string>>;
  title?: string;
}

export const TableWidget = ({ columns, rows, title }: TableWidgetProps) => {
  // Calculate column widths
  const widths = columns.map(col => {
    const headerLen = col.length;
    const maxDataLen = Math.max(0, ...rows.map(r => (r[col] || '').length));
    return Math.min(30, Math.max(headerLen, maxDataLen) + 2);
  });

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'blue', paddingX: 1 },
    title ? h(Text, { bold: true, color: 'blue' }, title) : null,
    // Header
    h(Box, { marginTop: title ? 1 : 0 },
      ...columns.map((col, i) =>
        h(Text, { key: col, bold: true, color: 'cyan' }, col.padEnd(widths[i]))
      )
    ),
    // Separator
    h(Text, { color: 'gray' }, columns.map((_, i) => '─'.repeat(widths[i])).join('')),
    // Rows
    ...rows.slice(0, 20).map((row, ri) =>
      h(Box, { key: ri },
        ...columns.map((col, ci) =>
          h(Text, { key: col, color: 'white' }, (row[col] || '').padEnd(widths[ci]))
        )
      )
    ),
    rows.length > 20 ? h(Text, { color: 'gray', dimColor: true }, `... ${rows.length - 20} more rows`) : null
  );
};
