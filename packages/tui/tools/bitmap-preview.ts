#!/usr/bin/env npx tsx
/**
 * Bitmap Preview — Renders bitmaps to scaled PNG images.
 *
 * Supports 3-color bitmaps:
 *   '#' = primary (outlines, features) — brightest
 *   '+' = secondary (fill, shading) — medium
 *   '.' or ' ' = background — dark
 *
 * Usage:
 *   npx tsx tools/bitmap-preview.ts --file sprite.txt output.png [--scale N] [--theme cyan|orange|white]
 *   npx tsx tools/bitmap-preview.ts --all previews/
 *   npx tsx tools/bitmap-preview.ts SPRITE_NAME output.png
 */

import { Jimp } from 'jimp';
import * as path from 'path';
import * as fs from 'fs';
import type { BitmapString } from '../utils/bitmap.ts';

// ── Themes ──────────────────────────────────────────────────

interface ColorTheme {
  bg: number;
  shade: number;
  primary: number;
  grid: number;
  halfLine: number;
}

const THEMES: Record<string, ColorTheme> = {
  cyan: {
    bg:       0x0A0A1AFF,
    shade:    0x1A5C6AFF,
    primary:  0x00E5FFFF,
    grid:     0x222233FF,
    halfLine: 0x333355FF,
  },
  orange: {
    bg:       0x1A1208FF,
    shade:    0x8B6914FF,
    primary:  0xFF9900FF,
    grid:     0x332211FF,
    halfLine: 0x443322FF,
  },
  white: {
    bg:       0x111111FF,
    shade:    0x666666FF,
    primary:  0xFFFFFFFF,
    grid:     0x333333FF,
    halfLine: 0x444488FF,
  },
};

// ── Parse multi-color bitmap ────────────────────────────────

function parseMultiColor(rows: string[]): number[][] {
  return rows.map(row =>
    [...row].map(ch => {
      if (ch === '#' || ch === '@') return 2;  // primary
      if (ch === '+' || ch === ':') return 1;  // shade
      return 0;                                 // background
    })
  );
}

// ── Render ──────────────────────────────────────────────────

async function renderBitmapToPng(
  rawRows: string[],
  outputPath: string,
  scale: number,
  showGrid: boolean,
  theme: ColorTheme,
): Promise<void> {
  const pixels = parseMultiColor(rawRows);
  if (pixels.length === 0) { console.error('Empty bitmap'); return; }

  const height = pixels.length;
  const width = Math.max(...pixels.map(r => r.length));
  const padded = pixels.map(row => {
    const r = [...row];
    while (r.length < width) r.push(0);
    return r;
  });

  const imgW = width * scale + (showGrid ? 1 : 0);
  const imgH = height * scale + (showGrid ? 1 : 0);
  const image = new Jimp({ width: imgW, height: imgH, color: theme.bg });

  const COLORS = [theme.bg, theme.shade, theme.primary];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = padded[y][x];
      const color = COLORS[val] ?? theme.bg;
      const px = x * scale + (showGrid ? 1 : 0);
      const py = y * scale + (showGrid ? 1 : 0);
      const cellW = scale - (showGrid ? 1 : 0);
      const cellH = scale - (showGrid ? 1 : 0);

      for (let dy = 0; dy < cellH; dy++) {
        for (let dx = 0; dx < cellW; dx++) {
          const ix = px + dx;
          const iy = py + dy;
          if (ix < imgW && iy < imgH) image.setPixelColor(color, ix, iy);
        }
      }
    }
  }

  if (showGrid) {
    for (let x = 0; x <= width; x++) {
      const px = x * scale;
      for (let iy = 0; iy < imgH; iy++) {
        if (px < imgW) image.setPixelColor(theme.grid, px, iy);
      }
    }
    for (let y = 0; y <= height; y++) {
      const py = y * scale;
      for (let ix = 0; ix < imgW; ix++) {
        if (py < imgH) image.setPixelColor(theme.grid, ix, py);
      }
    }
    // Half-block dividers
    for (let y = 2; y < height; y += 2) {
      const py = y * scale;
      for (let ix = 0; ix < imgW; ix++) {
        if (py < imgH) image.setPixelColor(theme.halfLine, ix, py);
      }
    }
  }

  const dir = path.dirname(outputPath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await image.write(outputPath as `${string}.${string}`);
  console.log(`${width}x${height} → ${outputPath}`);
}

// ── CLI ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let scale = 12;
  let showGrid = true;
  let themeName = 'cyan';

  // Parse flags
  for (let i = args.length - 1; i >= 0; i--) {
    if (args[i] === '--scale' && args[i + 1]) {
      scale = parseInt(args[i + 1], 10);
      args.splice(i, 2);
    } else if (args[i] === '--no-grid') {
      showGrid = false;
      args.splice(i, 1);
    } else if (args[i] === '--theme' && args[i + 1]) {
      themeName = args[i + 1];
      args.splice(i, 2);
    }
  }

  const theme = THEMES[themeName] ?? THEMES.cyan;

  if (args[0] === '--file') {
    const filePath = args[1];
    const output = args[2] || 'preview.png';
    const content = fs.readFileSync(filePath, 'utf-8');
    const bitmap = content.split('\n').map(l => l.replace(/\r/g, '')).filter(l => l.length > 0);
    await renderBitmapToPng(bitmap, output, scale, showGrid, theme);
    return;
  }

  if (args[0] === '--file-all-themes') {
    const filePath = args[1];
    const baseName = args[2] || 'preview';
    const content = fs.readFileSync(filePath, 'utf-8');
    const bitmap = content.split('\n').map(l => l.replace(/\r/g, '')).filter(l => l.length > 0);
    for (const [name, t] of Object.entries(THEMES)) {
      await renderBitmapToPng(bitmap, `${baseName}-${name}.png`, scale, showGrid, t);
    }
    return;
  }

  console.log('Usage:');
  console.log('  npx tsx tools/bitmap-preview.ts --file sprite.txt [output.png] [--scale N] [--theme cyan|orange|white]');
  console.log('  npx tsx tools/bitmap-preview.ts --file-all-themes sprite.txt [base-name]');
}

main().catch(console.error);
