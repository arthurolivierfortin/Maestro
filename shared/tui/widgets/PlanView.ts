import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface PlanStep {
  id: number | string;
  action: string;
  target: string;
  description?: string;
  status: string; // 'done' | 'in-progress' | 'pending' | 'error'
}

interface PlanViewProps {
  steps: PlanStep[];
  currentStep?: number | string;
}

const statusIcon = (status: string): string => {
  switch (status) {
    case 'done': return '✅';
    case 'in-progress': return '🔄';
    case 'error': return '❌';
    default: return '⬜';
  }
};

export const PlanView = ({ steps, currentStep }: PlanViewProps) => {
  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'magenta', paddingX: 1 },
    h(Text, { bold: true, color: 'magenta' }, 'Implementation Plan'),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      ...steps.map(step => {
        const isCurrent = step.id === currentStep;
        return h(Box, { key: String(step.id) },
          h(Text, null, `${statusIcon(step.status)} `),
          h(Text, { color: isCurrent ? 'cyan' : 'white', bold: isCurrent },
            `${step.id}. `
          ),
          h(Text, { color: isCurrent ? 'cyan' : 'gray' },
            `[${step.action}] ${step.target}`
          ),
          step.description ? h(Text, { color: 'gray', dimColor: true }, ` — ${step.description}`) : null
        );
      })
    )
  );
};
