'use client';

/**
 * SessionStartNode - Header node for workflow visualization
 *
 * Replaces global lane headers with a session start node containing:
 * - Agent label
 * - Total duration
 * - Total tokens
 * - Node count
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, Clock, Sparkles, GitBranch } from 'lucide-react';
import type { SessionMetadata } from '@/lib/models/types';

interface SessionStartNodeData {
  sessionMetadata: SessionMetadata;
  isHighlighted?: boolean;
}

function SessionStartNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as SessionStartNodeData;
  const sessionMetadata = nodeData.sessionMetadata;
  const isHighlighted = nodeData.isHighlighted;

  if (!sessionMetadata) {
    return (
      <div className="bg-blue-500 text-white rounded-xl px-5 py-4">
        <span className="font-semibold">Session Start</span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
        />
      </div>
    );
  }

  return (
    <div
      className={`
        relative rounded-xl shadow-lg overflow-hidden
        transition-all duration-200
        ${isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
      `}
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

      {/* Content */}
      <div className="relative px-5 py-4 text-white">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <span className="font-semibold text-lg">
            {sessionMetadata.agentLabel}
          </span>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-5 mt-3 text-sm text-blue-100">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{sessionMetadata.totalDuration}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>{formatTokens(sessionMetadata.totalTokens)} tokens</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" />
            <span>{sessionMetadata.nodeCount} steps</span>
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
      />
    </div>
  );
}

/**
 * Format token count with K/M suffix.
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export const SessionStartNode = memo(SessionStartNodeComponent);
