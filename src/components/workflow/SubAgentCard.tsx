'use client';

/**
 * SubAgentCard - Collapsed summary card for sub-agent workflows
 *
 * Displays:
 * - Sub-agent type (e.g., "Explore Agent", "Plan Agent")
 * - Prompt preview (first 100 chars)
 * - Duration, token count, tool call count
 * - Status indicator (completed/failed)
 * - Expand button to view full workflow
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Rocket, Clock, Sparkles, Wrench, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SubAgentInfo } from '@/lib/models/types';

interface SubAgentCardData {
  subAgentInfo: SubAgentInfo;
  isHighlighted?: boolean;
  onExpand?: (agentId: string) => void;
}

function SubAgentCardComponent({ data }: NodeProps) {
  const nodeData = data as unknown as SubAgentCardData;
  const subAgentInfo = nodeData.subAgentInfo;
  const isHighlighted = nodeData.isHighlighted;
  const onExpand = nodeData.onExpand;

  if (!subAgentInfo) {
    return (
      <div className="bg-purple-100 border-2 border-purple-300 rounded-xl px-4 py-3">
        <span className="text-purple-700 font-semibold">Sub-Agent</span>
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-purple-500" />
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-purple-500" />
      </div>
    );
  }

  const isCompleted = subAgentInfo.status === 'completed';

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExpand) {
      onExpand(subAgentInfo.agentId);
    }
  };

  return (
    <div
      className={`
        relative rounded-xl shadow-lg overflow-hidden
        transition-all duration-200 cursor-pointer
        border-2
        ${isCompleted
          ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50'
          : 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50'}
        ${isHighlighted ? 'ring-2 ring-purple-400 ring-offset-2' : ''}
        hover:shadow-xl hover:scale-[1.01]
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-200/50">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isCompleted ? 'bg-purple-100' : 'bg-red-100'}`}>
            <Rocket className={`w-4 h-4 ${isCompleted ? 'text-purple-600' : 'text-red-600'}`} />
          </div>
          <span className={`font-semibold ${isCompleted ? 'text-purple-700' : 'text-red-700'}`}>
            {formatAgentType(subAgentInfo.subagentType)}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-slate-500 hover:text-slate-700 border-0 hover:bg-slate-100"
          onClick={handleExpand}
        >
          <span className="text-xs mr-1">View</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Prompt preview */}
      <div className="px-4 py-2">
        <p className="text-sm text-slate-600 line-clamp-2">
          &ldquo;{subAgentInfo.promptPreview}...&rdquo;
        </p>
      </div>

      {/* Metrics footer */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50/50 border-t border-slate-200/50">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDuration(subAgentInfo.totalDurationMs)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{formatTokens(subAgentInfo.totalTokens)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Wrench className="w-3.5 h-3.5" />
          <span>{subAgentInfo.totalToolCalls} tools</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {isCompleted ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-xs font-medium ${isCompleted ? 'text-green-600' : 'text-red-600'}`}>
            {isCompleted ? 'Done' : 'Failed'}
          </span>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
    </div>
  );
}

/**
 * Format agent type for display.
 */
function formatAgentType(type: string): string {
  // Capitalize and add "Agent" suffix if needed
  const formatted = type
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return formatted.includes('Agent') ? formatted : `${formatted} Agent`;
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
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

export const SubAgentCard = memo(SubAgentCardComponent);
