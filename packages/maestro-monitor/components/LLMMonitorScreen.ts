// @ts-nocheck
/**
 * Phase 24: LLM Monitor Screen — shows GPU info, active model, inference metrics.
 * Accessible via `maestro monitor --llm` or as a page in the TUI.
 */

import { createElement as h, useState, useEffect } from 'react';
const { Box, Text } = require('ink');
import { theme } from '../theme.ts';
import { Panel } from '@maestro/tui/components';
import { useApiData } from '@maestro/tui/hooks';

interface LLMMonitorScreenProps {
  apiClient: any;
  onExit?: () => void;
  onQuit?: () => void;
}

export function LLMMonitorScreen({ apiClient, onExit, onQuit }: LLMMonitorScreenProps) {
  const { data: health, error: healthError, refresh } = useApiData(
    () => apiClient.getLLMHealth?.() || apiClient._fetch?.('GET', '/api/provider/health'),
    3000
  );

  const { data: capabilities } = useApiData(
    () => apiClient._fetch?.('GET', '/api/provider/capabilities'),
    10000
  );

  const { data: activeProvider } = useApiData(
    () => apiClient.getActiveProvider?.() || apiClient._fetch?.('GET', '/api/provider/active'),
    10000
  );

  return h(Box, { flexDirection: 'column', padding: 1 },
    // Title
    h(Box, { marginBottom: 1 },
      h(Text, { bold: true, color: theme.colors.brand },
        ' LLM Monitor'),
      h(Text, { color: 'gray' }, '  (r=refresh, q=quit)')
    ),

    h(Box, { flexDirection: 'row', gap: 1 },
      // Left column: GPU + Model
      h(Box, { flexDirection: 'column', width: '50%' },
        // GPU Info Panel
        h(Panel, { title: 'GPU Information', borderColor: 'cyan' },
          health?.cudaAvailable
            ? h(Box, { flexDirection: 'column' },
                h(Text, null, `  Device:    ${theme.primary(health.device || 'unknown')}`),
                h(Text, null, `  GPU:       ${theme.primary(health.cudaDeviceName || 'N/A')}`),
                h(Text, null, `  CUDA:      ${theme.success('available')}`),
                capabilities?.gpuVram
                  ? h(Text, null, `  VRAM:      ${capabilities.gpuVram}`)
                  : null
              )
            : h(Box, { flexDirection: 'column' },
                h(Text, null, `  Device:    ${theme.warning(health?.device || 'cpu')}`),
                h(Text, null, `  CUDA:      ${theme.muted('not available')}`),
                h(Text, { color: 'gray' }, '  Running on CPU — inference will be slower')
              )
        ),

        // Active Model Panel
        h(Panel, { title: 'Active Model', borderColor: 'green' },
          health?.activeModel
            ? h(Box, { flexDirection: 'column' },
                h(Text, null, `  Model:     ${theme.primary(health.activeModel)}`),
                h(Text, null, `  Status:    ${theme.success(health.status || 'loaded')}`),
                h(Text, null, `  Loaded:    ${health.modelsLoaded || 1} model(s)`)
              )
            : h(Box, { flexDirection: 'column' },
                h(Text, { color: 'yellow' }, '  No model loaded'),
                h(Text, { color: 'gray' }, '  Use: maestro llm switch <model-id>')
              )
        )
      ),

      // Right column: Provider + Status
      h(Box, { flexDirection: 'column', width: '50%' },
        // Provider Panel
        h(Panel, { title: 'Provider', borderColor: 'magenta' },
          h(Box, { flexDirection: 'column' },
            h(Text, null, `  Type:      ${activeProvider?.provider === 'azure'
              ? theme.T({ color: 'cyan' }, 'Azure OpenAI')
              : theme.success('Local')}`),
            h(Text, null, `  Status:    ${health?.status === 'online' || health?.status === 'ok'
              ? theme.success('online')
              : healthError
                ? theme.error('offline')
                : theme.warning(health?.status || 'unknown')}`),
            capabilities?.pythonVersion
              ? h(Text, null, `  Python:    ${capabilities.pythonVersion}`)
              : null,
            capabilities?.cudaVersion
              ? h(Text, null, `  CUDA ver:  ${capabilities.cudaVersion}`)
              : null
          )
        ),

        // Connection Status Panel
        h(Panel, { title: 'Connection', borderColor: 'gray' },
          h(Box, { flexDirection: 'column' },
            healthError
              ? h(Box, { flexDirection: 'column' },
                  h(Text, { color: 'red' }, '  LLM server not responding'),
                  h(Text, { color: 'gray' }, '  Check: powershell -File dev-scripts/dev-start.ps1')
                )
              : h(Box, { flexDirection: 'column' },
                  h(Text, null, `  Backend:   ${theme.success('connected')}`),
                  h(Text, null, `  LLM API:   ${health ? theme.success('responding') : theme.warning('checking...')}`)
                )
          )
        )
      )
    )
  );
}
