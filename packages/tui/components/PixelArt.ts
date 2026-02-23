// @ts-nocheck
/**
 * PixelArt — Ink component that renders a bitmap as 2-color pixel art.
 *
 * Uses Unicode half-blocks for 2x vertical resolution.
 * Each terminal row = 2 pixel rows.
 *
 * Props:
 *   bitmap   BitmapString — pixel art as string array ('#' = on, '.' = off)
 *   color    string — foreground color for "on" pixels (default: 'cyan')
 *
 * Usage:
 *   h(PixelArt, { bitmap: MASCOTTE_IDLE, color: 'cyan' })
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { renderBitmap } from '../utils/bitmap.ts';
import type { BitmapString } from '../utils/bitmap.ts';

interface PixelArtProps {
  bitmap: BitmapString;
  color?: string;
}

const PixelArt = ({ bitmap, color = 'cyan' }: PixelArtProps) => {
  const lines = renderBitmap(bitmap);

  return h(Box, { flexDirection: 'column' },
    ...lines.map((line, i) =>
      h(Text, { key: `px-${i}`, color }, line)
    ),
  );
};

export { PixelArt };
export type { PixelArtProps };
