import React from 'react';
import { Box, Text } from 'ink';
import { semantic, icons, layout } from '../../theme/index.js';
import type { TabName } from './TabBar.js';

interface HeaderProps {
  connected: boolean;
  activeModel: string | null;
  queueDepth: number;
  totalTokens: number;
  activeTab: TabName;
}

const tabs: { key: string; name: TabName; label: string }[] = [
  { key: '1', name: 'metrics', label: 'Metrics' },
  { key: '2', name: 'logs', label: 'Logs' },
  { key: '3', name: 'queue', label: 'Queue' },
  { key: '4', name: 'models', label: 'Models' },
];

export function Header({ connected, activeModel, queueDepth, totalTokens, activeTab }: HeaderProps) {
  const statusColor = connected ? semantic.status.running : semantic.status.stopped;
  const statusIcon = connected ? icons.running : icons.failed;
  const modelShort = activeModel ? truncate(activeModel, 20) : null;

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderColor={semantic.ui.separator}
      height={layout.headerHeight}
      paddingX={1}
    >
      {/* Left: brand + status + tabs */}
      <Box gap={1} alignItems="center">
        <Text bold color={semantic.text.accent}>LLM-Provider</Text>
        <Text color={statusColor}>{statusIcon}</Text>
        {tabs.map(tab => {
          const isActive = tab.name === activeTab;
          return (
            <Text
              key={tab.name}
              color={isActive ? semantic.ui.tabActive : semantic.ui.tabInactive}
              bold={isActive}
            >
              [{tab.key}]{tab.label}
            </Text>
          );
        })}
      </Box>

      {/* Right: model + queue + tokens */}
      <Box gap={1} alignItems="center">
        {modelShort && (
          <Text color={semantic.text.secondary}>{icons.model}{modelShort}</Text>
        )}
        <Text color={queueDepth > 0 ? semantic.status.pending : semantic.text.muted}>
          {icons.queue}{queueDepth}
        </Text>
        <Text color={semantic.text.muted}>{formatNumber(totalTokens)}tok</Text>
      </Box>
    </Box>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}K`; }
  return n.toString();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) { return s; }
  return s.slice(0, max - 1) + '\u2026';
}
