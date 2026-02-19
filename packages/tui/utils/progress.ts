/**
 * Progress display helpers — pure functions for progress bars, colors, and sparklines.
 */

/**
 * Returns a block-character progress bar string.
 * @param percent - Progress percentage (0-100)
 * @param width - Character width of the bar
 */
export const progressBar = (percent: number, width: number = 16): string => {
  const p = Math.min(100, Math.max(0, percent));
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
};

/**
 * Returns a color name based on a progress percentage.
 * >=80% = green, >=50% = yellow, <50% = red
 */
export const progressColor = (percent: number): string =>
  percent >= 80 ? 'green' : percent >= 50 ? 'yellow' : 'red';

/**
 * Renders a sparkline (mini bar chart) from numeric values.
 * @param values - Array of numbers
 * @param length - Maximum number of values to display
 */
export const sparkline = (values: number[], length: number = 12): string => {
  const chars = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
  const nums = values.map(v => Number(v) || 0).slice(-length);
  if (nums.length === 0) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return nums
    .map(n => {
      const idx = Math.floor(((n - min) / range) * (chars.length - 1));
      return chars[Math.max(0, Math.min(chars.length - 1, idx))];
    })
    .join('');
};
