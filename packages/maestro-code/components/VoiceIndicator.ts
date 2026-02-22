/**
 * VoiceIndicator — shows a "VOICE" badge in the StatusBar when voice mode is active.
 */

import { createElement as h } from 'react';
import { Text } from 'ink';

interface VoiceIndicatorProps {
  active: boolean;
}

const VoiceIndicator = ({ active }: VoiceIndicatorProps) => {
  if (!active) return null;

  return h(Text, { color: 'magenta', bold: true }, ' VOICE ');
};

export { VoiceIndicator };
export type { VoiceIndicatorProps };
