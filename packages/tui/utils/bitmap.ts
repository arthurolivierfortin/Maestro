/**
 * Bitmap Pixel Art Renderer — 2-color pixel art using Unicode half-blocks.
 *
 * Each terminal character cell represents 2 vertical pixels using:
 *   ▀ (U+2580) — top pixel on, bottom pixel off
 *   ▄ (U+2584) — top pixel off, bottom pixel on
 *   █ (U+2588) — both pixels on
 *   ' '        — both pixels off
 *
 * This gives 2x vertical resolution per character row.
 *
 * Bitmap format: 2D array of 0/1, or a string[] where '#' = on, '.' = off.
 *
 * Example (8x6 pixel heart):
 *   const heart = [
 *     '.##.##.',
 *     '#######',
 *     '#######',
 *     '.#####.',
 *     '..###..',
 *     '...#...',
 *   ];
 *   const lines = renderBitmap(heart);
 *   // → 3 terminal lines (6 pixel rows / 2)
 */

// ── Types ────────────────────────────────────────────────────

/** Bitmap as string rows: '#' or any non-'.' char = on, '.' or ' ' = off */
export type BitmapString = string[];

/** Bitmap as numeric rows: 1 = on, 0 = off */
export type BitmapNumeric = number[][];

/** Either format */
export type Bitmap = BitmapString | BitmapNumeric;

// ── Parsing ──────────────────────────────────────────────────

/** Convert any Bitmap to normalized numeric format */
export function parseBitmap(bitmap: Bitmap): number[][] {
  if (bitmap.length === 0) return [];
  if (typeof bitmap[0] === 'string') {
    return (bitmap as string[]).map(row =>
      [...row].map(ch => (ch === '.' || ch === ' ') ? 0 : 1)
    );
  }
  return bitmap as number[][];
}

/** Get bitmap dimensions */
export function bitmapSize(bitmap: Bitmap): { width: number; height: number } {
  const parsed = parseBitmap(bitmap);
  return {
    width: parsed.length > 0 ? Math.max(...parsed.map(r => r.length)) : 0,
    height: parsed.length,
  };
}

// ── Rendering ────────────────────────────────────────────────

const UPPER = '\u2580'; // ▀
const LOWER = '\u2584'; // ▄
const FULL  = '\u2588'; // █
const EMPTY = ' ';

/**
 * Render a bitmap to terminal lines using Unicode half-blocks.
 *
 * Takes pairs of pixel rows and produces one terminal line per pair.
 * If the bitmap has an odd number of rows, the last row is paired with empty.
 *
 * Returns an array of strings — one per terminal line.
 */
export function renderBitmap(bitmap: Bitmap): string[] {
  const pixels = parseBitmap(bitmap);
  if (pixels.length === 0) return [];

  const width = Math.max(...pixels.map(r => r.length));
  const lines: string[] = [];

  // Pad rows to uniform width
  const padded = pixels.map(row => {
    const r = [...row];
    while (r.length < width) r.push(0);
    return r;
  });

  // Process pairs of rows
  for (let y = 0; y < padded.length; y += 2) {
    const top = padded[y];
    const bottom = y + 1 < padded.length ? padded[y + 1] : new Array(width).fill(0);

    let line = '';
    for (let x = 0; x < width; x++) {
      const t = top[x] ? 1 : 0;
      const b = bottom[x] ? 1 : 0;

      if (t && b) line += FULL;
      else if (t && !b) line += UPPER;
      else if (!t && b) line += LOWER;
      else line += EMPTY;
    }
    lines.push(line);
  }

  return lines;
}

/**
 * Render a bitmap to terminal lines with per-character color info.
 *
 * Returns array of { char, hasTop, hasBottom }[] per line.
 * This allows the caller to apply different foreground/background colors.
 */
export interface PixelChar {
  char: string;
  hasTop: boolean;
  hasBottom: boolean;
}

export function renderBitmapDetailed(bitmap: Bitmap): PixelChar[][] {
  const pixels = parseBitmap(bitmap);
  if (pixels.length === 0) return [];

  const width = Math.max(...pixels.map(r => r.length));
  const result: PixelChar[][] = [];

  const padded = pixels.map(row => {
    const r = [...row];
    while (r.length < width) r.push(0);
    return r;
  });

  for (let y = 0; y < padded.length; y += 2) {
    const top = padded[y];
    const bottom = y + 1 < padded.length ? padded[y + 1] : new Array(width).fill(0);

    const line: PixelChar[] = [];
    for (let x = 0; x < width; x++) {
      const t = top[x] ? 1 : 0;
      const b = bottom[x] ? 1 : 0;

      let char: string;
      if (t && b) char = FULL;
      else if (t && !b) char = UPPER;
      else if (!t && b) char = LOWER;
      else char = EMPTY;

      line.push({ char, hasTop: !!t, hasBottom: !!b });
    }
    result.push(line);
  }

  return result;
}

// ── Bitmap manipulation ──────────────────────────────────────

/** Flip a bitmap horizontally */
export function flipH(bitmap: BitmapString): BitmapString {
  return bitmap.map(row => [...row].reverse().join(''));
}

/** Overlay bitmap B on top of bitmap A (B's '#' pixels replace A's) */
export function overlay(base: BitmapString, top: BitmapString, offsetX = 0, offsetY = 0): BitmapString {
  const result = base.map(row => [...row]);
  for (let y = 0; y < top.length; y++) {
    const targetY = y + offsetY;
    if (targetY < 0 || targetY >= result.length) continue;
    for (let x = 0; x < top[y].length; x++) {
      const targetX = x + offsetX;
      if (targetX < 0 || targetX >= result[targetY].length) continue;
      if (top[y][x] !== '.' && top[y][x] !== ' ') {
        result[targetY][targetX] = top[y][x];
      }
    }
  }
  return result.map(row => row.join(''));
}

/** Shift a bitmap by N pixels (positive = right/down, wraps with empty) */
export function shift(bitmap: BitmapString, dx: number, dy: number): BitmapString {
  const height = bitmap.length;
  if (height === 0) return bitmap;
  const width = Math.max(...bitmap.map(r => r.length));

  const result: string[] = [];
  for (let y = 0; y < height; y++) {
    const srcY = y - dy;
    if (srcY < 0 || srcY >= height) {
      result.push('.'.repeat(width));
      continue;
    }
    const srcRow = bitmap[srcY];
    let row = '';
    for (let x = 0; x < width; x++) {
      const srcX = x - dx;
      if (srcX < 0 || srcX >= srcRow.length) {
        row += '.';
      } else {
        row += srcRow[srcX];
      }
    }
    result.push(row);
  }
  return result;
}
