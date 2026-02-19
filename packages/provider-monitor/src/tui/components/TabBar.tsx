import React from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/index.js';

export type TabName = 'logs' | 'metrics' | 'queue' | 'models';

interface TabBarProps {
  activeTab: TabName;
}

const tabs: { key: string; name: TabName; label: string }[] = [
  { key: '1', name: 'metrics', label: 'Metrics' },
  { key: '2', name: 'logs', label: 'Logs' },
  { key: '3', name: 'queue', label: 'Queue' },
  { key: '4', name: 'models', label: 'Models' },
];

export function TabBar({ activeTab }: TabBarProps) {
  return (
    <Box flexDirection="row" gap={1} paddingX={1}>
      {tabs.map(tab => {
        const isActive = tab.name === activeTab;
        return (
          <Box key={tab.name}>
            <Text
              color={isActive ? semantic.ui.tabActive : semantic.ui.tabInactive}
              bold={isActive}
              underline={isActive}
            >
              [{tab.key}] {tab.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
