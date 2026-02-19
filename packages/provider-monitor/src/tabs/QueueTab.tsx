import React from 'react';
import { Box, Text } from 'ink';
import { Panel } from '../tui/components/Panel.js';
import { semantic, icons } from '../theme/index.js';
import type { QueueStatistics, SwitchEvent, PerformanceProfile } from '../api-client.js';

interface QueueTabProps {
  queue: QueueStatistics | null;
  switchingDecisions: SwitchEvent[];
  performanceProfiles?: PerformanceProfile[];
  focused?: boolean;
}

export function QueueTab({ queue, switchingDecisions, performanceProfiles, focused }: QueueTabProps) {
  if (!queue) {
    return (
      <Panel title="Queue & Switching" focused={focused}>
        <Text color={semantic.text.muted}>Waiting for queue data...</Text>
      </Panel>
    );
  }

  const recentDecisions = switchingDecisions.slice(-10);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Top row: Queue state + performance profiles */}
      <Box flexDirection="row" flexGrow={1}>
        <Panel title="Queue State" focused={focused}>
          <KV label="Active" value={trunc(queue.currentModel ?? 'none', 22)} accent />
          <KV label="Depth" value={`${queue.currentDepth} pending`} />
          <KV label="Avg wait" value={`${queue.avgWaitTimeMs.toFixed(0)}ms`} />
          <KV label="Enqueued" value={String(queue.totalEnqueued)} />
          <KV label="Processed" value={String(queue.totalProcessed)} />

          {Object.keys(queue.depthByModel).length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={semantic.text.muted}>By model:</Text>
              {Object.entries(queue.depthByModel).map(([model, count]) => (
                <Text key={model} color={semantic.text.secondary}>
                  {'  '}{trunc(model, 24)}: {count}
                </Text>
              ))}
            </Box>
          )}
        </Panel>

        <Panel title="Performance Profiles">
          {!performanceProfiles || performanceProfiles.length === 0 ? (
            <Text color={semantic.text.muted}>No profiles yet</Text>
          ) : (
            <>
              <Row cells={['Model', 'Load', 'Response', 'Reqs']} widths={[18, 10, 10, 6]} muted />
              {performanceProfiles.map(p => (
                <Row
                  key={p.modelId}
                  cells={[trunc(p.modelId, 18), fmtDuration(p.averageLoadTime), fmtDuration(p.averageResponseTime), String(p.totalRequests)]}
                  widths={[18, 10, 10, 6]}
                />
              ))}
            </>
          )}
        </Panel>
      </Box>

      {/* Bottom: recent switch decisions */}
      <Box flexGrow={2}>
        <Panel title={`Switch Decisions (${recentDecisions.length})`} anchor="bottom">
          {recentDecisions.length === 0 ? (
            <Text color={semantic.text.muted}>No switch decisions recorded yet</Text>
          ) : (
            <>
              <Row cells={['Time', 'Action', 'Target', 'Score', 'Reason']} widths={[6, 10, 18, 7, 30]} muted />
              {recentDecisions.map((d, i) => {
                const time = formatTime(d.timestamp);
                const decisionColor = getDecisionColor(d.decision);
                const target = d.decision.includes('Switch') || d.decision.includes('Forced')
                  ? `${icons.arrow} ${trunc(d.to, 15)}`
                  : trunc(d.from ?? '-', 18);
                const score = d.score === 1.7976931348623157e+308 ? 'MAX' : d.score.toFixed(1);

                return (
                  <Box key={i} flexDirection="row">
                    <Text color={semantic.text.muted}>{time.padEnd(6)}</Text>
                    <Text color={decisionColor}>{d.decision.padEnd(10)}</Text>
                    <Text color={semantic.text.secondary}>{target.padEnd(18)}</Text>
                    <Text color={semantic.text.secondary}>{score.padEnd(7)}</Text>
                    <Text color={semantic.text.muted} wrap="truncate">{d.reason}</Text>
                  </Box>
                );
              })}
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
      <Text color={accent ? semantic.text.accent : semantic.text.secondary}>{value}</Text>
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

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function fmtDuration(d: string): string {
  // "00:00:14.200" -> "14.2s"
  const match = d.match(/(\d+):(\d+):(\d+)\.?(\d*)/);
  if (!match) { return d; }
  const h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  const s = parseInt(match[3]!, 10);
  const ms = match[4] ? parseInt(match[4].padEnd(3, '0').slice(0, 3), 10) : 0;
  if (h > 0) { return `${h}h${m}m`; }
  if (m > 0) { return `${m}m${s}s`; }
  if (s > 0) { return `${s}.${Math.floor(ms / 100)}s`; }
  return `${ms}ms`;
}

function getDecisionColor(decision: string): string {
  if (decision.includes('Keep')) { return semantic.status.idle; }
  if (decision.includes('Switch')) { return semantic.status.loading; }
  if (decision.includes('Forced')) { return semantic.status.stopped; }
  return semantic.text.secondary;
}

function trunc(s: string, max: number): string {
  if (s.length <= max) { return s; }
  return s.slice(0, max - 1) + '\u2026';
}
