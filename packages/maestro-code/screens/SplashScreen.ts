// @ts-nocheck
/**
 * SplashScreen — Pixel art logo displayed on startup for 1.5s.
 *
 * Shows the MAESTRO branding with pixel art mascotte + version + tagline.
 * Auto-dismisses after `duration` ms (default 1500).
 */

import { createElement as h, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { brand } from '@maestro/tui/theme';
import { inkTheme as theme, breathingDot } from '@maestro/tui/theme';
import { useAnimationTick } from '@maestro/tui/hooks';
import { renderBitmap } from '@maestro/tui/utils';
import { SPLASH } from '@maestro/tui/sprites';

interface SplashScreenProps {
  onDone: () => void;
  duration?: number;
}

const SplashScreen = ({ onDone, duration = 1500 }: SplashScreenProps) => {
  const tick = useAnimationTick(200);

  useEffect(() => {
    const timer = setTimeout(() => onDone(), duration);
    return () => clearTimeout(timer);
  }, [onDone, duration]);

  const mascotteLines = renderBitmap(SPLASH);

  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
    // Pixel art mascotte
    h(Box, { flexDirection: 'column', alignItems: 'center', marginBottom: 1 },
      ...mascotteLines.map((line, i) =>
        h(Text, { key: `px-${i}`, color: theme.panel.borderFocused }, line)
      ),
    ),

    // Logo text
    h(Box, { flexDirection: 'column', alignItems: 'center', marginBottom: 1 },
      ...brand.logoLines.map((line, i) =>
        h(Text, { key: `logo-${i}`, color: theme.panel.borderFocused }, line)
      ),
    ),

    // Version + tagline
    h(Box, { marginBottom: 1 },
      h(Text, { color: theme.panel.borderFocused, bold: true }, brand.name),
      h(Text, null, ' '),
      h(Text, { color: 'gray', dimColor: true }, `v${brand.version}`),
    ),
    h(Box, { marginBottom: 1 },
      h(Text, { color: 'gray', dimColor: true }, brand.tagline),
    ),

    // Loading indicator
    h(Box, null,
      h(Text, { color: theme.agent.working }, `${breathingDot(tick)} `),
      h(Text, { color: 'gray', dimColor: true }, 'Starting...'),
    ),
  );
};

export { SplashScreen };
