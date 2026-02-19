import React, { useState } from 'react';
import { Box, useStdout } from 'ink';
import { Header } from './tui/components/Header.js';
import { StatusBar } from './tui/components/StatusBar.js';
import type { TabName } from './tui/components/TabBar.js';
import { useActionKeyboard } from './tui/hooks/use-action-keyboard.js';
import { useApiPolling } from './hooks/use-api-polling.js';
import { useLogStream } from './hooks/use-log-stream.js';
import { LogsTab } from './tabs/LogsTab.js';
import { MetricsTab } from './tabs/MetricsTab.js';
import { QueueTab } from './tabs/QueueTab.js';
import { ModelsTab } from './tabs/ModelsTab.js';
import { getMockData } from './mock-data.js';
import type { StatisticsSnapshot, QueueStatistics, SwitchEvent, ModelResponse, PerformanceProfile } from './api-client.js';

interface AppProps {
  baseUrl?: string;
  logDir?: string;
  mock?: boolean;
  onExit?: () => void;
}

const TAB_ORDER: TabName[] = ['metrics', 'logs', 'queue', 'models'];

export function App({ baseUrl = 'http://localhost:5010', logDir = 'logs', mock = false, onExit }: AppProps) {
  const [activeTab, setActiveTab] = useState<TabName>('metrics');
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;

  const api = useApiPolling(baseUrl, mock ? 999999 : 2000);
  const logs = useLogStream(logDir);

  const mockData = mock ? getMockData() : null;

  // Resolve data source: mock or live
  const stats: StatisticsSnapshot | null = mock ? mockData!.stats : api.stats;
  const queue: QueueStatistics | null = mock ? mockData!.queue : api.queue;
  const switchingDecisions: SwitchEvent[] = mock ? mockData!.switchingDecisions : api.switchingDecisions;
  const models: ModelResponse[] = mock ? mockData!.models : api.models;
  const performanceProfiles: PerformanceProfile[] = mock ? mockData!.performanceProfiles : api.performanceProfiles;
  const connected = mock ? true : api.connected;
  const lastUpdated = mock ? 'MOCK' : api.lastUpdated;
  const logLines = mock ? mockData!.logs : logs.lines;

  useActionKeyboard({
    'tab.logs': () => setActiveTab('logs'),
    'tab.metrics': () => setActiveTab('metrics'),
    'tab.queue': () => setActiveTab('queue'),
    'tab.models': () => setActiveTab('models'),
    'tab.next': () => {
      const idx = TAB_ORDER.indexOf(activeTab);
      setActiveTab(TAB_ORDER[(idx + 1) % TAB_ORDER.length]!);
    },
    'quit': () => {
      onExit?.();
      process.exit(0);
    },
    'refresh': () => { if (!mock) { api.refresh(); } },
  });

  const activeModel = queue?.currentModel ?? null;
  const totalTokens = stats?.totalTokens?.totalTokens ?? 0;
  const queueDepth = queue?.currentDepth ?? 0;

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Header
        connected={connected}
        activeModel={activeModel}
        queueDepth={queueDepth}
        totalTokens={totalTokens}
        activeTab={activeTab}
      />
      <Box flexGrow={1} flexDirection="column">
        {activeTab === 'metrics' && <MetricsTab stats={stats} focused />}
        {activeTab === 'logs' && <LogsTab lines={logLines} focused />}
        {activeTab === 'queue' && (
          <QueueTab
            queue={queue}
            switchingDecisions={switchingDecisions}
            performanceProfiles={performanceProfiles}
            focused
          />
        )}
        {activeTab === 'models' && (
          <ModelsTab
            models={models}
            activeModel={activeModel}
            performanceProfiles={performanceProfiles}
            focused
          />
        )}
      </Box>
      <StatusBar connected={connected} lastUpdated={lastUpdated} />
    </Box>
  );
}
