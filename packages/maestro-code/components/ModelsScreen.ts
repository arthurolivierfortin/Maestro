// @ts-nocheck
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

const ModelStatusPanel = ({ health, llmStatus, tick = 0 }) => {
  const isHealthy = health && !health.error;
  const healthColor = isHealthy ? theme.status.success : theme.status.error;
  const healthIcon = isHealthy ? breathingDot(tick) : icons.failed;

  // Extract info from health response
  const activeModel = health?.activeModel || health?.model || health?.model_id || '-';
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
      T(healthColor, isHealthy ? 'Online' : 'Offline'),
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

const ModelCard = ({ model, isSelected, isActive }) => {
  const name = typeof model === 'string' ? model : (model.name || model.id || model.model_id || 'Unknown');
  const selector = isSelected ? icons.arrow : ' ';
  const activeIcon = isActive ? icons.done : ' ';
  const nameColor = isActive ? theme.status.success : (isSelected ? theme.panel.borderFocused : theme.text.primary);

  return h(Box, { flexDirection: 'row', paddingLeft: 1 },
    h(Text, { color: isSelected ? theme.panel.borderFocused : undefined }, selector),
    h(Text, null, ' '),
    h(Text, { color: isActive ? theme.status.success : theme.text.muted }, activeIcon),
    h(Text, null, ' '),
    h(Text, { color: nameColor }, name),
    isActive
      ? h(Text, { color: theme.status.success }, '  (active)')
      : null,
  );
};

// ── ModelsScreen component ───────────────────────────────────

const ModelsScreen = ({ apiClient, onNavigate, onModelSelect, onQuit, initialState, chrome, keyboardActive }) => {
  const showChrome = chrome !== false;
  const [selectedIndex, setSelectedIndex] = useState(initialState?.selectedIndex ?? 0);
  const tick = useAnimationTick(150);

  // Fetch LLM health
  const { data: llmHealth } = useApiData(
    useCallback(() => apiClient.getLLMHealth().catch(() => ({ error: true })), [apiClient]),
    5000
  );

  // Fetch models list
  const { data: models } = useApiData(
    useCallback(() => apiClient.listLLMModels().catch(() => []), [apiClient]),
    10000
  );

  // Fetch LLM status
  const { data: llmStatus } = useApiData(
    useCallback(() => apiClient.getLLMStatus().catch(() => null), [apiClient]),
    10000
  );

  // Fetch sessions for nav badge
  const { data: sessions } = useApiData(
    useCallback(() => apiClient.listSessions().catch(() => []), [apiClient]),
    10000
  );

  const modelList = Array.isArray(models) ? models : [];
  const sessionList = sessions || [];
  const runningCount = sessionList.filter(s => s.status === 'running').length;

  // Active model name
  const activeModel = llmHealth?.activeModel || llmHealth?.model || llmHealth?.model_id || '';

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= modelList.length && modelList.length > 0) {
      setSelectedIndex(Math.max(0, modelList.length - 1));
    }
  }, [modelList.length]);

  // Keyboard
  useKeyboard({
    up: () => setSelectedIndex(i => Math.max(0, i - 1)),
    down: () => setSelectedIndex(i => Math.min(modelList.length - 1, i + 1)),
    k: () => setSelectedIndex(i => Math.max(0, i - 1)),
    j: () => setSelectedIndex(i => Math.min(modelList.length - 1, i + 1)),
    // Chrome-only keys: page navigation (disabled when embedded in maestro-code)
    ...(showChrome ? {
      ctrlLeft: () => onNavigate(prevPage('models')),
      ctrlRight: () => onNavigate(nextPage('models')),
    } : {}),
    enter: () => {
      if (onModelSelect && modelList.length > 0) {
        const model = modelList[selectedIndex];
        const modelName = typeof model === 'string' ? model : (model.id || model.name || model.model_id || '');
        if (modelName) onModelSelect(modelName, { selectedIndex });
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
    escape: showChrome ? () => onNavigate('home') : undefined,
    q: onQuit,
  }, { isActive: keyboardActive !== false });

  return h(Box, { flexDirection: 'column', width: '100%', flexGrow: 1 },
    showChrome ? h(NavBar, { currentPage: 'models', sessionCount: sessionList.length, runningCount }) : null,

    // Main content: Status | Model List
    h(Box, { flexDirection: 'row', flexGrow: 1, width: '100%' },
      // Status panel (left, 40%)
      h(Panel, { title: 'MODEL STATUS', width: '40%' },
        h(ModelStatusPanel, { health: llmHealth, llmStatus, tick }),
      ),

      // Model list (right, 60%)
      h(Panel, { title: 'AVAILABLE MODELS', flexGrow: 1 },
        h(Box, { flexDirection: 'column' },
          h(Box, { paddingLeft: 2, marginBottom: 1 },
            muted(`${modelList.length} model(s) available`),
          ),
          modelList.length === 0
            ? h(Box, { paddingLeft: 2 },
                muted('No models found'),
                h(Text, null, ''),
                muted('Is the LLM provider running?'),
              )
            : h(Box, { flexDirection: 'column' },
                ...modelList.map((model, i) => {
                  const modelName = typeof model === 'string' ? model : (model.name || model.id || model.model_id || '');
                  const isActive = modelName === activeModel;
                  return h(ModelCard, {
                    key: modelName || `m-${i}`,
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
