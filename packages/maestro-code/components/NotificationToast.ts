// @ts-nocheck
/**
 * NotificationToast — Ephemeral notification at top of screen.
 *
 * Appears when an important agent event occurs while user is on
 * a DIFFERENT page. Auto-dismisses after 5 seconds.
 * Any keypress also dismisses it.
 *
 * Events: task complete, task error, agent needs input, connection lost.
 *
 * Phase 41-F.
 */

import { createElement as h, useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';

// ── Types ─────────────────────────────────────────────────────

export type ToastType = 'complete' | 'error' | 'needs-input' | 'connection-lost';

export interface ToastEvent {
  type: ToastType;
  message: string;
  timestamp: number;
}

export interface NotificationToastProps {
  toast: ToastEvent | null;
  onDismiss: () => void;
}

// ── Config ────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: string; color: string }> = {
  complete: { icon: '★', color: 'green' },
  error: { icon: '✗', color: 'red' },
  'needs-input': { icon: '?', color: 'yellow' },
  'connection-lost': { icon: '⚡', color: 'red' },
};

const AUTO_DISMISS_MS = 5000;

// ── Component ─────────────────────────────────────────────────

const NotificationToast = ({ toast, onDismiss }: NotificationToastProps) => {
  // Auto-dismiss timer
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.complete;
  const hintText = toast.type === 'needs-input'
    ? '[J] join  [Esc] dismiss'
    : toast.type === 'complete'
      ? '[J] join  [Esc] dismiss'
      : '[Esc] dismiss';

  return h(Box, {
    width: '100%',
    justifyContent: 'center',
    paddingX: 2,
  },
    h(Box, {
      borderStyle: 'round',
      borderColor: config.color,
      paddingX: 2,
      width: 50,
      flexDirection: 'column',
    },
      h(Box, { gap: 1 },
        h(Text, { color: config.color, bold: true }, `${config.icon} ${toast.message}`),
      ),
      h(Text, { color: 'gray', dimColor: true }, `  ${hintText}`),
    ),
  );
};

export { NotificationToast };
