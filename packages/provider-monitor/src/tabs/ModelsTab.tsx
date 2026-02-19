import React from 'react';
import { Box, Text } from 'ink';
import { Panel } from '../tui/components/Panel.js';
import { semantic, icons } from '../theme/index.js';
import type { ModelResponse, PerformanceProfile } from '../api-client.js';

interface ModelsTabProps {
  models: ModelResponse[];
  activeModel: string | null;
  performanceProfiles?: PerformanceProfile[];
  focused?: boolean;
}

export function ModelsTab({ models, activeModel, performanceProfiles, focused }: ModelsTabProps) {
  if (models.length === 0) {
    return (
      <Panel title="Models" focused={focused}>
        <Text color={semantic.text.muted}>No models discovered yet. Waiting for provider data...</Text>
      </Panel>
    );
  }

  // Group by provider
  const byProvider = models.reduce<Record<string, ModelResponse[]>>((acc, m) => {
    const key = m.provider ?? 'Unknown';
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  const profileMap = new Map(performanceProfiles?.map(p => [p.modelId, p]) ?? []);
  const providers = Object.entries(byProvider);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {providers.map(([provider, providerModels]) => (
        <Panel key={provider} title={`${provider} (${providerModels.length})`} focused={focused}>
          <Box flexDirection="row">
            <Text color={semantic.text.muted}>{'  Model'.padEnd(30)}</Text>
            <Text color={semantic.text.muted}>{'Status'.padEnd(12)}</Text>
            <Text color={semantic.text.muted}>{'Context'.padEnd(10)}</Text>
            <Text color={semantic.text.muted}>Capabilities</Text>
          </Box>
          {providerModels.map(m => {
            const modelId = m.id ?? m.name ?? 'unknown';
            const isActive = modelId === activeModel || m.name === activeModel;
            const status = isActive ? 'ACTIVE' : m.isAvailable ? 'available' : 'unavailable';
            const statusColor = isActive
              ? semantic.status.running
              : m.isAvailable
                ? semantic.text.secondary
                : semantic.status.stopped;
            const profile = profileMap.get(modelId);
            const context = m.contextLength ? `${(m.contextLength / 1024).toFixed(0)}K` : 'N/A';
            const caps = (m.capabilities ?? []).join(', ');

            return (
              <Box key={modelId} flexDirection="column">
                <Box flexDirection="row">
                  <Text color={isActive ? semantic.text.accent : semantic.text.primary}>
                    {(isActive ? `${icons.running} ` : '  ') + modelId.padEnd(28)}
                  </Text>
                  <Text color={statusColor}>{status.padEnd(12)}</Text>
                  <Text color={semantic.text.secondary}>{context.padEnd(10)}</Text>
                  <Text color={semantic.text.muted}>{caps}</Text>
                </Box>
                {profile && (
                  <Text color={semantic.text.muted}>
                    {'    '}{icons.dot} {profile.totalRequests} req, avg {profile.averageResponseTime},{' '}
                    {profile.avgTokensPerRequest.toFixed(0)} tok/req
                  </Text>
                )}
              </Box>
            );
          })}
        </Panel>
      ))}
    </Box>
  );
}
