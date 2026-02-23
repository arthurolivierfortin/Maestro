/**
 * Tests for mascotte pixel art sprites.
 */
import { describe, it, expect } from 'vitest';
import { renderBitmap, bitmapSize } from '../utils/bitmap.ts';
import {
  IDLE_1, IDLE_2, WORKING_1, WORKING_2,
  NAVIGATING_1, NAVIGATING_2, WAITING_1, WAITING_2,
  ERROR_1, ERROR_2, SPLASH,
  getMascotteFrame,
} from '../sprites/mascotte.ts';

const CHAR_SPRITES = {
  IDLE_1, IDLE_2, WORKING_1, WORKING_2,
  NAVIGATING_1, NAVIGATING_2, WAITING_1, WAITING_2,
  ERROR_1, ERROR_2,
};

const ALL_SPRITES = { ...CHAR_SPRITES, SPLASH };

describe('mascotte sprites', () => {
  it('all sprites have consistent row widths', () => {
    for (const [name, sprite] of Object.entries(ALL_SPRITES)) {
      const widths = sprite.map(row => row.length);
      const maxW = Math.max(...widths);
      for (let i = 0; i < widths.length; i++) {
        expect(widths[i], `${name} row ${i} should be ${maxW} wide`).toBe(maxW);
      }
    }
  });

  it('character sprites are 24x22', () => {
    for (const [name, sprite] of Object.entries(CHAR_SPRITES)) {
      const size = bitmapSize(sprite);
      expect(size.height, `${name} height`).toBe(22);
      expect(size.width, `${name} width`).toBe(24);
    }
  });

  it('splash sprite is 32x28', () => {
    const size = bitmapSize(SPLASH);
    expect(size.height).toBe(28);
    expect(size.width).toBe(32);
  });

  it('all sprites render to terminal lines', () => {
    for (const [name, sprite] of Object.entries(ALL_SPRITES)) {
      const lines = renderBitmap(sprite);
      expect(lines.length, `${name} should produce terminal lines`).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.length, `${name} lines should have content`).toBeGreaterThan(0);
      }
    }
  });

  it('character sprites render to 11 terminal lines', () => {
    // 22 pixel rows / 2 = 11 terminal lines
    const lines = renderBitmap(IDLE_1);
    expect(lines).toHaveLength(11);
  });

  it('splash renders to 14 terminal lines', () => {
    // 28 pixel rows / 2 = 14 terminal lines
    const lines = renderBitmap(SPLASH);
    expect(lines).toHaveLength(14);
  });

  it('getMascotteFrame alternates frames', () => {
    const frame0 = getMascotteFrame('idle', 0);
    const frame1 = getMascotteFrame('idle', 1);
    const frame2 = getMascotteFrame('idle', 2);

    expect(frame0).toBe(IDLE_1);
    expect(frame1).toBe(IDLE_2);
    expect(frame2).toBe(IDLE_1); // wraps
  });

  it('getMascotteFrame handles all states', () => {
    const states = ['idle', 'working', 'navigating', 'waiting-input', 'error'] as const;
    for (const state of states) {
      const frame = getMascotteFrame(state, 0);
      expect(frame, `${state} should return a frame`).toBeDefined();
      expect(frame.length, `${state} should have rows`).toBeGreaterThan(0);
    }
  });

  it('all character sprites share the same visor face (rows 1-9)', () => {
    // The head/visor is constant across all states — identity is preserved
    const reference = IDLE_1.slice(1, 10);
    for (const [name, sprite] of Object.entries(CHAR_SPRITES)) {
      const head = sprite.slice(1, 10);
      expect(head, `${name} head should match IDLE_1`).toEqual(reference);
    }
  });
});
