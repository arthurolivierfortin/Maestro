import React from 'react';
import { Box, Text } from 'ink';
import { semantic, icons, layout } from '../../theme/index.js';

interface StatusBarProps {
  connected: boolean;
  lastUpdated: string | null;
}

export function StatusBar({ connected, lastUpdated }: StatusBarProps) {
  const connColor = connected ? semantic.status.running : semantic.status.stopped;
  const connText = connected ? 'connected' : 'disconnected';
  const connIcon = connected ? icons.connected : icons.failed;

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderColor={semantic.ui.separator}
      height={layout.statusBarHeight}
      paddingX={1}
    >
      {/* Left: connection status */}
      <Box gap={1} alignItems="center">
        <Text color={connColor}>{connIcon} {connText}</Text>
        {lastUpdated && (
          <>
            <Text color={semantic.ui.separator}>{icons.dot}</Text>
            <Text color={semantic.text.muted}>{lastUpdated}</Text>
          </>
        )}
      </Box>

      {/* Right: shortcuts */}
      <Box gap={1} alignItems="center">
        <Shortcut k="1-4" label="tabs" />
        <Shortcut k="Tab" label="next" />
        <Shortcut k="r" label="refresh" />
        <Shortcut k="q" label="quit" />
      </Box>
    </Box>
  );
}

function Shortcut({ k, label }: { k: string; label: string }) {
  return (
    <Text>
      <Text color={semantic.ui.separator}>[</Text>
      <Text color={semantic.text.accent}>{k}</Text>
      <Text color={semantic.ui.separator}>]</Text>
      <Text color={semantic.text.muted}>{label}</Text>
    </Text>
  );
}
