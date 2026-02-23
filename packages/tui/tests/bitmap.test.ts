/**
 * Tests for bitmap pixel art renderer.
 */
import { describe, it, expect } from 'vitest';
import {
  parseBitmap, renderBitmap, bitmapSize,
  flipH, overlay, shift,
} from '../utils/bitmap.ts';

describe('parseBitmap', () => {
  it('parses string bitmap to numeric', () => {
    const bitmap = [
      '#.#',
      '.#.',
    ];
    expect(parseBitmap(bitmap)).toEqual([
      [1, 0, 1],
      [0, 1, 0],
    ]);
  });

  it('treats any non-dot/space as on', () => {
    const bitmap = ['#X@.'];
    expect(parseBitmap(bitmap)).toEqual([[1, 1, 1, 0]]);
  });

  it('passes through numeric format', () => {
    const bitmap = [[1, 0], [0, 1]];
    expect(parseBitmap(bitmap)).toEqual([[1, 0], [0, 1]]);
  });

  it('handles empty bitmap', () => {
    expect(parseBitmap([])).toEqual([]);
  });
});

describe('bitmapSize', () => {
  it('returns width and height', () => {
    const bitmap = ['###', '##.', '#..'];
    expect(bitmapSize(bitmap)).toEqual({ width: 3, height: 3 });
  });

  it('handles jagged rows', () => {
    const bitmap = ['#', '####', '##'];
    expect(bitmapSize(bitmap)).toEqual({ width: 4, height: 3 });
  });
});

describe('renderBitmap', () => {
  it('renders 2 pixel rows into 1 terminal line', () => {
    // 2x2 bitmap: all on
    const bitmap = ['##', '##'];
    const lines = renderBitmap(bitmap);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('\u2588\u2588'); // ██
  });

  it('renders upper-half blocks', () => {
    // top on, bottom off
    const bitmap = ['##', '..'];
    const lines = renderBitmap(bitmap);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('\u2580\u2580'); // ▀▀
  });

  it('renders lower-half blocks', () => {
    // top off, bottom on
    const bitmap = ['..', '##'];
    const lines = renderBitmap(bitmap);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('\u2584\u2584'); // ▄▄
  });

  it('renders spaces for empty', () => {
    const bitmap = ['..', '..'];
    const lines = renderBitmap(bitmap);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('  ');
  });

  it('handles odd number of rows (pads with empty)', () => {
    // 3 rows → 2 terminal lines
    const bitmap = ['#', '#', '#'];
    const lines = renderBitmap(bitmap);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('\u2588'); // █ (both on)
    expect(lines[1]).toBe('\u2580'); // ▀ (top on, bottom empty)
  });

  it('renders a simple heart shape', () => {
    const heart = [
      '.#.#.',
      '#####',
      '#####',
      '.###.',
      '..#..',
      '.....',
    ];
    const lines = renderBitmap(heart);
    // 6 pixel rows → 3 terminal lines
    expect(lines).toHaveLength(3);
    // Line 0: top=.#.#. bottom=#####
    // [0]=./# =lower [1]=#/#=full [2]=./#=lower [3]=#/#=full [4]=./#=lower
    expect(lines[0]).toBe('\u2584\u2588\u2584\u2588\u2584');
  });

  it('handles mixed pattern', () => {
    const bitmap = [
      '#.',
      '.#',
    ];
    const lines = renderBitmap(bitmap);
    expect(lines).toHaveLength(1);
    // [0]: top=#, bottom=. → ▀
    // [1]: top=., bottom=# → ▄
    expect(lines[0]).toBe('\u2580\u2584');
  });
});

describe('flipH', () => {
  it('flips horizontally', () => {
    const bitmap = ['#..', '.#.', '..#'];
    expect(flipH(bitmap)).toEqual(['..#', '.#.', '#..']);
  });
});

describe('overlay', () => {
  it('overlays bitmap on base', () => {
    const base = ['....', '....', '....'];
    const top = ['##', '#.'];
    const result = overlay(base, top, 1, 1);
    expect(result).toEqual(['....', '.##.', '.#..']);
  });

  it('does not overwrite with dots', () => {
    const base = ['####', '####'];
    const top = ['#.', '.#'];
    const result = overlay(base, top, 0, 0);
    // Dots in overlay do NOT replace base — only '#' does
    expect(result).toEqual(['####', '####']);
  });
});

describe('shift', () => {
  it('shifts right and down', () => {
    const bitmap = ['#.', '.#'];
    const result = shift(bitmap, 1, 1);
    expect(result).toEqual(['..', '.#']);
  });

  it('shifts left', () => {
    const bitmap = ['.#', '#.'];
    const result = shift(bitmap, -1, 0);
    expect(result).toEqual(['#.', '..']);
  });
});
