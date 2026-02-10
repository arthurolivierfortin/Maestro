/**
 * Maestro TUI Monitor — Ink App (Root)
 *
 * Entry point for the Ink-based monitor. Routes between:
 * - GlobalMonitor (session list) when no sessionId
 * - SessionMonitor (single session) when sessionId provided
 *
 * Supports navigation: GlobalMonitor → select → SessionMonitor → Esc → GlobalMonitor
 *
 * FullscreenBox provides explicit terminal height to Yoga so that
 * percentage heights and flexGrow work correctly in child layouts.
 */

import { createElement as h, useState, useCallback, useEffect } from 'react';
import { render, useApp, useStdout, Box } from 'ink';
import { theme } from './theme.js';
import { GlobalMonitor } from './components/GlobalMonitor.js';
import { SessionMonitor } from './components/SessionMonitor.js';

// ── Terminal background color control ──────────────────────────
//
// Ink's Box doesn't support backgroundColor. We use OSC 11 to
// change the terminal's own default background color on start,
// and restore it on exit. Works with Windows Terminal, iTerm2,
// xterm, and most modern terminal emulators.

function hexToOscRgb(hex) {
  // '#1a1a2e' → 'rgb:1a1a/1a1a/2e2e' (16-bit per channel for OSC)
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `rgb:${r}${r}/${g}${g}/${b}${b}`;
}

function setTerminalBg(hexColor) {
  if (!hexColor || !process.stdout.isTTY) return;
  const osc = `\x1b]11;${hexToOscRgb(hexColor)}\x07`;
  process.stdout.write(osc);
}

function resetTerminalBg() {
  if (!process.stdout.isTTY) return;
  // OSC 111 resets background to terminal default
  process.stdout.write('\x1b]111\x07');
}

// ── FullscreenBox — provides explicit height to Yoga ────────────
//
// Ink's root Yoga node only sets width, not height. Without an
// explicit numeric height, all percentage heights and flexGrow on
// children are meaningless. This wrapper reads stdout.rows and
// passes it as an explicit height, enabling proper layout.

const FullscreenBox = ({ children }) => {
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows || 24);

  useEffect(() => {
    const onResize = () => {
      if (stdout.rows) setRows(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  return h(Box, { flexDirection: 'column', width: '100%', height: rows }, children);
};

// ── Root App Component ─────────────────────────────────────────

const App = ({ initialSessionId, apiClient }) => {
  const { exit } = useApp();
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId || null);

  const handleSessionSelect = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
  }, []);

  const handleBack = useCallback(() => {
    if (currentSessionId) {
      setCurrentSessionId(null);
    } else {
      exit();
    }
  }, [currentSessionId, exit]);

  const handleQuit = useCallback(() => {
    exit();
  }, [exit]);

  if (currentSessionId) {
    return h(FullscreenBox, null,
      h(SessionMonitor, {
        sessionId: currentSessionId,
        apiClient,
        onExit: handleBack,
        onQuit: handleQuit,
      })
    );
  }

  return h(FullscreenBox, null,
    h(GlobalMonitor, {
      apiClient,
      onSessionSelect: handleSessionSelect,
      onQuit: handleQuit,
    })
  );
};

// ── Public entry point (called from CJS tui-monitor.js) ────────

async function startInkMonitor(sessionId, apiClient, options = {}) {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Ink monitor requires an interactive terminal (TTY). '
      + 'Run in a proper terminal window or use --legacy flag.'
    );
  }

  // Set terminal background color from theme
  setTerminalBg(theme.bg);

  const instance = render(
    h(App, { initialSessionId: sessionId, apiClient }),
    {
      exitOnCtrlC: true,
    }
  );

  try {
    await instance.waitUntilExit();
  } finally {
    // Always restore terminal background on exit
    resetTerminalBg();
  }
}

export { startInkMonitor, App };
