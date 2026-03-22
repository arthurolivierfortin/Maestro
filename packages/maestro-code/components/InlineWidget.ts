/**
 * InlineWidget — Wrapper that renders a widget inline in the ConversationLog.
 *
 * Responsibilities:
 * 1. Renders the correct widget based on widget.type via WidgetDispatcher
 * 2. Manages focus via FocusProvider (claim('widget') when focused, release when not)
 * 3. Wraps content in a Panel with focused border styling
 * 4. Handles Esc to close/collapse the widget
 * 5. Respects height constraints per widget type
 */

import { createElement as h, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { theme } from '../theme.ts';
import { useFocusContext } from '../hooks/useFocusProvider.ts';
import { useManagedInput } from '../hooks/useManagedInput.ts';
import type { ChatWidget, WidgetType } from '../types/widgets.ts';
import { WIDGET_HEIGHTS, WIDGET_TITLES } from '../types/widgets.ts';
import { Panel } from './Panel.ts';

// Widget imports
import { StatusWidget } from './widgets/StatusWidget.ts';
import { SessionsWidget } from './widgets/SessionsWidget.ts';
import { WorkspacesWidget } from './widgets/WorkspacesWidget.ts';
import { ReposWidget } from './widgets/ReposWidget.ts';
import { CatalogWidget } from './widgets/CatalogWidget.ts';
import { FoundryWidget } from './widgets/FoundryWidget.ts';
import { ModelsWidget } from './widgets/ModelsWidget.ts';
import { SessionMonitorWidget } from './widgets/SessionMonitorWidget.ts';
import { BlockDetailWidget } from './widgets/BlockDetailWidget.ts';
import { ModelDetailWidget } from './widgets/ModelDetailWidget.ts';
import { WorkspaceDetailWidget } from './widgets/WorkspaceDetailWidget.ts';
import { RepoDetailWidget } from './widgets/RepoDetailWidget.ts';
import { PermissionsWidget } from './widgets/PermissionsWidget.ts';

// ── Navigation callback type ─────────────────────────────────

export type WidgetNavigateFn = (targetType: WidgetType, targetProps: Record<string, any>) => void;

// ── Widget Dispatcher ────────────────────────────────────────

interface WidgetDispatcherProps {
  type: WidgetType;
  props: Record<string, any>;
  apiClient: any;
  focused: boolean;
  onNavigate?: WidgetNavigateFn;
}

const WidgetDispatcher = ({ type, props, apiClient, focused, onNavigate }: WidgetDispatcherProps) => {
  // Build navigation callbacks from onNavigate
  const onSessionSelect = onNavigate
    ? (id: string) => onNavigate('session-monitor', { sessionId: id })
    : undefined;
  const onBlockSelect = onNavigate
    ? (id: string) => onNavigate('block-detail', { blockId: id })
    : undefined;
  const onModelSelect = onNavigate
    ? (id: string) => onNavigate('model-detail', { modelId: id })
    : undefined;

  const commonProps = { apiClient, focused, ...props };

  switch (type) {
    case 'status':
      return h(StatusWidget, { ...commonProps, onSessionSelect });
    case 'sessions':
      return h(SessionsWidget, { ...commonProps, onSessionSelect });
    case 'workspaces':
      return h(WorkspacesWidget, commonProps);
    case 'repos':
      return h(ReposWidget, commonProps);
    case 'catalog':
      return h(CatalogWidget, { ...commonProps, onBlockSelect });
    case 'foundry':
      return h(FoundryWidget, { ...commonProps, onBlockSelect });
    case 'models':
      return h(ModelsWidget, { ...commonProps, onModelSelect });
    case 'session-monitor':
      return h(SessionMonitorWidget, { ...commonProps, sessionId: props.sessionId || '' });
    case 'block-detail':
      return h(BlockDetailWidget, { ...commonProps, blockId: props.blockId || '' });
    case 'model-detail':
      return h(ModelDetailWidget, { ...commonProps, modelId: props.modelId || '' });
    case 'workspace-detail':
      return h(WorkspaceDetailWidget, { ...commonProps, workspaceId: props.workspaceId || '' });
    case 'repo-detail':
      return h(RepoDetailWidget, { ...commonProps, repoId: props.repoId || '' });
    case 'permissions':
      return h(PermissionsWidget, { ...commonProps, sessionId: props.sessionId || '' });
    default:
      return h(Text, { color: 'gray' }, `Unknown widget type: ${type}`);
  }
};

// ── InlineWidget ─────────────────────────────────────────────

export interface InlineWidgetProps {
  id: string;
  widget: ChatWidget;
  focused: boolean;
  collapsed: boolean;
  apiClient: any;
  onClose: () => void;
  onNavigate?: WidgetNavigateFn;
}

const InlineWidget = ({ id, widget, focused, collapsed, apiClient, onClose, onNavigate }: InlineWidgetProps) => {
  const { claim, release } = useFocusContext();
  const { stdout } = useStdout();

  // Claim/release widget focus layer
  // Even non-interactive widgets claim focus when focused so Esc can close them
  useEffect(() => {
    if (focused) {
      claim('widget');
    } else {
      release('widget');
    }
    return () => { release('widget'); };
  }, [focused, claim, release]);

  // Esc closes/collapses the widget (works for ALL widgets, interactive or not)
  useManagedInput('widget', (input, key) => {
    if (key.escape) {
      onClose();
    }
  }, { isActive: focused });

  const title = WIDGET_TITLES[widget.type] || widget.type;
  const borderColor = focused ? theme.panel.borderFocused : theme.panel.border;

  // Collapsed view: 1-line summary
  if (collapsed) {
    return h(Box, {
      flexDirection: 'row',
      paddingLeft: 2,
      paddingRight: 2,
    },
      h(Text, { color: 'gray', dimColor: true }, `[${title}] `),
      h(Text, { color: 'gray', dimColor: true }, '(collapsed)'),
    );
  }

  // Compute height constraint
  let maxHeight: number | undefined;
  const configuredHeight = WIDGET_HEIGHTS[widget.type];
  if (configuredHeight === -1) {
    // Session monitor: terminal.rows - 6
    maxHeight = (stdout.rows || 40) - 6;
  } else if (typeof configuredHeight === 'number') {
    maxHeight = configuredHeight;
  }

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'single' as const,
    borderColor,
    paddingLeft: 1,
    paddingRight: 1,
    marginLeft: 1,
    marginRight: 1,
    ...(maxHeight ? { height: maxHeight } : {}),
    overflow: 'hidden' as const,
  },
    // Title bar
    h(Box, { flexDirection: 'row' },
      h(Text, { color: borderColor, bold: true }, `${title}`),
      focused
        ? h(Text, { color: 'gray', dimColor: true }, '  [Esc] close')
        : null,
    ),
    // Widget content
    h(WidgetDispatcher, {
      type: widget.type,
      props: widget.props,
      apiClient,
      focused,
      onNavigate,
    }),
  );
};

export { InlineWidget };
