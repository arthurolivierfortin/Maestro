/**
 * Phase 24: LLM Monitor Screen — shows GPU info, active model, inference metrics.
 * Accessible via `maestro monitor --llm` or as a page in the TUI.
 */

import { createElement as h, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme, T, primary, success, warning, error, muted } from '../theme.ts';
import { Panel } from './Panel.ts';
import { useApiData } from '@maestro/tui/hooks';

interface LLMMonitorScreenProps {
  apiClient: any;
  onExit?: () => void;
  onQuit?: () => void;
}

export function LLMMonitorScreen({ apiClient, onExit, onQuit }: LLMMonitorScreenProps) {
  const { data: health, error: healthError } = useApiData(
    (): Promise<any> => apiClient.getLLMHealth?.() || apiClient._fetch?.('GET', '/api/provider/health'),
    3000
  );

  const { data: capabilities } = useApiData(
    (): Promise<any> => apiClient._fetch?.('GET', '/api/provider/capabilities'),
    10000
  );

  const { data: activeProvider } = useApiData(
    (): Promise<any> => apiClient.getActiveProvider?.() || apiClient._fetch?.('GET', '/api/provider/active'),
    10000
  );

  const h_data = health as Record<string, any> | null;
  const c_data = capabilities as Record<string, any> | null;
  const p_data = activeProvider as Record<string, any> | null;

  return h(Box, { flexDirection: 'column', padding: 1 },
    // Title
    h(Box, { marginBottom: 1 },
      h(Text, { bold: true, color: theme.ui.highlight },
        ' LLM Monitor'),
      h(Text, { color: 'gray' }, '  (r=refresh, q=quit)')
    ),

    h(Box, { flexDirection: 'row', gap: 1 },
      // Left column: GPU + Model
      h(Box, { flexDirection: 'column', width: '50%' },
        // GPU Info Panel
        h(Panel, { title: 'GPU Information', borderColor: 'cyan' },
          h_data?.cudaAvailable
            ? h(Box, { flexDirection: 'column' },
                h(Text, null, `  Device:    ${primary(h_data.device || 'unknown')}`),
                h(Text, null, `  GPU:       ${primary(h_data.cudaDeviceName || 'N/A')}`),
                h(Text, null, `  CUDA:      ${success('available')}`),
                c_data?.gpuVram
                  ? h(Text, null, `  VRAM:      ${c_data.gpuVram}`)
                  : null
              )
            : h(Box, { flexDirection: 'column' },
                h(Text, null, `  Device:    ${warning(h_data?.device || 'cpu')}`),
                h(Text, null, `  CUDA:      ${muted('not available')}`),
                h(Text, { color: 'gray' }, '  Running on CPU — inference will be slower')
              )
        ),

        // Active Model Panel
        h(Panel, { title: 'Active Model', borderColor: 'green' },
          h_data?.activeModel
            ? h(Box, { flexDirection: 'column' },
                h(Text, null, `  Model:     ${primary(h_data.activeModel)}`),
                h(Text, null, `  Status:    ${success(h_data.status || 'loaded')}`),
                h(Text, null, `  Loaded:    ${h_data.modelsLoaded || 1} model(s)`)
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
            h(Text, null, `  Type:      ${p_data?.provider === 'azure'
              ? T('cyan', 'Azure OpenAI')
              : success('Local')}`),
            h(Text, null, `  Status:    ${h_data?.status === 'online' || h_data?.status === 'ok'
              ? success('online')
              : healthError
                ? error('offline')
                : warning(h_data?.status || 'unknown')}`),
            c_data?.pythonVersion
              ? h(Text, null, `  Python:    ${c_data.pythonVersion}`)
              : null,
            c_data?.cudaVersion
              ? h(Text, null, `  CUDA ver:  ${c_data.cudaVersion}`)
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
                  h(Text, null, `  Backend:   ${success('connected')}`),
                  h(Text, null, `  LLM API:   ${h_data ? success('responding') : warning('checking...')}`)
                )
          )
        )
      )
    )
  );
}
