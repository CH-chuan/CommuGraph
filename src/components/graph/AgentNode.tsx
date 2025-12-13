'use client';

/**
 * AgentNode - Rich Card Node Component for Topology Mode
 *
 * Design spec: Rectangular card with rounded corners (8px)
 * - Icon: Top-left (role anchor)
 * - Name: Bold text
 * - Status Pill: Current state
 * - Tool Drawer: Slides out for internal tool usage
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User, Bot, Cpu, Cog, MessageSquare } from 'lucide-react';

// Agent status types
export type AgentStatus = 'idle' | 'generating' | 'waiting' | 'tool_use';

// Props for the agent node data
export interface AgentNodeData {
  label: string;
  message_count: number; // Deprecated, use messages_sent
  messages_sent: number;
  messages_received: number;
  status?: AgentStatus;
  role?: string;
  activeTool?: string | null;
  isHighlighted?: boolean;
  color?: string;
}

// Icon mapping based on role/name
const getRoleIcon = (label: string, role?: string) => {
  const lowerLabel = (role || label).toLowerCase();
  if (lowerLabel.includes('manager') || lowerLabel.includes('coordinator')) {
    return <User className="w-5 h-5" />;
  }
  if (lowerLabel.includes('coder') || lowerLabel.includes('engineer')) {
    return <Cpu className="w-5 h-5" />;
  }
  if (lowerLabel.includes('assistant') || lowerLabel.includes('agent')) {
    return <Bot className="w-5 h-5" />;
  }
  return <MessageSquare className="w-5 h-5" />;
};

// Status pill colors
const statusColors: Record<
  AgentStatus,
  { bg: string; text: string; dot: string }
> = {
  idle: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  generating: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  waiting: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  tool_use: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
};

function AgentNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;
  const status: AgentStatus = nodeData.status || 'idle';
  const statusStyle = statusColors[status];
  const agentColor = nodeData.color || '#64748b';

  return (
    <div
      className={`
        relative bg-white rounded-lg shadow-md border-2 transition-all duration-200
        min-w-[160px] max-w-[200px]
        ${selected ? 'shadow-lg' : ''}
        ${nodeData.isHighlighted ? 'ring-2 ring-offset-2' : ''}
      `}
      style={{
        borderColor: selected ? agentColor : '#e2e8f0',
        ...(nodeData.isHighlighted && { ringColor: agentColor }),
      }}
    >
      {/* Connection Handles */}

      {/* LEFT SIDE */}
      {/* Target (Inputs) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-slate-400 border-2 border-white"
        style={{ top: '30%' }}
      />
      {/* Source (Back-edge Outputs) */}
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="w-3 h-3 !bg-slate-400 border-2 border-white"
        style={{ top: '70%' }}
      />

      {/* RIGHT SIDE */}
      {/* Source (Outputs) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-slate-400 border-2 border-white"
      />

      {/* TOP SIDE */}
      {/* Target (Inputs from above/diagonal) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="w-3 h-3 !bg-slate-400 border-2 border-white"
      />

      {/* BOTTOM SIDE */}
      {/* Secondary: Bottom (for back-edges/loops) */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="w-3 h-3 !bg-slate-400 border-2 border-white"
        style={{ left: '40%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="w-3 h-3 !bg-slate-400 border-2 border-white"
        style={{ left: '60%' }}
      />

      {/* Card Content */}
      <div className="p-3">
        {/* Header: Icon + Name */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="p-1.5 rounded-md text-white"
            style={{ backgroundColor: agentColor }}
          >
            {getRoleIcon(nodeData.label, nodeData.role)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-slate-800 truncate">
              {nodeData.label}
            </h3>
            <p className="text-xs text-slate-500">
              {nodeData.messages_sent} sent, {nodeData.messages_received} recv
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div
          className={`
            inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
            ${statusStyle.bg} ${statusStyle.text}
          `}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${status === 'generating' ? 'animate-pulse' : ''}`}
          />
          {status === 'idle' && 'Idle'}
          {status === 'generating' && 'Generating...'}
          {status === 'waiting' && 'Waiting'}
          {status === 'tool_use' && 'Using Tool'}
        </div>
      </div>

      {/* Tool Drawer (slides out when tool is active) */}
      {nodeData.activeTool && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 rounded-b-lg">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Cog className="w-3.5 h-3.5 animate-spin" />
            <span className="font-medium">{nodeData.activeTool}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
