'use client';

/**
 * LaneHeader - Header for workflow lanes
 *
 * Displays lane information including:
 * - Lane label (Main Agent or Sub-agent name)
 * - Sub-agent metadata (tokens, duration, tool count)
 */

import { Bot, User } from 'lucide-react';
import type { WorkflowLane } from '@/lib/models/types';

interface LaneHeaderProps {
  lane: WorkflowLane;
  width: number;
  isMain: boolean;
}

/**
 * Format duration for display.
 */
function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format token count.
 */
function formatTokens(tokens?: number): string {
  if (!tokens) return '-';
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}k`;
}

export function LaneHeader({ lane, width, isMain }: LaneHeaderProps) {
  return (
    <div
      className={`
        flex flex-col justify-center px-3 py-2 border-r border-slate-200
        ${isMain ? 'bg-blue-50' : 'bg-purple-50'}
      `}
      style={{ width, minWidth: width }}
    >
      {/* Lane title */}
      <div className="flex items-center gap-2">
        {isMain ? (
          <User className="w-4 h-4 text-blue-600" />
        ) : (
          <Bot className="w-4 h-4 text-purple-600" />
        )}
        <span
          className={`text-sm font-semibold truncate ${
            isMain ? 'text-blue-700' : 'text-purple-700'
          }`}
        >
          {lane.label}
        </span>
      </div>

      {/* Sub-agent metadata */}
      {!isMain && (
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          {lane.totalTokens !== undefined && (
            <span>{formatTokens(lane.totalTokens)} tok</span>
          )}
          {lane.totalDurationMs !== undefined && (
            <span>{formatDuration(lane.totalDurationMs)}</span>
          )}
          {lane.totalToolUseCount !== undefined && (
            <span>{lane.totalToolUseCount} tools</span>
          )}
          {lane.status && (
            <span
              className={`px-1.5 py-0.5 rounded ${
                lane.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {lane.status}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
