'use client';

/**
 * AutoGenMetricsPanel - Graph theory metrics for AutoGen framework
 *
 * Displays:
 * - Graph overview (nodes, edges, density)
 * - Dominant agents (ranked by centrality)
 * - Centrality details (degree, in-degree, out-degree)
 * - Communication frequency (interactions over time)
 * - Interaction density (visual representation)
 */

import { useMemo, useState } from 'react';
import {
  Users,
  ArrowRightLeft,
  Network,
  Activity,
  ChevronDown,
  ChevronRight,
  Crown,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { useAppContext } from '@/context/app-context';
import { useMetricsData } from '@/hooks/use-metrics-data';
import { useGraphData } from '@/hooks/use-graph-data';
import type { GraphSnapshot } from '@/types/graph';

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
  color?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
}) {
  const colorClasses = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
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
 * Centrality Bar - visual representation of centrality score
 */
function CentralityBar({ score, maxScore }: { score: number; maxScore: number }) {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  return (
    <div className="flex-1 bg-slate-100 rounded-full h-2 max-w-20">
      <div
        className="h-2 rounded-full bg-blue-500 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Get density interpretation label and color
 */
function getDensityInfo(density: number): { label: string; color: string } {
  if (density >= 0.7) return { label: 'Highly Connected', color: 'text-green-600' };
  if (density >= 0.4) return { label: 'Moderately Connected', color: 'text-amber-600' };
  if (density >= 0.2) return { label: 'Sparsely Connected', color: 'text-orange-600' };
  return { label: 'Very Sparse', color: 'text-red-600' };
}

/**
 * Calculate communication stats from graph edges
 */
function calculateCommunicationStats(graph: GraphSnapshot) {
  let totalInteractions = 0;
  const interactionsPerStep: Record<number, number> = {};
  const messagesByAgent: Record<string, { sent: number; received: number }> = {};

  // Initialize from nodes
  for (const node of graph.nodes) {
    messagesByAgent[node.id] = {
      sent: node.messages_sent,
      received: node.messages_received,
    };
  }

  // Calculate interactions from edges
  for (const edge of graph.edges) {
    totalInteractions += edge.interactions.length;
    for (const interaction of edge.interactions) {
      const step = interaction.step_index;
      interactionsPerStep[step] = (interactionsPerStep[step] || 0) + 1;
    }
  }

  const avgPerStep = graph.total_steps > 0 ? totalInteractions / graph.total_steps : 0;

  return {
    totalInteractions,
    interactionsPerStep,
    messagesByAgent,
    avgPerStep,
  };
}

/**
 * AutoGenMetricsPanel Component
 */
export function AutoGenMetricsPanel() {
  const { graphId, currentStep, totalSteps } = useAppContext();
  const { data: metricsData, isLoading: metricsLoading } = useMetricsData(graphId);
  const { data: graphData, isLoading: graphLoading } = useGraphData(graphId);

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    if (!metricsData) return null;

    // Sort agents by centrality for dominant agents
    const sortedByCentrality = Object.entries(metricsData.centrality || {})
      .sort(([, a], [, b]) => b - a);

    const maxCentrality = sortedByCentrality.length > 0 ? sortedByCentrality[0][1] : 0;

    return {
      sortedByCentrality,
      maxCentrality,
    };
  }, [metricsData]);

  // Calculate communication stats from graph
  const communicationStats = useMemo(() => {
    if (!graphData?.graph) return null;
    return calculateCommunicationStats(graphData.graph);
  }, [graphData]);

  // Loading state
  if (metricsLoading || graphLoading) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-4">
        <div className="text-lg font-semibold text-slate-800 mb-4">
          Graph Insights
        </div>
        <div className="text-sm text-slate-500">Loading metrics...</div>
      </div>
    );
  }

  // No data state
  if (!metricsData || !graphId) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-4">
        <div className="text-lg font-semibold text-slate-800 mb-4">
          Graph Insights
        </div>
        <div className="text-sm text-slate-500">
          Upload a log file to see graph metrics.
        </div>
      </div>
    );
  }

  const densityInfo = getDensityInfo(metricsData.density);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 space-y-4">
      {/* Header */}
      <div className="text-lg font-semibold text-slate-800">
        Graph Insights
      </div>

      {/* Graph Overview Cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Users className="w-4 h-4" />}
          label="Agents"
          value={metricsData.node_count}
          color="blue"
        />
        <MetricCard
          icon={<ArrowRightLeft className="w-4 h-4" />}
          label="Connections"
          value={metricsData.edge_count}
          color="green"
        />
        <MetricCard
          icon={<Network className="w-4 h-4" />}
          label="Density"
          value={`${(metricsData.density * 100).toFixed(1)}%`}
          subValue={densityInfo.label}
          color="amber"
        />
        <MetricCard
          icon={<Activity className="w-4 h-4" />}
          label="Step"
          value={`${currentStep ?? 0}/${totalSteps}`}
          color="slate"
        />
      </div>

      {/* Dominant Agents Section */}
      {derivedMetrics && derivedMetrics.sortedByCentrality.length > 0 && (
        <CollapsibleSection title="Dominant Agents" defaultOpen={true}>
          <div className="text-xs text-slate-500 mb-2">
            Ranked by degree centrality (overall influence)
          </div>
          {derivedMetrics.sortedByCentrality.slice(0, 5).map(([agent, score], index) => (
            <div
              key={agent}
              className="flex items-center gap-2 py-1.5 px-2 bg-white rounded border border-slate-200"
            >
              <span className="w-5 text-sm font-bold text-slate-400">
                #{index + 1}
              </span>
              {index === 0 && <Crown className="w-4 h-4 text-amber-500" />}
              <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                {agent}
              </span>
              <CentralityBar score={score} maxScore={derivedMetrics.maxCentrality} />
              <span className="text-xs text-slate-500 w-12 text-right">
                {(score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Centrality Details Section */}
      {metricsData.centrality && Object.keys(metricsData.centrality).length > 0 && (
        <CollapsibleSection title="Centrality Details" defaultOpen={false}>
          {/* Degree Centrality */}
          <div className="mb-3">
            <div className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Degree Centrality (Overall Influence)
            </div>
            <div className="space-y-1">
              {Object.entries(metricsData.centrality || {})
                .sort(([, a], [, b]) => b - a)
                .map(([agent, score]) => (
                  <div key={agent} className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-600 truncate max-w-24">{agent}</span>
                    <span className="text-slate-800 font-medium">
                      {(score * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* In-Degree Centrality */}
          {metricsData.in_degree_centrality && (
            <div className="mb-3">
              <div className="text-xs font-medium text-slate-600 mb-1">
                In-Degree (Receives Messages)
              </div>
              <div className="space-y-1">
                {Object.entries(metricsData.in_degree_centrality)
                  .sort(([, a], [, b]) => b - a)
                  .map(([agent, score]) => (
                    <div key={agent} className="flex justify-between text-xs py-0.5">
                      <span className="text-slate-600 truncate max-w-24">{agent}</span>
                      <span className="text-slate-800 font-medium">
                        {(score * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Out-Degree Centrality */}
          {metricsData.out_degree_centrality && (
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">
                Out-Degree (Sends Messages)
              </div>
              <div className="space-y-1">
                {Object.entries(metricsData.out_degree_centrality)
                  .sort(([, a], [, b]) => b - a)
                  .map(([agent, score]) => (
                    <div key={agent} className="flex justify-between text-xs py-0.5">
                      <span className="text-slate-600 truncate max-w-24">{agent}</span>
                      <span className="text-slate-800 font-medium">
                        {(score * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Communication Frequency Section */}
      {communicationStats && (
        <CollapsibleSection title="Communication Frequency" defaultOpen={true}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Total Interactions
              </span>
              <span className="font-medium text-slate-800">
                {communicationStats.totalInteractions}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Avg per Step</span>
              <span className="font-medium text-slate-800">
                {communicationStats.avgPerStep.toFixed(1)}
              </span>
            </div>
            {currentStep !== undefined && currentStep !== null && (
              <div className="flex justify-between">
                <span className="text-slate-600">Current Step</span>
                <span className="font-medium text-slate-800">
                  {communicationStats.interactionsPerStep[currentStep] || 0} interactions
                </span>
              </div>
            )}

            {/* Per-agent message stats */}
            <div className="pt-2 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-500 mb-1">By Agent</div>
              <div className="space-y-1">
                {Object.entries(communicationStats.messagesByAgent)
                  .sort(([, a], [, b]) => (b.sent + b.received) - (a.sent + a.received))
                  .map(([agent, counts]) => (
                    <div key={agent} className="flex justify-between text-xs py-0.5">
                      <span className="text-slate-600 truncate max-w-24">{agent}</span>
                      <span className="text-slate-500">
                        <span className="text-green-600">{counts.sent}</span>
                        {' / '}
                        <span className="text-blue-600">{counts.received}</span>
                        <span className="text-slate-400 ml-1">(sent/recv)</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Interaction Density Section */}
      <CollapsibleSection title="Interaction Density" defaultOpen={true}>
        <div className="space-y-2">
          {/* Visual density bar */}
          <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
              style={{ width: `${metricsData.density * 100}%` }}
            />
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Density Score</span>
            <span className="font-medium text-slate-800">
              {(metricsData.density * 100).toFixed(1)}%
            </span>
          </div>

          <div className={`text-xs ${densityInfo.color}`}>
            {densityInfo.label}
          </div>

          <div className="text-xs text-slate-500">
            Graph density measures how many of the possible connections between agents actually exist.
            A fully connected graph has 100% density.
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
