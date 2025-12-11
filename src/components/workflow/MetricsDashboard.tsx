'use client';

/**
 * MetricsDashboard - Sidebar with session metrics
 *
 * Displays:
 * - Session summary (duration, tokens, tool calls)
 * - Activity breakdown (bar chart)
 * - Tool usage stats
 * - Sub-agent summary
 */

import { useMemo } from 'react';
import {
  Clock,
  Coins,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { WorkflowGraphSnapshot } from '@/lib/models/types';
import { useState } from 'react';

interface MetricsDashboardProps {
  data: WorkflowGraphSnapshot;
}

/**
 * Format duration for display.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format token count.
 */
function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * Metric Card Component
 */
function MetricCard({
  icon,
  label,
  value,
  subValue,
  color = 'slate',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'slate' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg p-3 border border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded ${colorClasses[color]}`}>{icon}</div>
        <span className="text-xs text-slate-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
      {subValue && (
        <div className="text-xs text-slate-500 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}

/**
 * Activity Bar Component
 */
function ActivityBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600 w-20 truncate">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
    </div>
  );
}

/**
 * Collapsible Section Component
 */
function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200 pb-3">
      <button
        className="flex items-center gap-2 w-full text-left py-2 hover:bg-slate-50 rounded"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
        <span className="text-sm font-medium text-slate-700">{title}</span>
      </button>
      {isOpen && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

/**
 * MetricsDashboard Component
 */
export function MetricsDashboard({ data }: MetricsDashboardProps) {
  // Calculate metrics
  const metrics = useMemo(() => {
    const { nodes, lanes, totalTokens, totalToolCalls, toolSuccessRate, totalDurationMs } = data;

    // Activity breakdown
    const activityCounts: Record<string, number> = {};
    for (const node of nodes) {
      activityCounts[node.nodeType] = (activityCounts[node.nodeType] || 0) + 1;
    }

    // Tool breakdown
    const toolCounts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.nodeType === 'tool_call' && node.toolName) {
        toolCounts[node.toolName] = (toolCounts[node.toolName] || 0) + 1;
      }
    }

    // Sort tools by count
    const sortedTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Sub-agent stats
    const subAgentLanes = lanes.filter(l => l.id !== 'main');

    return {
      totalDuration: totalDurationMs,
      totalTokens,
      totalToolCalls,
      successRate: toolSuccessRate,
      totalNodes: nodes.length,
      activityCounts,
      sortedTools,
      subAgentLanes,
    };
  }, [data]);

  // Activity type colors
  const activityColors: Record<string, string> = {
    user_input: '#3B82F6',
    agent_reasoning: '#8B5CF6',
    tool_call: '#10B981',
    result_success: '#22C55E',
    result_failure: '#EF4444',
    tool_result: '#22C55E',
    system_notice: '#64748B',
  };

  // Activity type labels
  const activityLabels: Record<string, string> = {
    user_input: 'User Input',
    agent_reasoning: 'Reasoning',
    tool_call: 'Tool Calls',
    result_success: 'Success',
    result_failure: 'Failure',
    tool_result: 'Results',
    system_notice: 'System',
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 space-y-4">
      {/* Header */}
      <div className="text-lg font-semibold text-slate-800">
        Session Metrics
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Duration"
          value={formatDuration(metrics.totalDuration)}
          color="blue"
        />
        <MetricCard
          icon={<Coins className="w-4 h-4" />}
          label="Tokens"
          value={formatTokens(metrics.totalTokens)}
          color="amber"
        />
        <MetricCard
          icon={<Wrench className="w-4 h-4" />}
          label="Tool Calls"
          value={metrics.totalToolCalls}
          color="green"
        />
        <MetricCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Success Rate"
          value={`${Math.round(metrics.successRate * 100)}%`}
          color={metrics.successRate > 0.9 ? 'green' : metrics.successRate > 0.7 ? 'amber' : 'red'}
        />
      </div>

      {/* Activity Breakdown */}
      <CollapsibleSection title="Activity Breakdown">
        {Object.entries(metrics.activityCounts).map(([type, count]) => (
          <ActivityBar
            key={type}
            label={activityLabels[type] || type}
            count={count}
            total={metrics.totalNodes}
            color={activityColors[type] || '#64748B'}
          />
        ))}
      </CollapsibleSection>

      {/* Tool Usage */}
      <CollapsibleSection title="Tool Usage">
        {metrics.sortedTools.map(([tool, count]) => (
          <ActivityBar
            key={tool}
            label={tool}
            count={count}
            total={metrics.totalToolCalls}
            color="#10B981"
          />
        ))}
      </CollapsibleSection>

      {/* Sub-agents */}
      {metrics.subAgentLanes.length > 0 && (
        <CollapsibleSection title="Sub-agents">
          {metrics.subAgentLanes.map(lane => (
            <div
              key={lane.id}
              className="bg-white rounded p-2 border border-slate-200"
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-slate-700 truncate">
                  {lane.subagentType || lane.agentId}
                </span>
                {lane.status && (
                  <span
                    className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                      lane.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {lane.status}
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                {lane.totalDurationMs !== undefined && (
                  <span>{formatDuration(lane.totalDurationMs)}</span>
                )}
                {lane.totalTokens !== undefined && (
                  <span>{formatTokens(lane.totalTokens)} tok</span>
                )}
                {lane.totalToolUseCount !== undefined && (
                  <span>{lane.totalToolUseCount} tools</span>
                )}
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Warnings/Anomalies placeholder */}
      {metrics.successRate < 0.9 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Attention</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">
            Tool success rate is below 90%. Check failed operations for potential issues.
          </p>
        </div>
      )}
    </div>
  );
}
