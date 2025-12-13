'use client';

/**
 * TimeAxis - Vertical time ruler for workflow visualization
 *
 * Features:
 * - Displays timestamps relative to session start
 * - Tick marks at regular intervals
 * - Click to jump to specific time
 * - Current step indicator
 */

import { useMemo } from 'react';

interface TimeAxisProps {
  startTime: string;
  endTime: string;
  currentStep: number | null;
  totalSteps: number;
  height: number;
  onTimeClick?: (timestamp: string) => void;
}

/**
 * Format time offset for display.
 */
function formatTimeOffset(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  if (minutes > 0) {
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

export function TimeAxis({
  startTime,
  endTime,
  currentStep,
  totalSteps,
  height,
  onTimeClick,
}: TimeAxisProps) {
  const startMs = useMemo(() => new Date(startTime).getTime(), [startTime]);
  const endMs = useMemo(() => new Date(endTime).getTime(), [endTime]);
  const totalDuration = endMs - startMs;

  // Generate tick marks
  const ticks = useMemo(() => {
    const tickCount = Math.min(20, Math.max(5, Math.floor(height / 80)));
    const tickInterval = totalDuration / tickCount;

    const result: Array<{ offsetMs: number; y: number; label: string }> = [];

    for (let i = 0; i <= tickCount; i++) {
      const offsetMs = i * tickInterval;
      const y = (offsetMs / totalDuration) * height;
      result.push({
        offsetMs,
        y,
        label: formatTimeOffset(offsetMs),
      });
    }

    return result;
  }, [totalDuration, height]);

  // Current step position (approximate)
  const currentY =
    currentStep !== null && totalSteps > 0
      ? (currentStep / totalSteps) * height
      : null;

  return (
    <div
      className="relative bg-slate-50 border-r border-slate-200"
      style={{ width: 60, height }}
    >
      {/* Tick marks and labels */}
      {ticks.map((tick, idx) => (
        <div
          key={idx}
          className="absolute flex items-center cursor-pointer hover:bg-slate-100 transition-colors"
          style={{ top: tick.y, left: 0, right: 0, height: 20, marginTop: -10 }}
          onClick={() => {
            if (onTimeClick) {
              const timestamp = new Date(startMs + tick.offsetMs).toISOString();
              onTimeClick(timestamp);
            }
          }}
        >
          {/* Tick line */}
          <div className="w-2 h-px bg-slate-300" />
          {/* Label */}
          <span className="ml-1 text-xs text-slate-500 font-mono">
            {tick.label}
          </span>
        </div>
      ))}

      {/* Current step indicator */}
      {currentY !== null && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-blue-500 z-10"
          style={{ top: currentY }}
        >
          {/* Indicator dot */}
          <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
        </div>
      )}

      {/* Vertical line */}
      <div className="absolute top-0 bottom-0 right-0 w-px bg-slate-300" />
    </div>
  );
}
