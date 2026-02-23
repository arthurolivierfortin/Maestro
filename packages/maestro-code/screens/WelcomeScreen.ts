// @ts-nocheck
/**
 * WelcomeScreen — First-run experience.
 *
 * Shown when .maestro/ directory is not found in the project.
 * Displays the Maestro branding and getting started instructions.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { brand } from '@maestro/tui/theme';
import {
  inkTheme as theme,
  primary, muted, bold, success,
} from '@maestro/tui/theme/ink';

interface WelcomeScreenProps {
  onInit: () => void;
  onSkip: () => void;
  onHelp: () => void;
}

const WelcomeScreen = ({ onInit, onSkip, onHelp }: WelcomeScreenProps) => {
  return h(Box, {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    padding: 2,
  },
    // Logo
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
    h(Box, { marginBottom: 2 },
      muted(brand.tagline),
    ),

    // Welcome message
    h(Box, {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: theme.panel.borderFocused,
      padding: 1,
      width: 50,
    },
      h(Box, { marginBottom: 1 },
        bold('Welcome to Maestro!'),
      ),
      h(Box, { marginBottom: 1 },
        muted('No .maestro/ directory found in this project.'),
      ),
      h(Box, { marginBottom: 1 },
        muted('Initialize to get started with AI-powered development.'),
      ),
      h(Box, { flexDirection: 'column', marginTop: 1 },
        h(Box, { flexDirection: 'row' },
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
          h(Text, { color: theme.shortcut.key }, 'i'),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
          primary('Initialize project'),
        ),
        h(Box, { flexDirection: 'row' },
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
          h(Text, { color: theme.shortcut.key }, 'Enter'),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
          primary('Skip and start'),
        ),
        h(Box, { flexDirection: 'row' },
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '['),
          h(Text, { color: theme.shortcut.key }, '?'),
          h(Text, { color: theme.shortcut.bracket, dimColor: true }, '] '),
          primary('Help'),
        ),
      ),
    ),
  );
};

export { WelcomeScreen };
