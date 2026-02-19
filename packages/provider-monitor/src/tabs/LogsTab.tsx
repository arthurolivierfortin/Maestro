import React from 'react';
import { Text } from 'ink';
import { Panel } from '../tui/components/Panel.js';
import { semantic } from '../theme/index.js';

interface LogsTabProps {
  lines: string[];
  focused?: boolean;
}

/** Bottom-anchored log panel with color-coded log levels */
export function LogsTab({ lines, focused }: LogsTabProps) {
  const displayLines = lines.slice(-200);

  return (
    <Panel title="Logs" focused={focused} anchor="bottom">
      {displayLines.length === 0 ? (
        <Text color={semantic.text.muted}>No log entries yet. Waiting for log output...</Text>
      ) : (
        displayLines.map((line, i) => (
          <Text key={i} color={getLogColor(line)} wrap="truncate">
            {line}
          </Text>
        ))
      )}
    </Panel>
  );
}

function getLogColor(line: string): string {
  if (line.includes(' ERR]') || line.includes('[ERR]') || line.includes('Error')) {
    return semantic.log.error;
  }
  if (line.includes(' WRN]') || line.includes('[WRN]') || line.includes('Warning')) {
    return semantic.log.warning;
  }
  if (line.includes(' DBG]') || line.includes('[DBG]') || line.includes('Debug')) {
    return semantic.log.debug;
  }
  return semantic.log.info;
}
