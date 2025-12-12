'use client';

/**
 * MetricsDashboard - Sidebar with session metrics
 *
 * Displays:
 * - Agent filter dropdown (Main Agent, All Agents, Sub-agent-X)
 * - Session summary (duration, tokens, tool calls)
 * - Activity breakdown (bar chart)
 * - Tool usage stats
 * - Sub-agent summary
 */

import { useMemo, useState } from 'react';
import {
  Clock,
  Coins,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { WorkflowGraphSnapshot, WorkflowLane } from '@/lib/models/types';
import { formatSubAgentName } from '@/utils/agent-naming';
import { useAppContext } from '@/context/app-context';

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
 * Get label for agent filter option
 */
function getAgentFilterLabel(lane: WorkflowLane): string {
  if (lane.id === 'main') return 'Main Agent';
  return formatSubAgentName(lane.subagentType || 'Agent', lane.agentId || lane.id.replace('agent-', ''));
}

/**
 * MetricsDashboard Component
 */
export function MetricsDashboard({ data }: MetricsDashboardProps) {
  const { selectedMetricsAgent, setSelectedMetricsAgent } = useAppContext();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Build filter options from lanes
  const filterOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: 'main', label: 'Main Agent' },
      { value: 'all', label: 'All Agents' },
    ];

    // Add sub-agent options
    const subAgentLanes = data.lanes.filter(l => l.id !== 'main');
    for (const lane of subAgentLanes) {
      options.push({
        value: lane.id,
        label: getAgentFilterLabel(lane),
      });
    }

    return options;
  }, [data.lanes]);

  // Get current filter label
  const currentFilterLabel = useMemo(() => {
    const option = filterOptions.find(o => o.value === selectedMetricsAgent);
    return option?.label || 'Main Agent';
  }, [filterOptions, selectedMetricsAgent]);

  // Helper to calculate metrics from nodes
  const calculateNodeMetrics = (filteredNodes: typeof data.nodes) => {
    let tokens = 0;
    let toolCalls = 0;
    let successCount = 0;
    let failureCount = 0;
    const activityCounts: Record<string, number> = {};
    const toolCounts: Record<string, number> = {};

    for (const node of filteredNodes) {
      tokens += (node.inputTokens || 0) + (node.outputTokens || 0);

      // For activity counts, merge tool_result into result_success
      // so that Success + Failure = Tool Calls
      if (node.nodeType === 'tool_result') {
        activityCounts['result_success'] = (activityCounts['result_success'] || 0) + 1;
      } else {
        activityCounts[node.nodeType] = (activityCounts[node.nodeType] || 0) + 1;
      }

      if (node.nodeType === 'tool_call') {
        toolCalls++;
        if (node.toolName) {
          toolCounts[node.toolName] = (toolCounts[node.toolName] || 0) + 1;
        }
      }
      // Count tool results: result_success and tool_result are both successful
      if (node.nodeType === 'result_success' || node.nodeType === 'tool_result') {
        successCount++;
      }
      if (node.nodeType === 'result_failure') {
        failureCount++;
      }
    }

    // Success rate = successful results / (successful + failed results)
    const totalResults = successCount + failureCount;
    const successRate = totalResults > 0 ? successCount / totalResults : 1;

    const sortedTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return { tokens, toolCalls, successCount, failureCount, successRate, activityCounts, sortedTools, nodeCount: filteredNodes.length };
  };

  // Calculate metrics based on selected filter
  const metrics = useMemo(() => {
    const { nodes, lanes, totalDurationMs } = data;

    // Get sub-agent lanes for reference
    const subAgentLanes = lanes.filter(l => l.id !== 'main');

    // Calculate main agent metrics from main lane nodes
    const mainNodes = nodes.filter(n => n.laneId === 'main');
    const mainMetrics = calculateNodeMetrics(mainNodes);

    // For "all agents" - sum main agent + all sub-agents
    if (selectedMetricsAgent === 'all') {
      // Sum tokens: main agent tokens + all sub-agent tokens from lanes
      const subAgentTokens = subAgentLanes.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
      const allTokens = mainMetrics.tokens + subAgentTokens;

      // Sum tool calls: main agent + all sub-agent tool calls from lanes
      const subAgentToolCalls = subAgentLanes.reduce((sum, l) => sum + (l.totalToolUseCount || 0), 0);
      const allToolCalls = mainMetrics.toolCalls + subAgentToolCalls;

      // Activity breakdown from all nodes
      // Merge tool_result into result_success so Success + Failure = Tool Calls
      const activityCounts: Record<string, number> = {};
      for (const node of nodes) {
        if (node.nodeType === 'tool_result') {
          activityCounts['result_success'] = (activityCounts['result_success'] || 0) + 1;
        } else {
          activityCounts[node.nodeType] = (activityCounts[node.nodeType] || 0) + 1;
        }
      }

      // Tool breakdown from all nodes
      const toolCounts: Record<string, number> = {};
      for (const node of nodes) {
        if (node.nodeType === 'tool_call' && node.toolName) {
          toolCounts[node.toolName] = (toolCounts[node.toolName] || 0) + 1;
        }
      }

      const sortedTools = Object.entries(toolCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Success rate = successful results / total results
      let successCount = 0;
      let failureCount = 0;
      for (const node of nodes) {
        // result_success and tool_result are both successful
        if (node.nodeType === 'result_success' || node.nodeType === 'tool_result') {
          successCount++;
        }
        if (node.nodeType === 'result_failure') {
          failureCount++;
        }
      }
      const totalResults = successCount + failureCount;
      const allSuccessRate = totalResults > 0 ? successCount / totalResults : 1;

      return {
        totalDuration: totalDurationMs,
        totalTokens: allTokens,
        totalToolCalls: allToolCalls,
        successRate: allSuccessRate,
        totalNodes: nodes.length,
        activityCounts,
        sortedTools,
        subAgentLanes,
      };
    }

    // For specific sub-agent - calculate from sub-agent's nodes
    if (selectedMetricsAgent !== 'main') {
      const targetLane = lanes.find(l => l.id === selectedMetricsAgent);
      const filteredNodes = nodes.filter(n => n.laneId === selectedMetricsAgent);
      const subAgentMetrics = calculateNodeMetrics(filteredNodes);

      return {
        // Use lane metrics for duration/tokens (from agent-*.jsonl metadata)
        // But use calculated metrics for tool calls and activity (from parsed nodes)
        totalDuration: targetLane?.totalDurationMs || 0,
        totalTokens: targetLane?.totalTokens || subAgentMetrics.tokens,
        totalToolCalls: targetLane?.totalToolUseCount || subAgentMetrics.toolCalls,
        successRate: subAgentMetrics.successRate,
        totalNodes: subAgentMetrics.nodeCount,
        activityCounts: subAgentMetrics.activityCounts,
        sortedTools: subAgentMetrics.sortedTools,
        subAgentLanes,
      };
    }

    // For main agent - use calculated metrics from main lane nodes
    // Duration is same as total (linear process in Claude Code)
    return {
      totalDuration: totalDurationMs,
      totalTokens: mainMetrics.tokens,
      totalToolCalls: mainMetrics.toolCalls,
      successRate: mainMetrics.successRate,
      totalNodes: mainMetrics.nodeCount,
      activityCounts: mainMetrics.activityCounts,
      sortedTools: mainMetrics.sortedTools,
      subAgentLanes,
    };
  }, [data, selectedMetricsAgent]);

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
      {/* Header with Agent Filter */}
      <div className="space-y-2">
        <div className="text-lg font-semibold text-slate-800">
          Session Metrics
        </div>

        {/* Agent Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors text-sm"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700">{currentFilterLabel}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isFilterOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg z-50 py-1">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedMetricsAgent(option.value);
                    setIsFilterOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                    selectedMetricsAgent === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
          label="Action Success Rate"
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
                  {formatSubAgentName(lane.subagentType || 'Agent', lane.agentId || lane.id.replace('agent-', ''))}
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
