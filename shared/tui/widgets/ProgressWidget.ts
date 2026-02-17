import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface Step {
  id: string;
  name: string;
  status: string; // 'done' | 'running' | 'pending' | 'error'
}

interface ProgressWidgetProps {
  label?: string;
  current?: number;
  total?: number;
  steps?: Step[];
}

const statusIcon = (status: string): string => {
  switch (status) {
    case 'done': return '✅';
    case 'running': return '🔄';
    case 'error': return '❌';
    default: return '⬜';
  }
};

const statusColor = (status: string): string => {
  switch (status) {
    case 'done': return 'green';
    case 'running': return 'cyan';
    case 'error': return 'red';
    default: return 'gray';
  }
};

export const ProgressWidget = ({ label, current, total, steps }: ProgressWidgetProps) => {
  if (steps && steps.length > 0) {
    return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'blue', paddingX: 1 },
      label ? h(Text, { bold: true, color: 'blue' }, label) : null,
      ...steps.map(step =>
        h(Box, { key: step.id },
          h(Text, null, `${statusIcon(step.status)} `),
          h(Text, { color: statusColor(step.status) as any }, step.name)
        )
      )
    );
  }

  // Simple progress bar
  const pct = total && total > 0 ? Math.round((current || 0) / total * 100) : 0;
  const barWidth = 30;
  const filled = Math.round(barWidth * pct / 100);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'blue', paddingX: 1 },
    label ? h(Text, { bold: true, color: 'blue' }, label) : null,
    h(Box, { marginTop: label ? 1 : 0 },
      h(Text, { color: 'cyan' }, bar),
      h(Text, { color: 'white' }, ` ${pct}%`),
      total ? h(Text, { color: 'gray' }, ` (${current || 0}/${total})`) : null
    )
  );
};
