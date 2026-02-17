import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface TestDetail {
  name: string;
  status: string; // 'passed' | 'failed' | 'skipped'
  error?: string;
}

interface TestResultsProps {
  passed?: number;
  failed?: number;
  details?: TestDetail[];
}

export const TestResults = ({ passed = 0, failed = 0, details }: TestResultsProps) => {
  const total = passed + failed;
  const allPass = failed === 0 && passed > 0;

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: allPass ? 'green' : 'red', paddingX: 1 },
    h(Text, { bold: true, color: allPass ? 'green' : 'red' }, 'Test Results'),
    h(Box, { marginTop: 1, gap: 3 },
      h(Text, { color: 'green' }, `✅ ${passed} passed`),
      failed > 0 ? h(Text, { color: 'red' }, `❌ ${failed} failed`) : null,
      h(Text, { color: 'gray' }, `(${total} total)`)
    ),
    details && details.length > 0 ? h(Box, { flexDirection: 'column', marginTop: 1 },
      ...details.filter(d => d.status === 'failed').map(d =>
        h(Box, { key: d.name, flexDirection: 'column' },
          h(Text, { color: 'red' }, `  ✗ ${d.name}`),
          d.error ? h(Text, { color: 'gray', dimColor: true }, `    ${d.error}`) : null
        )
      )
    ) : null
  );
};
