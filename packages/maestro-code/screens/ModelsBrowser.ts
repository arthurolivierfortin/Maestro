// @ts-nocheck
/**
 * ModelsBrowser — Browse available LLM models.
 *
 * Lists models from the LLM-Provider API.
 * Shows active model, availability, and performance metrics.
 */

import { createElement as h, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Panel } from '@maestro/tui/components';
import { useApiData, useSelectableList } from '@maestro/tui/hooks';
import { useActionKeyboard } from '@maestro/tui/hooks';
import { muted, bold, primary, success } from '@maestro/tui/theme';

import type { Screen } from '../types.ts';

interface ModelsBrowserProps {
  apiClient: any;
  onNavigate?: (screen: Screen) => void;
  onBack: () => void;
  onQuit: () => void;
  height: number;
}

const ModelsBrowser = ({ apiClient, onNavigate, onBack, onQuit, height }: ModelsBrowserProps) => {
  const { data: models } = useApiData(
    useCallback(() =>
      apiClient?._fetch?.('GET', '/api/provider/models').catch(() => []) || Promise.resolve([]),
    [apiClient]),
    10000
  );

  const { data: active } = useApiData(
    useCallback(() =>
      apiClient?._fetch?.('GET', '/api/provider/active').catch(() => null) || Promise.resolve(null),
    [apiClient]),
    10000
  );

  const modelList = models || [];
  const activeModelId = active?.modelId || active?.model_id || null;

  const {
    selectedIndex,
    moveUp,
    moveDown,
    scrollStart,
    visibleCount,
    canScrollUp,
    canScrollDown,
    positionLabel,
  } = useSelectableList({ itemCount: modelList.length, pageSize: height - 8 });

  useActionKeyboard({
    'cursor.up': moveUp,
    'cursor.down': moveDown,
    'cursor.upAlt': moveUp,
    'cursor.downAlt': moveDown,
    'tree.toggle': () => {
      const model = modelList[selectedIndex];
      if (model && onNavigate) {
        const modelId = model.model_id || model.id || 'unknown';
        onNavigate({ type: 'model-detail', id: modelId });
      }
    },
    'back': onBack,
    'quit': onQuit,
  }, 'detail');

  const visibleModels = modelList.slice(scrollStart, scrollStart + visibleCount);

  return h(Panel, {
    title: 'MODELS',
    focused: true,
    flexGrow: 1,
    cursorInfo: positionLabel,
    showScroll: true,
    canScrollUp,
    canScrollDown,
  },
    h(Box, { flexDirection: 'column', paddingLeft: 1 },
      h(Box, { marginBottom: 1 },
        muted(`${modelList.length} model(s)`),
        activeModelId
          ? h(Text, null, '  ', muted('active: '), success(activeModelId))
          : null,
      ),

      modelList.length === 0
        ? h(Box, { paddingLeft: 1 }, muted('(no models — is LLM-Provider running?)'))
        : h(Box, { flexDirection: 'column' },
            ...visibleModels.map((model, i) => {
              const globalIndex = scrollStart + i;
              const isSelected = globalIndex === selectedIndex;
              const selector = isSelected ? '→' : ' ';
              const modelId = model.model_id || model.id || 'unknown';
              const isActive = modelId === activeModelId;
              const provider = model.provider || 'unknown';

              return h(Box, {
                key: modelId,
                flexDirection: 'row',
                paddingLeft: 1,
              },
                h(Text, { color: isSelected ? 'cyan' : 'gray' }, selector),
                h(Text, null, ' '),
                isActive
                  ? h(Text, { color: 'green', bold: true }, '● ')
                  : h(Text, { color: 'gray', dimColor: true }, '○ '),
                h(Text, {
                  color: isSelected ? 'cyan' : isActive ? 'green' : 'white',
                  bold: isSelected || isActive,
                }, modelId.padEnd(30)),
                h(Text, null, ' '),
                h(Text, { color: 'gray' }, provider.padEnd(12)),
                model.parameters
                  ? h(Text, { color: 'gray', dimColor: true }, `${model.parameters}`)
                  : null,
              );
            }),
          ),
    ),
  );
};

export { ModelsBrowser };
