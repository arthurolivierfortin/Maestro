/**
 * Maestro Mascotte — Pixel art sprite sheet.
 *
 * The mascotte is a small robot/companion figure (~14x12 pixels).
 * Each state has 1-2 animation frames for smooth transitions.
 *
 * Bitmap format: string[] where '#' = on, '.' = off.
 * Rendered at 2x vertical resolution via Unicode half-blocks.
 *
 * Approx terminal size: 14 chars wide x 6 lines tall.
 */

import type { BitmapString } from '../utils/bitmap.ts';

// ── Idle: relaxed stance, eyes open ─────────────────────────
// Two frames: slight "breathing" sway

export const IDLE_1: BitmapString = [
  //       14 cols
  '....######....',
  '...########...',
  '..##.##.##.#..',
  '..##########..',
  '..##.####.##..',
  '..##########..',
  '....######....',
  '...###..###...',
  '...########...',
  '....##..##....',
  '...##....##...',
  '...##....##...',
];

export const IDLE_2: BitmapString = [
  '....######....',
  '...########...',
  '..##.##.##.#..',
  '..##########..',
  '..##.####.##..',
  '..##########..',
  '....######....',
  '...###..###...',
  '...########...',
  '....##..##....',
  '...##....##...',
  '..##......##..',
];

// ── Working: active pose, one arm raised ────────────────────

export const WORKING_1: BitmapString = [
  '....######....',
  '...########...',
  '..##.##.##.#..',
  '..##########..',
  '..##..##..##..',
  '..##########..',
  '....######....',
  '.####..####...',
  '...########...',
  '....##..##....',
  '...##....##...',
  '...##....##...',
];

export const WORKING_2: BitmapString = [
  '....######....',
  '...########...',
  '..##.##.##.#..',
  '..##########..',
  '..##..##..##..',
  '..##########..',
  '....######....',
  '...####..####.',
  '...########...',
  '....##..##....',
  '....##..##....',
  '...##....##...',
];

// ── Navigating: leaning forward, pointing ───────────────────

export const NAVIGATING_1: BitmapString = [
  '.....######...',
  '....########..',
  '...##.##.##.#.',
  '...##########.',
  '...##.####.##.',
  '...##########.',
  '.....######...',
  '....###..###..',
  '....########.#',
  '.....##..##...',
  '....##....##..',
  '....##....##..',
];

export const NAVIGATING_2: BitmapString = [
  '.....######...',
  '....########..',
  '...##.##.##.#.',
  '...##########.',
  '...##.####.##.',
  '...##########.',
  '.....######...',
  '....###..###..',
  '..#.########..',
  '.....##..##...',
  '....##....##..',
  '....##....##..',
];

// ── Waiting: head tilted, question pose ─────────────────────

export const WAITING_1: BitmapString = [
  '....######....',
  '...########...',
  '..#.##.##.##..',
  '..##########..',
  '..##.####.##..',
  '..##########..',
  '....######....',
  '..###....###..',
  '...########...',
  '....##..##....',
  '....##..##....',
  '...##....##...',
];

export const WAITING_2: BitmapString = [
  '...######.....',
  '..########....',
  '.##.##.##.#...',
  '.##########...',
  '.##.####.##...',
  '.##########...',
  '...######.....',
  '..###....###..',
  '..########....',
  '...##..##.....',
  '...##..##.....',
  '..##....##....',
];

// ── Error: arms up, distressed ──────────────────────────────

export const ERROR_1: BitmapString = [
  '....######....',
  '...########...',
  '..##.##.##.#..',
  '..##########..',
  '..##.#..#.##..',
  '..##########..',
  '....######....',
  '#.####..####.#',
  '...########...',
  '....##..##....',
  '...##....##...',
  '...##....##...',
];

// ── Splash: large logo frame for startup ────────────────────

export const SPLASH: BitmapString = [
  '......########......',
  '....############....',
  '...##############...',
  '..####.####.####.#..',
  '..##################',
  '..####.######.####..',
  '..##################',
  '....############....',
  '...#####..#####.....',
  '...##############...',
  '....####..####......',
  '...####....####.....',
  '...####....####.....',
  '..####......####....',
];

// ── Convenience: state → frame arrays ───────────────────────

export type MascotteState = 'idle' | 'working' | 'navigating' | 'waiting-input' | 'error';

const FRAMES: Record<MascotteState, BitmapString[]> = {
  idle:             [IDLE_1, IDLE_2],
  working:          [WORKING_1, WORKING_2],
  navigating:       [NAVIGATING_1, NAVIGATING_2],
  'waiting-input':  [WAITING_1, WAITING_2],
  error:            [ERROR_1, ERROR_1],
};

/**
 * Get the current animation frame for a given state and tick.
 * Alternates between frames based on tick count.
 */
export function getMascotteFrame(state: MascotteState, tick: number): BitmapString {
  const frames = FRAMES[state] ?? FRAMES.idle;
  return frames[tick % frames.length];
}
