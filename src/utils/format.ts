/**
 * Formatting utilities
 *
 * Shared formatting functions for duration, tokens, etc.
 */

/**
 * Format duration in milliseconds to human-readable string.
 * Examples: "3.2s", "2.3m", "1.5h"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '-';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds > 0 && minutes < 10) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m`;
  }
  if (seconds > 0) {
    const remainingMs = ms % 1000;
    if (remainingMs > 0 && seconds < 10) {
      return `${seconds}.${Math.floor(remainingMs / 100)}s`;
    }
    return `${seconds}s`;
  }
  return `${ms}ms`;
}

/**
 * Format token count to human-readable string.
 * Examples: "500", "1.5k", "2.3M"
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}
