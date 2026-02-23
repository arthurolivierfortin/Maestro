/**
 * Animation Helpers — Frame sequences and tick-based selectors for TUI animations.
 *
 * Use with useAnimationTick() to animate spinner, breathing dots, activity bars.
 */

/** Spinner frames for loading/connecting states */
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** Breathing dot frames — pulses between bright and dim */
export const BREATHING_DOTS = ['●', '●', '●', '◉', '○', '◉', '●', '●'];

/** Activity bar frames */
export const ACTIVITY_FRAMES = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█', '▉', '▊', '▋', '▌', '▍', '▎', '▏'];

/** Get spinner frame based on tick count */
export const spinnerFrame = (tick: number): string =>
  SPINNER_FRAMES[tick % SPINNER_FRAMES.length];

/** Get breathing dot frame based on tick count */
export const breathingDot = (tick: number): string =>
  BREATHING_DOTS[tick % BREATHING_DOTS.length];

/** Get activity bar frame */
export const activityFrame = (tick: number): string =>
  ACTIVITY_FRAMES[tick % ACTIVITY_FRAMES.length];
