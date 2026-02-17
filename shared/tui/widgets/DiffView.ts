import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface DiffViewProps {
  filePath?: string;
  before?: string;
  after?: string;
}

export const DiffView = ({ filePath, before, after }: DiffViewProps) => {
  const beforeLines = (before || '').split('\n');
  const afterLines = (after || '').split('\n');

  // Simple line-by-line diff
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  const diffLines: Array<{ type: 'same' | 'removed' | 'added'; content: string }> = [];

  for (let i = 0; i < maxLines; i++) {
    const b = beforeLines[i] || '';
    const a = afterLines[i] || '';
    if (b === a) {
      diffLines.push({ type: 'same', content: ` ${a}` });
    } else {
      if (b) diffLines.push({ type: 'removed', content: `-${b}` });
      if (a) diffLines.push({ type: 'added', content: `+${a}` });
    }
  }

  // Show max 30 lines
  const visible = diffLines.slice(0, 30);
  const truncated = diffLines.length > 30;

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'yellow', paddingX: 1 },
    h(Text, { bold: true, color: 'yellow' }, filePath || 'Diff'),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      ...visible.map((line, i) =>
        h(Text, {
          key: i,
          color: line.type === 'added' ? 'green' : line.type === 'removed' ? 'red' : 'gray'
        }, line.content)
      ),
      truncated ? h(Text, { color: 'gray', dimColor: true }, `... ${diffLines.length - 30} more lines`) : null
    )
  );
};
