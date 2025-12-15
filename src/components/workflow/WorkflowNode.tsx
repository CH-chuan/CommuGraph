'use client';

/**
 * WorkflowNode - Node components for workflow visualization
 *
 * Different node types for the Agent Activity View:
 * - User Input: Blue, user icon
 * - Agent Reasoning: Purple, brain icon
 * - Tool Call: Emerald/teal, tool-specific icons
 * - Result Success: Green, with preview and metadata
 * - Result Failure: Red, with error preview
 * - System Notice: Slate, gear icon
 *
 * Enhanced features:
 * - Result nodes show preview of tool output
 * - Sub-agent containers displayed as summary cards
 * - Session start node for workflow header
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  User,
  Brain,
  FileText,
  FolderSearch,
  Terminal,
  Edit3,
  Search,
  Rocket,
  ListTodo,
  HelpCircle,
  CheckCircle,
  XCircle,
  Settings,
  Wrench,
  Clock,
  AlertTriangle,
  Bot,
  Expand,
  Zap,
  Image as ImageIcon,
} from 'lucide-react';
import type { WorkflowNodeType, SubAgentInfo, SessionMetadata } from '@/lib/models/types';
import { formatSubAgentName } from '@/utils/agent-naming';
import { getToolColors, getToolCategory } from '@/utils/tool-colors';

// Node data interface with enhanced fields
export interface WorkflowNodeData {
  id: string;
  stepIndex: number;
  displayStepLabel?: string; // Formatted step label (e.g., "#1" or "sub-773d-1")
  nodeType: WorkflowNodeType;
  label: string;
  contentPreview: string;
  toolName?: string;
  toolInput?: Record<string, unknown>; // Tool call arguments
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  laneId: string;
  isHighlighted?: boolean;

  // Tool result enhancements
  toolResultPreview?: string;
  toolResultStatus?: 'success' | 'failure';
  toolResultStdout?: string;
  toolResultStderr?: string;

  // Sub-agent container fields
  isSubAgentContainer?: boolean;
  subAgentInfo?: SubAgentInfo;

  // Session start fields
  isSessionStart?: boolean;
  sessionMetadata?: SessionMetadata;

  // Parallel execution tracking
  parallelGroupId?: string;
  parallelIndex?: number;
  parallelCount?: number;

  // Callback for sub-agent expansion
  onExpandSubAgent?: (agentId: string) => void;

  // Context compaction fields
  isContextCompact?: boolean;
  compactSummary?: string;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };

  // Image content from user messages
  images?: {
    mediaType: string;
    data: string;
  }[];

  // Callback for opening full-size image
  onImageClick?: (image: { mediaType: string; data: string }) => void;
}

// Tool icon mapping
const getToolIcon = (toolName?: string) => {
  switch (toolName?.toLowerCase()) {
    case 'read':
      return <FileText className="w-4 h-4" />;
    case 'write':
      return <Edit3 className="w-4 h-4" />;
    case 'edit':
      return <Edit3 className="w-4 h-4" />;
    case 'bash':
      return <Terminal className="w-4 h-4" />;
    case 'glob':
      return <FolderSearch className="w-4 h-4" />;
    case 'grep':
      return <Search className="w-4 h-4" />;
    case 'task':
      return <Rocket className="w-4 h-4" />;
    case 'todowrite':
      return <ListTodo className="w-4 h-4" />;
    case 'askuserquestion':
      return <HelpCircle className="w-4 h-4" />;
    default:
      return <Wrench className="w-4 h-4" />;
  }
};

// Node type configurations
const nodeTypeConfig: Record<
  string,
  {
    icon: React.ReactNode;
    bgColor: string;
    borderColor: string;
    textColor: string;
    headerBg?: string;
  }
> = {
  user_input: {
    icon: <User className="w-4 h-4" />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-700',
  },
  user_input_image: {
    icon: <ImageIcon className="w-4 h-4" />,
    bgColor: 'bg-sky-100',
    borderColor: 'border-sky-500',
    textColor: 'text-sky-700',
  },
  agent_reasoning: {
    icon: <Brain className="w-4 h-4" />,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-400',
    textColor: 'text-purple-700',
  },
  tool_call: {
    icon: <Wrench className="w-4 h-4" />,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-400',
    textColor: 'text-emerald-700',
  },
  tool_result: {
    icon: <CheckCircle className="w-4 h-4" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-400',
    textColor: 'text-green-700',
  },
  result_success: {
    icon: <CheckCircle className="w-4 h-4" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-400',
    textColor: 'text-green-700',
    headerBg: 'bg-green-100',
  },
  result_failure: {
    icon: <XCircle className="w-4 h-4" />,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-400',
    textColor: 'text-red-700',
    headerBg: 'bg-red-100',
  },
  system_notice: {
    icon: <Settings className="w-4 h-4" />,
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-400',
    textColor: 'text-slate-700',
  },
};

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms?: number): string | null {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format tokens in human-readable format.
 */
function formatTokens(tokens?: number): string {
  if (!tokens) return '0';
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}k`;
}

/**
 * Sub-Agent Tool Call Component - Task tool call with sub-agent info inline
 *
 * Renders like a regular tool call card but with purple theme and sub-agent
 * metadata (type, prompt preview, metrics). Includes "Open" button to expand
 * sub-agent workflow in modal.
 */
function SubAgentToolCallComponent({ data, selected }: { data: WorkflowNodeData; selected?: boolean }) {
  const nodeData = data;
  const { subAgentInfo } = nodeData;

  if (!subAgentInfo) {
    // Fallback to regular tool call rendering - shouldn't happen
    return null;
  }

  const handleExpand = () => {
    if (nodeData.onExpandSubAgent && subAgentInfo.agentId) {
      nodeData.onExpandSubAgent(subAgentInfo.agentId);
    }
  };

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md border-2 border-purple-400 min-w-[240px] max-w-[300px]
        ${selected ? 'ring-2 ring-offset-1 ring-purple-500 shadow-lg' : ''}
        ${nodeData.isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white"
      />

      {/* Header - tool call style but purple theme */}
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 rounded-t-md">
        <Rocket className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-semibold text-purple-700">
          call-sub-agent
        </span>
        <span className="ml-auto text-xs text-slate-400">{nodeData.displayStepLabel || `#${nodeData.stepIndex}`}</span>
      </div>

      {/* Sub-agent type with ID */}
      <div className="px-3 py-2 border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-700">
              {formatSubAgentName(subAgentInfo.subagentType || 'Agent', subAgentInfo.agentId)}
            </span>
          </div>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors border border-purple-200"
            onClick={(e) => {
              e.stopPropagation();
              handleExpand();
            }}
          >
            <Expand className="w-3 h-3" />
            Open
          </button>
        </div>
        {/* Prompt preview */}
        <p className="mt-1 text-xs text-slate-500 line-clamp-2 italic">
          &quot;{subAgentInfo.promptPreview}&quot;
        </p>
      </div>

      {/* Metrics Row */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-purple-50/50 rounded-b-md text-xs">
        <span className="flex items-center gap-1 text-slate-500">
          <Clock className="w-3 h-3 text-purple-400" />
          {formatDuration(subAgentInfo.totalDurationMs) || '-'}
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <Zap className="w-3 h-3 text-purple-400" />
          {formatTokens(subAgentInfo.totalTokens)}
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <Wrench className="w-3 h-3 text-purple-400" />
          {subAgentInfo.totalToolCalls}
        </span>
        <span className={`ml-auto flex items-center gap-1 font-medium ${
          subAgentInfo.status === 'completed' ? 'text-green-600' : 'text-red-600'
        }`}>
          {subAgentInfo.status === 'completed' ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <XCircle className="w-3 h-3" />
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Result Node Component - Enhanced with preview
 */
function ResultNodeComponent({ data, selected }: { data: WorkflowNodeData; selected?: boolean }) {
  const nodeData = data;
  const isSuccess = nodeData.nodeType === 'result_success' || nodeData.toolResultStatus === 'success';
  const config = isSuccess ? nodeTypeConfig.result_success : nodeTypeConfig.result_failure;

  // Get preview content (prefer stdout for Bash, then general preview)
  const previewContent = nodeData.toolResultStdout || nodeData.toolResultPreview || nodeData.contentPreview;
  const errorContent = nodeData.toolResultStderr;

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md border-2 min-w-[200px] max-w-[280px]
        ${config.borderColor}
        ${selected ? 'ring-2 ring-offset-1 ring-blue-400 shadow-lg' : ''}
        ${nodeData.isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white"
      />

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${config.headerBg || config.bgColor} rounded-t-md`}>
        <span className={config.textColor}>{config.icon}</span>
        <span className={`text-sm font-semibold ${config.textColor}`}>
          {nodeData.toolName ? `${nodeData.toolName} Result` : nodeData.label}
        </span>
        {nodeData.durationMs !== undefined && (
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {formatDuration(nodeData.durationMs)}
          </span>
        )}
      </div>

      {/* Preview Content */}
      <div className="px-3 py-2">
        {previewContent && (
          <pre className="text-xs bg-slate-100 p-2 rounded font-mono text-slate-700 max-h-16 overflow-hidden whitespace-pre-wrap break-all">
            {previewContent}
          </pre>
        )}
        {errorContent && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <pre className="font-mono whitespace-pre-wrap break-all max-h-12 overflow-hidden">
              {errorContent}
            </pre>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="px-3 py-1.5 border-t border-slate-100 text-xs text-slate-400">
        Step {nodeData.displayStepLabel || `#${nodeData.stepIndex}`}
      </div>
    </div>
  );
}

/**
 * Workflow Node Component - Main component with routing
 */
function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;

  // Route to result node for result types
  if (nodeData.nodeType === 'result_success' || nodeData.nodeType === 'result_failure') {
    return <ResultNodeComponent data={nodeData} selected={selected} />;
  }

  // Special rendering for context compact nodes
  if (nodeData.nodeType === 'system_notice' && nodeData.isContextCompact) {
    return (
      <div
        className={`
          bg-white rounded-lg shadow-md border-2 border-slate-400 min-w-[200px] max-w-[280px]
          ${selected ? 'ring-2 ring-offset-1 ring-blue-400 shadow-lg' : ''}
          ${nodeData.isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
        `}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-slate-400 !w-2 !h-2"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-slate-400 !w-2 !h-2"
        />

        {/* Header with grey styling */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-t-md">
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-600">
            Context Compact
          </span>
        </div>

        {/* Compact info */}
        <div className="px-3 py-2">
          {nodeData.compactMetadata?.preTokens && (
            <p className="text-xs text-slate-500">
              Tokens: {nodeData.compactMetadata.preTokens.toLocaleString()}
            </p>
          )}
          {nodeData.compactMetadata?.trigger && (
            <p className="text-xs text-slate-500">
              Trigger: {nodeData.compactMetadata.trigger}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Special rendering for Task tool calls (sub-agent calls)
  if (nodeData.nodeType === 'tool_call' && nodeData.isSubAgentContainer && nodeData.subAgentInfo) {
    return <SubAgentToolCallComponent data={nodeData} selected={selected} />;
  }

  // Use sky colors for user_input with images
  const hasImages = nodeData.images && nodeData.images.length > 0;
  const nodeTypeKey = nodeData.nodeType === 'user_input' && hasImages
    ? 'user_input_image'
    : nodeData.nodeType;

  // For tool_call, use semantic tool colors (indigo for sub-agent, cyan for web, etc.)
  let config: { icon: React.ReactNode; bgColor: string; borderColor: string; textColor: string; headerBg?: string };
  if (nodeData.nodeType === 'tool_call') {
    const toolColors = getToolColors(nodeData.toolName);
    config = {
      icon: nodeTypeConfig.tool_call.icon,
      bgColor: toolColors.bg,
      borderColor: toolColors.border,
      textColor: toolColors.text,
      headerBg: toolColors.headerBg,
    };
  } else {
    config = nodeTypeConfig[nodeTypeKey] || nodeTypeConfig.system_notice;
  }

  // Use tool-specific icon for tool calls
  const icon =
    nodeData.nodeType === 'tool_call'
      ? getToolIcon(nodeData.toolName)
      : config.icon;

  // Determine node size based on type
  const isCompact = nodeData.nodeType === 'tool_result';

  if (isCompact) {
    // Compact node for tool results (legacy)
    return (
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-full border-2
          ${config.bgColor} ${config.borderColor}
          ${selected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}
          ${nodeData.isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
        `}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-slate-400 !w-2 !h-2"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-slate-400 !w-2 !h-2"
        />

        <span className={config.textColor}>{icon}</span>
        <span className={`text-xs font-medium ${config.textColor}`}>
          {nodeData.label}
        </span>
        {nodeData.durationMs !== undefined && (
          <span className="text-xs text-slate-500">
            {formatDuration(nodeData.durationMs)}
          </span>
        )}
      </div>
    );
  }

  // Full node for reasoning, tool calls, user input
  return (
    <div
      className={`
        bg-white rounded-lg shadow-md border-2 min-w-[200px] max-w-[280px]
        ${config.borderColor}
        ${selected ? 'ring-2 ring-offset-1 ring-blue-400 shadow-lg' : ''}
        ${nodeData.isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white"
      />

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${config.bgColor} rounded-t-md`}>
        <span className={config.textColor}>{icon}</span>
        <span className={`text-sm font-semibold ${config.textColor} truncate`}>
          {nodeData.toolName || nodeData.label}
        </span>
        <span className="ml-auto text-xs text-slate-400">{nodeData.displayStepLabel || `#${nodeData.stepIndex}`}</span>
      </div>

      {/* Content Preview */}
      <div className="px-3 py-2">
        {/* Image thumbnails - render before text */}
        {nodeData.images && nodeData.images.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {nodeData.images.map((img, imgIdx) => (
              <img
                key={imgIdx}
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={`Image ${imgIdx + 1}`}
                className="max-h-12 max-w-16 rounded border border-slate-200 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  nodeData.onImageClick?.(img);
                }}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-slate-600 line-clamp-2">
          {nodeData.contentPreview}
        </p>
      </div>

      {/* Parallel indicator */}
      {nodeData.parallelGroupId && nodeData.parallelCount && nodeData.parallelCount > 1 && (
        <div className="px-3 py-1 bg-amber-50 text-xs text-amber-700 border-t border-amber-100">
          Parallel {(nodeData.parallelIndex ?? 0) + 1}/{nodeData.parallelCount}
        </div>
      )}

      {/* Footer with metrics */}
      {(nodeData.inputTokens || nodeData.outputTokens || nodeData.durationMs) && (
        <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-500">
          {nodeData.durationMs !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(nodeData.durationMs)}
            </span>
          )}
          {nodeData.outputTokens && (
            <span>
              {nodeData.outputTokens} output tokens
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);

// Export node types for React Flow
export const workflowNodeTypes = {
  workflow: WorkflowNode,
};
