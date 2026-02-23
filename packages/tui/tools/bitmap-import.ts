#!/usr/bin/env npx tsx
/**
 * Bitmap Import — Convert a PNG/JPEG image to a bitmap string array.
 *
 * Takes an image, converts to grayscale, applies threshold, outputs bitmap.
 *
 * Usage:
 *   npx tsx tools/bitmap-import.ts <input.png> [--width N] [--threshold N] [--invert]
 *
 * Examples:
 *   npx tsx tools/bitmap-import.ts mascotte.png --width 24
 *   npx tsx tools/bitmap-import.ts icon.png --width 32 --threshold 128 --invert
 *   npx tsx tools/bitmap-import.ts icon.png --width 16 --out sprite.ts
 */

import { Jimp } from 'jimp';
import * as fs from 'fs';

async function importImage(
  inputPath: string,
  targetWidth: number,
  threshold: number,
  invert: boolean,
): Promise<string[]> {
  const image = await Jimp.read(inputPath);

  // Resize to target width (maintain aspect ratio)
  const aspect = image.height / image.width;
  const targetHeight = Math.round(targetWidth * aspect);
  image.resize({ w: targetWidth, h: targetHeight });

  // Convert to bitmap
  const rows: string[] = [];
  for (let y = 0; y < targetHeight; y++) {
    let row = '';
    for (let x = 0; x < targetWidth; x++) {
      const color = image.getPixelColor(x, y);
      // Extract RGBA
      const r = (color >> 24) & 0xFF;
      const g = (color >> 16) & 0xFF;
      const b = (color >> 8) & 0xFF;
      const a = color & 0xFF;

      // Grayscale luminance
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const isTransparent = a < 128;

      let isOn: boolean;
      if (isTransparent) {
        isOn = false;
      } else {
        isOn = invert ? (gray < threshold) : (gray >= threshold);
      }
      row += isOn ? '#' : '.';
    }
    rows.push(row);
  }

  return rows;
}

function formatAsTypeScript(name: string, rows: string[]): string {
  const lines = rows.map(r => `  '${r}',`).join('\n');
  return `export const ${name}: string[] = [\n${lines}\n];\n`;
}

async function main() {
  const args = process.argv.slice(2);

  let targetWidth = 24;
  let threshold = 128;
  let invert = false;
  let outFile: string | null = null;
  let inputPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--width' && args[i + 1]) {
      targetWidth = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--threshold' && args[i + 1]) {
      threshold = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--invert') {
      invert = true;
    } else if (args[i] === '--out' && args[i + 1]) {
      outFile = args[i + 1];
      i++;
    } else if (!inputPath) {
      inputPath = args[i];
    }
  }

  if (!inputPath) {
    console.log('Usage: npx tsx tools/bitmap-import.ts <image.png> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --width N      Target width in pixels (default: 24)');
    console.log('  --threshold N  Brightness threshold 0-255 (default: 128)');
    console.log('  --invert       Invert: dark pixels become on (for dark images)');
    console.log('  --out file.ts  Write TypeScript export to file');
    return;
  }

  const rows = await importImage(inputPath, targetWidth, threshold, invert);

  console.log(`Imported ${inputPath} → ${targetWidth}x${rows.length} bitmap`);
  console.log('');

  // Print the bitmap
  for (const row of rows) {
    console.log(row);
  }

  console.log('');
  console.log('// TypeScript:');
  const name = inputPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
  const ts = formatAsTypeScript(name, rows);
  console.log(ts);

  if (outFile) {
    fs.writeFileSync(outFile, ts, 'utf-8');
    console.log(`Wrote to ${outFile}`);
  }
}

main().catch(console.error);
