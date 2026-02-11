/**
 * Formatting helpers — pure functions for duration, time, and string formatting.
 */

/**
 * Formats the duration between two timestamps as a human-readable string.
 * If completedAt is null/undefined, uses the current time.
 */
export const formatDuration = (
  startedAt: string | null | undefined,
  completedAt?: string | null | undefined
): string => {
  if (!startedAt) return '-';
  try {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
    if (diffMs < 3600000) {
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  } catch {
    return '-';
  }
};

/**
 * Formats a date as HH:MM:SS (24-hour).
 */
export const formatTime = (date: Date | string | null | undefined): string => {
  try {
    const d = date instanceof Date ? date : new Date(date as string);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
};

/**
 * Truncates a string to a maximum length, adding '...' if truncated.
 */
export const truncate = (str: string | null | undefined, max: number): string => {
  if (!str) return '';
  const s = String(str);
  return s.length > max ? s.substring(0, max - 3) + '...' : s;
};
