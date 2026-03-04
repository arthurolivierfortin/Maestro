/**
 * ModelsScreen — LLM model management page.
 *
 * Shows active model, available models list, health status, and metrics.
 *
 * Props:
 *   apiClient    API client instance
 *   onNavigate   (page: string) => void
 *   onQuit       () => void
 */

import { createElement as h, useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import {
  prevPage, nextPage,
  theme, icons,
  T, muted, primary, label, bold,
  statusColor, statusIcon,
  breathingDot,
} from '../theme.ts';
import { useApiData } from '@maestro/tui/hooks';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { useAnimationTick } from '../hooks/useAnimationTick.ts';
import { NavBar } from './NavBar.ts';
import { Panel } from './Panel.ts';

// ── Model Status Panel ───────────────────────────────────────

interface ModelStatusPanelProps {
  health: Record<string, any> | null;
  llmStatus: Record<string, any> | null;
  tick?: number;
}

const ModelStatusPanel = ({ health, llmStatus, tick = 0 }: ModelStatusPanelProps) => {
  const isLoading = health === null || health === undefined;
  const isHealthy = health && !health.error;
  const healthColor = isLoading ? theme.text.muted : (isHealthy ? theme.status.success : theme.status.error);
  const healthIcon = isLoading ? '...' : (isHealthy ? breathingDot(tick) : icons.failed);

  // Extract info from health response
  const activeModel = health?.activeModel || '-';
  const backend = health?.backend || health?.framework || '-';
  const device = health?.device || '-';

  // Extract info from llmStatus
  const maxTokens = llmStatus?.maxTokens || llmStatus?.max_tokens || '-';
  const temperature = llmStatus?.temperature ?? '-';

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    h(Box, { flexDirection: 'row', gap: 1 },
      h(Text, { color: healthColor }, healthIcon),
      h(Text, null, ' '),
      muted('Status: '),
      T(healthColor, isLoading ? 'Loading...' : (isHealthy ? 'Online' : 'Offline')),
    ),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      muted('Active Model: '),
      primary(String(activeModel)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Backend:      '),
      primary(String(backend)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Device:       '),
      primary(String(device)),
    ),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      muted('Max Tokens:   '),
      primary(String(maxTokens)),
    ),
    h(Box, { flexDirection: 'row' },
      muted('Temperature:  '),
      primary(String(temperature)),
    ),
  );
};

// ── Model List ───────────────────────────────────────────────

interface ModelCardProps {
  model: Record<string, any>;
  isSelected: boolean;
  isActive: boolean;
}

const ModelCard = ({ model, isSelected, isActive }: ModelCardProps) => {
  const name = model.name || model.modelId || 'Unknown';
  const category = model.category || '';
  const selector = isSelected ? icons.arrow : ' ';
  const activeIcon = isActive ? icons.done : ' ';
  const nameColor = isActive ? theme.status.success : (isSelected ? theme.panel.borderFocused : theme.text.primary);

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    h(Text, { color: isActive ? theme.status.success : theme.text.muted }, activeIcon),
    h(Text, null, ' '),
    h(Text, { color: nameColor }, name.length > 35 ? name.substring(0, 35) : name.padEnd(35)),
    category
      ? h(Text, null, ' ', muted(category))
      : null,
    isActive
      ? h(Text, { color: theme.status.success }, '  (active)')
      : null,
  );
};

// ── Providers Panel ─────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  claudeCode: 'Claude Code (CLI)',
  azure: 'Azure OpenAI',
  azureInference: 'Azure AI Inference',
  local: 'Local (FastAPI)',
};

interface ProvidersPanelProps {
  providers: Record<string, any> | null;
}

const ProvidersPanel = ({ providers }: ProvidersPanelProps) => {
  const entries = providers ? Object.entries(providers) : [];

  if (entries.length === 0) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      muted('No providers configured.'),
      h(Text, null, ''),
      h(Text, { color: 'gray', dimColor: true }, 'Run "maestro init" to set up.'),
    );
  }

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    ...entries.map(([id, config]: [string, any]) => {
      const name = PROVIDER_LABELS[id] || id;
      // Show a brief detail for each provider
      let detail = '';
      if (id === 'claudeCode' && config.cliPath) {
        const p = config.cliPath;
        detail = p.length > 25 ? '...' + p.slice(-25) : p;
      } else if (id === 'azure' && config.endpoint) {
        detail = config.deployment || config.endpoint.replace(/https?:\/\//, '').slice(0, 25);
      } else if (id === 'azureInference' && config.endpoint) {
        detail = config.model || config.endpoint.replace(/https?:\/\//, '').slice(0, 25);
      } else if (id === 'local' && config.url) {
        detail = config.url;
      }

      return h(Box, { key: id, flexDirection: 'column' },
        h(Box, { flexDirection: 'row' },
          h(Text, { color: theme.status.success }, `${icons.done} `),
          primary(name),
        ),
        detail ? h(Text, { color: 'gray', dimColor: true }, `    ${detail}`) : null,
      );
    }),
    h(Text, null, ''),
    h(Box, { flexDirection: 'row' },
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
      h(Text, { color: theme.shortcut.key }, 'R'),
      h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
      muted('Reconfigure'),
    ),
  );
};

// ── ModelsScreen component ───────────────────────────────────

interface ModelsScreenProps {
  apiClient: any;
  onNavigate: (page: string) => void;
  onModelSelect?: (id: string, state?: Record<string, any>) => void;
  onQuit: () => void;
  initialState?: Record<string, any>;
  chrome?: boolean;
  keyboardActive?: boolean;
  providers?: Record<string, any> | null;
  onReconfigure?: () => void;
}

const ModelsScreen = ({ apiClient, onNavigate, onModelSelect, onQuit, initialState, chrome, keyboardActive, providers, onReconfigure }: ModelsScreenProps) => {
  const showChrome = chrome !== false;
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const tick = useAnimationTick(150);

  // Fetch LLM health
  const { data: llmHealth } = useApiData(
    useCallback((): Promise<any> => apiClient.getLLMHealth().catch((): any => ({ error: true })), [apiClient]),
    5000
  );

  // Fetch models list
  const { data: models } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listLLMModels().catch((): any[] => []), [apiClient]),
    10000
  );

  // Fetch LLM status
  const { data: llmStatus } = useApiData(
    useCallback((): Promise<any> => apiClient.getLLMStatus().catch((): null => null), [apiClient]),
    10000
  );

  // Fetch sessions for nav badge
  const { data: sessions } = useApiData(
    useCallback((): Promise<any[]> => apiClient.listSessions().catch((): any[] => []), [apiClient]),
    10000
  );

  const modelList: any[] = Array.isArray(models) ? models : [];
  const sessionList: any[] = (sessions as any[]) || [];
  const runningCount = sessionList.filter((s: any) => s.status === 'running').length;

  // Active model name
  const llmHealthData = llmHealth as Record<string, any> | null;
  const activeModel = llmHealthData?.activeModel || '';

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= modelList.length && modelList.length > 0) {
      setSelectedIndex(Math.max(0, modelList.length - 1));
    }
  }, [modelList.length]);

  // Keyboard
  useKeyboard({
    up: () => setSelectedIndex((i: number) => Math.max(0, i - 1)),
    down: () => setSelectedIndex((i: number) => Math.min(modelList.length - 1, i + 1)),
    k: () => setSelectedIndex((i: number) => Math.max(0, i - 1)),
    j: () => setSelectedIndex((i: number) => Math.min(modelList.length - 1, i + 1)),
    // Chrome-only keys: page navigation (disabled when embedded in maestro-code)
    ...(showChrome ? {
      ctrlLeft: () => onNavigate(prevPage('models')),
      ctrlRight: () => onNavigate(nextPage('models')),
    } : {}),
    enter: () => {
      if (onModelSelect && modelList.length > 0) {
        const model = modelList[selectedIndex];
        if (model?.modelId) onModelSelect(model.modelId, { selectedIndex });
      }
    },
    ...(showChrome ? {
      h: () => onNavigate('home'),
      a: () => onNavigate('agent'),
      s: () => onNavigate('spaces'),
      f: () => onNavigate('foundry'),
      c: () => onNavigate('catalog'),
      m: () => {},
    } : {}),
    r: () => { if (onReconfigure) onReconfigure(); },
    escape: showChrome ? () => onNavigate('home') : undefined,
    q: onQuit,
  }, { isActive: keyboardActive !== false });

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    showChrome ? h(NavBar, { currentPage: 'models', sessionCount: sessionList.length, runningCount }) : null,

    // Main content: Status | Providers | Model List
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      // Status panel (left, 30%)
      h(Panel, { title: 'MODEL STATUS', width: '30%' },
        h(ModelStatusPanel, { health: llmHealth, llmStatus, tick }),
      ),

      // Providers panel (center, 25%)
      h(Panel, { title: 'PROVIDERS', width: '25%' },
        h(ProvidersPanel, { providers }),
      ),

      // Model list (right, fills remaining)
      h(Panel, { title: 'AVAILABLE MODELS', flexGrow: 1 },
        h(Box, { flexDirection: 'column' },
          h(Box, { paddingLeft: 2, marginBottom: 1 },
            muted(`${modelList.length} model(s) available`),
          ),
          modelList.length === 0
            ? h(Box, { flexDirection: 'column', paddingLeft: 2 },
                muted('No models found'),
                h(Text, null, ''),
                muted('Is the LLM provider running?'),
              )
            : h(Box, { flexDirection: 'column' },
                ...modelList.map((model, i) => {
                  const isActive = model.modelId === activeModel;
                  return h(ModelCard, {
                    key: model.modelId || `m-${i}`,
                    model,
                    isSelected: i === selectedIndex,
                    isActive,
                  });
                }),
              ),
        ),
      ),
    ),

  );
};

export { ModelsScreen };
