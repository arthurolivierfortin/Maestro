/**
 * Tests for mascotte pixel art sprites.
 */
import { describe, it, expect } from 'vitest';
import { renderBitmap, bitmapSize } from '../utils/bitmap.ts';
import {
  IDLE_1, IDLE_2, WORKING_1, WORKING_2,
  NAVIGATING_1, NAVIGATING_2, WAITING_1, WAITING_2,
  ERROR_1, SPLASH,
  getMascotteFrame,
} from '../sprites/mascotte.ts';

const ALL_SPRITES = {
  IDLE_1, IDLE_2, WORKING_1, WORKING_2,
  NAVIGATING_1, NAVIGATING_2, WAITING_1, WAITING_2,
  ERROR_1, SPLASH,
};

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

  it('character sprites are 14x12', () => {
    const charSprites = [IDLE_1, IDLE_2, WORKING_1, WORKING_2, NAVIGATING_1, NAVIGATING_2, WAITING_1, WAITING_2, ERROR_1];
    for (const sprite of charSprites) {
      const size = bitmapSize(sprite);
      expect(size.height).toBe(12);
      expect(size.width).toBe(14);
    }
  });

  it('splash sprite is 20x14', () => {
    const size = bitmapSize(SPLASH);
    expect(size.height).toBe(14);
    expect(size.width).toBe(20);
  });

  it('all sprites render to terminal lines', () => {
    for (const [name, sprite] of Object.entries(ALL_SPRITES)) {
      const lines = renderBitmap(sprite);
      expect(lines.length, `${name} should produce terminal lines`).toBeGreaterThan(0);
      // Each line should be non-empty
      for (const line of lines) {
        expect(line.length, `${name} lines should have content`).toBeGreaterThan(0);
      }
    }
  });

  it('character sprites render to 6 terminal lines', () => {
    // 12 pixel rows / 2 = 6 terminal lines
    const lines = renderBitmap(IDLE_1);
    expect(lines).toHaveLength(6);
  });

  it('splash renders to 7 terminal lines', () => {
    // 14 pixel rows / 2 = 7 terminal lines
    const lines = renderBitmap(SPLASH);
    expect(lines).toHaveLength(7);
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
});
