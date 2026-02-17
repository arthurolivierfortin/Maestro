import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface MessageWidgetProps {
  content: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

const severityConfig: Record<string, { color: string; icon: string; border: string }> = {
  info: { color: 'cyan', icon: 'ℹ', border: 'cyan' },
  warning: { color: 'yellow', icon: '⚠', border: 'yellow' },
  error: { color: 'red', icon: '✗', border: 'red' },
  success: { color: 'green', icon: '✓', border: 'green' },
};

export const MessageWidget = ({ content, severity = 'info' }: MessageWidgetProps) => {
  const config = severityConfig[severity] || severityConfig.info;

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: config.border, paddingX: 1 },
    h(Box, null,
      h(Text, { color: config.color as any }, `${config.icon} `),
      h(Text, { color: 'white' }, content)
    )
  );
};
