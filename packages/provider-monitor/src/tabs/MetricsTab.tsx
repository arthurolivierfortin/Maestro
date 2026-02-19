import React from 'react';
import { Box, Text } from 'ink';
import { Panel } from '../tui/components/Panel.js';
import { semantic, icons } from '../theme/index.js';
import type { StatisticsSnapshot } from '../api-client.js';

interface MetricsTabProps {
  stats: StatisticsSnapshot | null;
  focused?: boolean;
}

export function MetricsTab({ stats, focused }: MetricsTabProps) {
  if (!stats) {
    return (
      <Panel title="Metrics" focused={focused}>
        <Text color={semantic.text.muted}>Waiting for statistics data...</Text>
      </Panel>
    );
  }

  const errorCount = stats.modelStats.reduce((sum, m) => sum + Math.round(m.requestCount * m.errorRate), 0);
  const errorPct = stats.totalRequests > 0
    ? ((errorCount / stats.totalRequests) * 100).toFixed(2)
    : '0.00';

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Top row: 3 stat cards side-by-side */}
      <Box flexDirection="row" flexGrow={1}>
        <Panel title="Requests" focused={focused}>
          <KV label="Total" value={fmt(stats.totalRequests)} accent />
          <KV label="Errors" value={`${errorCount} (${errorPct}%)`} />
          {stats.timeWindows.length > 0 && (
            <KV label="Rate" value={`${stats.timeWindows[0]!.requestsPerMinute.toFixed(1)}/min`} />
          )}
        </Panel>

        <Panel title="Tokens">
          <KV label="Prompt" value={fmt(stats.totalTokens.promptTokens)} accent />
          <KV label="Complete" value={fmt(stats.totalTokens.completionTokens)} />
          <KV label="Total" value={fmt(stats.totalTokens.totalTokens)} accent />
        </Panel>

        <Panel title="Latency (ms)">
          <KV label="P50" value={stats.latency.p50.toFixed(0)} accent />
          <KV label="P95" value={stats.latency.p95.toFixed(0)} />
          <KV label="P99" value={stats.latency.p99.toFixed(0)} />
        </Panel>
      </Box>

      {/* Bottom row: models + time windows side-by-side */}
      <Box flexDirection="row" flexGrow={2}>
        <Panel title="By Model">
          {stats.modelStats.length === 0 ? (
            <Text color={semantic.text.muted}>No model data yet</Text>
          ) : (
            <>
              <Row cells={['Model', 'Reqs', 'Avg(ms)', 'Tokens', 'RPM']} widths={[20, 6, 8, 8, 6]} muted />
              {stats.modelStats.map(m => (
                <Row
                  key={m.modelId}
                  cells={[
                    trunc(m.modelId, 20),
                    String(m.requestCount),
                    m.latency.average.toFixed(0),
                    fmt(m.totalTokens.totalTokens),
                    m.requestsPerMinute.toFixed(1),
                  ]}
                  widths={[20, 6, 8, 8, 6]}
                />
              ))}
            </>
          )}
        </Panel>

        <Panel title="Time Windows">
          {stats.timeWindows.length === 0 ? (
            <Text color={semantic.text.muted}>No time window data</Text>
          ) : (
            <>
              <Row cells={['Win', 'Reqs', 'Rate', 'P50', 'Tokens']} widths={[5, 5, 8, 7, 7]} muted />
              {stats.timeWindows.map(tw => (
                <Row
                  key={tw.windowName}
                  cells={[
                    tw.windowName,
                    String(tw.requestCount),
                    tw.requestsPerMinute.toFixed(1) + '/m',
                    tw.latency.p50.toFixed(0) + 'ms',
                    fmt(tw.tokensTotal),
                  ]}
                  widths={[5, 5, 8, 7, 7]}
                />
              ))}
              <Box marginTop={1}>
                <Text color={semantic.text.accent}>
                  {stats.timeWindows.map(tw => {
                    const idx = Math.min(7, Math.floor(tw.requestsPerMinute));
                    return icons.bar[idx] ?? icons.bar[0];
                  }).join('')}
                </Text>
              </Box>
            </>
          )}
        </Panel>
      </Box>
    </Box>
  );
}

function KV({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box flexDirection="row">
      <Text color={semantic.text.muted}>{label.padEnd(10)}</Text>
      <Text color={accent ? semantic.text.primary : semantic.text.secondary}>{value}</Text>
    </Box>
  );
}

function Row({ cells, widths, muted }: { cells: string[]; widths: number[]; muted?: boolean }) {
  const color = muted ? semantic.text.muted : semantic.text.secondary;
  return (
    <Box flexDirection="row">
      {cells.map((cell, i) => (
        <Text key={i} color={color}>{cell.padEnd(widths[i] ?? 10)}</Text>
      ))}
    </Box>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}K`; }
  return n.toString();
}

function trunc(s: string, max: number): string {
  if (s.length <= max) { return s; }
  return s.slice(0, max - 1) + '\u2026';
}
