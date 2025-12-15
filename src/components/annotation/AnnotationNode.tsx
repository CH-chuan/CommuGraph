'use client';

/**
 * AnnotationNode - Node components for annotation visualization
 *
 * Two node types based on annotation unit_type:
 * - user_turn: Blue theme, user icon, shows prompt text
 * - assistant_turn: Purple theme, shows thinking/text/tool_calls
 *
 * Each node has label slots (empty initially, filled during annotation)
 */

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  User,
  Brain,
  ChevronDown,
  ChevronRight,
  Wrench,
  Tag,
  Clock,
  Settings,
  Image as ImageIcon,
} from 'lucide-react';
import type { AnnotationRecord, LabelRecord } from '@/lib/annotation/types';

// Node data interface for React Flow
export interface AnnotationNodeData {
  record: AnnotationRecord;
  sequenceIndex: number;
  isHighlighted?: boolean;
  // Callback for opening full-size image
  onImageClick?: (image: { mediaType: string; data: string }) => void;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp?: string): string | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * User Turn Node Component
 */
function UserTurnNode({ data, selected }: { data: AnnotationNodeData; selected?: boolean }) {
  const { record, sequenceIndex, isHighlighted, onImageClick } = data;
  const text = record.text_or_artifact_ref?.text || '';
  const images = record.text_or_artifact_ref?.images;

  // Use sky colors for user input with images
  const hasImages = images && images.length > 0;

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md border-2 min-w-[280px] max-w-[400px]
        ${hasImages ? 'border-sky-500' : 'border-blue-400'}
        ${selected ? `ring-2 ring-offset-1 shadow-lg ${hasImages ? 'ring-sky-500' : 'ring-blue-500'}` : ''}
        ${isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`!w-3 !h-3 !border-2 !border-white ${hasImages ? '!bg-sky-500' : '!bg-blue-500'}`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`!w-3 !h-3 !border-2 !border-white ${hasImages ? '!bg-sky-500' : '!bg-blue-500'}`}
      />

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-md ${hasImages ? 'bg-sky-200' : 'bg-blue-100'}`}>
        {hasImages ? (
          <ImageIcon className="w-4 h-4 text-sky-600" />
        ) : (
          <User className="w-4 h-4 text-blue-600" />
        )}
        <span className={`text-sm font-semibold ${hasImages ? 'text-sky-700' : 'text-blue-700'}`}>User Prompt</span>
        <span className="ml-auto text-xs text-slate-500">#{sequenceIndex}</span>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {/* Image thumbnails - render before text */}
        {hasImages && (
          <div className="flex flex-wrap gap-1 mb-2">
            {images.map((img, imgIdx) => (
              <img
                key={imgIdx}
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`Image ${imgIdx + 1}`}
                className="max-h-12 max-w-16 rounded border border-slate-200 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageClick?.(img);
                }}
              />
            ))}
          </div>
        )}
        <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">
          {truncateText(text, 300)}
        </p>
      </div>

      {/* Timestamp */}
      {record.timestamp && (
        <div className="px-3 py-1 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatTimestamp(record.timestamp)}
        </div>
      )}

      {/* Label Slot */}
      <LabelSlot labels={record.labels} />
    </div>
  );
}

/**
 * Format system subtype for display (e.g., "api_error" -> "API Error")
 */
function formatSystemSubtype(subtype?: string): string {
  if (!subtype) return 'System Notice';
  // Convert snake_case to Title Case
  return subtype
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * System Turn Node Component (for context compaction and other system messages)
 */
function SystemTurnNode({ data, selected }: { data: AnnotationNodeData; selected?: boolean }) {
  const { record, sequenceIndex, isHighlighted } = data;
  const text = record.text_or_artifact_ref?.text || 'System event';
  const compactMetadata = record.compact_metadata;
  const isCompactBoundary = compactMetadata !== undefined;
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine display label based on whether this is compact_boundary or another system message
  const displayLabel = isCompactBoundary
    ? 'Context Compact'
    : formatSystemSubtype(record.system_subtype);

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md border-2 border-slate-400 min-w-[280px] max-w-[400px]
        ${selected ? 'ring-2 ring-offset-1 ring-slate-500 shadow-lg' : ''}
        ${isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-t-md">
        <Settings className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-700">{displayLabel}</span>
        {compactMetadata?.preTokens && (
          <span className="text-xs text-slate-500">
            {compactMetadata.preTokens.toLocaleString()} tokens
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">#{sequenceIndex}</span>
        {/* Only show expand button if there's content to show */}
        {(isCompactBoundary || text.length > 50) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-slate-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
        )}
      </div>

      {/* Content preview for non-compact system messages */}
      {!isCompactBoundary && !isExpanded && text.length <= 50 && (
        <div className="px-3 py-2">
          <p className="text-sm text-slate-600">
            {text}
          </p>
        </div>
      )}

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-3 py-2 max-h-48 overflow-y-auto border-t border-slate-200">
          <p className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
            {text}
          </p>
        </div>
      )}

      {/* Timestamp */}
      {record.timestamp && (
        <div className="px-3 py-1 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatTimestamp(record.timestamp)}
        </div>
      )}

      {/* Label Slot */}
      <LabelSlot labels={record.labels} />
    </div>
  );
}

/**
 * Assistant Turn Node Component
 */
function AssistantTurnNode({ data, selected }: { data: AnnotationNodeData; selected?: boolean }) {
  const { record, sequenceIndex, isHighlighted } = data;
  const { text_or_artifact_ref, tool_summary } = record;

  const [showThinking, setShowThinking] = useState(false);
  const [showToolCalls, setShowToolCalls] = useState(false);

  const hasThinking = !!text_or_artifact_ref?.thinking;
  const hasText = !!text_or_artifact_ref?.text;
  const hasToolCalls = text_or_artifact_ref?.tool_calls && text_or_artifact_ref.tool_calls.length > 0;

  // Check if this turn calls a sub-agent (Task tool) - use indigo (deeper purple)
  const hasSubAgentCall = text_or_artifact_ref?.tool_calls?.some(
    tc => tc.tool_name.toLowerCase() === 'task'
  ) ?? false;

  // When expanded (thinking or tool calls), elevate z-index to appear on top
  const isExpanded = showThinking || showToolCalls;

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md border-2 min-w-[280px] max-w-[450px]
        ${hasSubAgentCall ? 'border-purple-500' : 'border-purple-400'}
        ${selected ? `ring-2 ring-offset-1 shadow-lg ${hasSubAgentCall ? 'ring-purple-600' : 'ring-purple-500'}` : ''}
        ${isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
        ${isExpanded ? 'shadow-xl' : ''}
      `}
      style={{ zIndex: isExpanded ? 100 : 1 }}
    >
      {/* Vertical edges (top/bottom) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`!w-3 !h-3 !border-2 !border-white ${hasSubAgentCall ? '!bg-purple-600' : '!bg-purple-500'}`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`!w-3 !h-3 !border-2 !border-white ${hasSubAgentCall ? '!bg-purple-600' : '!bg-purple-500'}`}
      />
      {/* Horizontal edges (left/right) for consecutive assistant turns */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`!w-2.5 !h-2.5 !border-2 !border-white ${hasSubAgentCall ? '!bg-purple-500' : '!bg-purple-400'}`}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`!w-2.5 !h-2.5 !border-2 !border-white ${hasSubAgentCall ? '!bg-purple-500' : '!bg-purple-400'}`}
      />

      {/* Header - includes tool names if present */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-md ${hasSubAgentCall ? 'bg-purple-200' : 'bg-purple-100'}`}>
        <Brain className={`w-4 h-4 flex-shrink-0 ${hasSubAgentCall ? 'text-purple-700' : 'text-purple-600'}`} />
        <span className={`text-sm font-semibold truncate ${hasSubAgentCall ? 'text-purple-800' : 'text-purple-700'}`}>
          {hasToolCalls
            ? `Assistant Turn - ${text_or_artifact_ref.tool_calls!.map(tc => tc.tool_name).join(', ')}`
            : 'Assistant Turn'}
        </span>
        <span className="ml-auto text-xs text-slate-500 flex-shrink-0">#{sequenceIndex}</span>
      </div>

      {/* Thinking Block (collapsible) */}
      {hasThinking && (
        <div className="border-b border-slate-100">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-slate-600 hover:bg-slate-50"
          >
            {showThinking ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span className="font-medium">Thinking</span>
            <span className="text-slate-400">({text_or_artifact_ref.thinking!.length} chars)</span>
          </button>
          {showThinking && (
            <div className="px-3 py-2 bg-slate-50 max-h-40 overflow-y-auto">
              <p className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
                {truncateText(text_or_artifact_ref.thinking!, 800)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Text Content */}
      {hasText && (
        <div className="px-3 py-2">
          <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">
            {truncateText(text_or_artifact_ref.text!, 400)}
          </p>
        </div>
      )}

      {/* Tool Calls (collapsible) */}
      {hasToolCalls && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowToolCalls(!showToolCalls)}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-emerald-600 hover:bg-slate-50"
          >
            {showToolCalls ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Wrench className="w-3 h-3" />
            <span className="font-medium">
              {text_or_artifact_ref.tool_calls!.length} Tool Call{text_or_artifact_ref.tool_calls!.length > 1 ? 's' : ''}
            </span>
          </button>
          {showToolCalls && (
            <div className="px-3 py-2 bg-emerald-50 space-y-2 max-h-60 overflow-y-auto">
              {text_or_artifact_ref.tool_calls!.map((tool, idx) => (
                <div key={tool.tool_use_id || idx} className="text-xs">
                  <div className="flex items-center gap-2 font-medium text-emerald-700">
                    <span>{tool.tool_name}</span>
                    {tool_summary?.tool_calls?.find(tc => tc.tool_use_id === tool.tool_use_id)?.is_error && (
                      <span className="text-red-500">(error)</span>
                    )}
                  </div>
                  <pre className="mt-1 p-1 bg-white rounded text-slate-600 overflow-x-auto max-h-24 overflow-y-auto">
                    {JSON.stringify(tool.input, null, 2).slice(0, 500)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Summary Stats */}
      {tool_summary && tool_summary.tool_calls.length > 0 && !showToolCalls && (
        <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Wrench className="w-3 h-3 text-emerald-500" />
            {tool_summary.tool_calls.length} tools
          </span>
          <span className="text-green-600">
            {tool_summary.tool_calls.filter(t => t.success).length} success
          </span>
          {tool_summary.tool_calls.some(t => t.is_error) && (
            <span className="text-red-600">
              {tool_summary.tool_calls.filter(t => t.is_error).length} error
            </span>
          )}
        </div>
      )}

      {/* Timestamp */}
      {record.timestamp && (
        <div className="px-3 py-1 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatTimestamp(record.timestamp)}
        </div>
      )}

      {/* Label Slot */}
      <LabelSlot labels={record.labels} />
    </div>
  );
}

/**
 * Label Slot Component - Shows annotation labels
 */
function LabelSlot({ labels }: { labels: LabelRecord[] }) {
  if (!labels || labels.length === 0) {
    return (
      <div className="px-3 py-2 bg-slate-50 rounded-b-md border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Tag className="w-3 h-3" />
          <span>No labels (click to annotate)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 bg-slate-50 rounded-b-md border-t border-slate-100">
      <div className="flex flex-wrap gap-1">
        {labels.map((label, idx) => (
          <span
            key={`${label.id}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
          >
            <Tag className="w-3 h-3" />
            {label.id}
            {label.confidence !== undefined && (
              <span className="text-indigo-400">({Math.round(label.confidence * 100)}%)</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Main Annotation Node Component - Routes to correct sub-component
 */
function AnnotationNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AnnotationNodeData;
  const { record } = nodeData;

  if (record.unit_type === 'user_turn') {
    return <UserTurnNode data={nodeData} selected={selected} />;
  }

  if (record.unit_type === 'system_turn') {
    return <SystemTurnNode data={nodeData} selected={selected} />;
  }

  return <AssistantTurnNode data={nodeData} selected={selected} />;
}

export const AnnotationNode = memo(AnnotationNodeComponent);

// Export node types for React Flow
export const annotationNodeTypes = {
  annotation: AnnotationNode,
};
