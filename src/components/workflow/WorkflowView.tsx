'use client';

/**
 * WorkflowView - Main workflow visualization component
 *
 * Tree-based Agent Activity View for Claude Code logs
 * Features:
 * - Tree layout (vertical DAG, centered)
 * - Horizontal branching for parallel tool calls
 * - Sub-agent cards (collapsed, expandable via modal)
 * - Session start node with metadata (replaces lane headers)
 * - Duration-colored edges
 * - Node filtering by step
 */

import { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppContext } from '@/context/app-context';
import { WorkflowNode, workflowNodeTypes } from './WorkflowNode';
import { WorkflowEdge, workflowEdgeTypes } from './WorkflowEdge';
import { SessionStartNode } from './SessionStartNode';
import { SubAgentCard } from './SubAgentCard';
import { SubAgentModal } from './SubAgentModal';
import type { WorkflowGraphSnapshot, WorkflowNode as WFNode } from '@/lib/models/types';
import {
  computeTreeLayout,
  getNodeColor,
  TREE_LAYOUT_CONFIG,
} from '@/utils/workflow-layout';

// Extended node types including new components
const extendedNodeTypes = {
  ...workflowNodeTypes,
  sessionStart: SessionStartNode,
  subAgentCard: SubAgentCard,
};

interface WorkflowViewProps {
  data: WorkflowGraphSnapshot;
}

/**
 * Determine React Flow node type based on workflow node properties.
 */
function getReactFlowNodeType(node: WFNode): string {
  if (node.isSessionStart) return 'sessionStart';
  if (node.isSubAgentContainer) return 'subAgentCard';
  return 'workflow';
}

/**
 * Convert workflow data to React Flow format using tree layout.
 */
function convertToReactFlow(
  snapshot: WorkflowGraphSnapshot,
  currentStep: number | null,
  highlightedNodeId: string | null,
  onSubAgentExpand: (agentId: string) => void
): { nodes: Node[]; edges: Edge[]; totalHeight: number } {
  const { nodes, edges, lanes } = snapshot;

  // Filter nodes by current step
  const visibleNodes = currentStep !== null
    ? nodes.filter(n => n.stepIndex <= currentStep)
    : nodes;

  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

  // Filter edges to only connect visible nodes
  const visibleEdges = edges.filter(
    e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  );

  // Compute tree layout (handles main lane only, sub-agents are cards)
  const layout = computeTreeLayout(visibleNodes, visibleEdges, lanes);

  // Convert to React Flow nodes
  const reactFlowNodes: Node[] = layout.nodes.map(node => {
    const isCurrent = currentStep !== null && node.stepIndex === currentStep;
    const nodeType = getReactFlowNodeType(node);

    return {
      id: node.id,
      type: nodeType,
      position: { x: node.x, y: node.y },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        id: node.id,
        stepIndex: node.stepIndex,
        nodeType: node.nodeType,
        label: node.label,
        contentPreview: node.contentPreview,
        toolName: node.toolName,
        durationMs: node.durationMs,
        inputTokens: node.inputTokens,
        outputTokens: node.outputTokens,
        laneId: node.laneId,
        isHighlighted: highlightedNodeId === node.id || isCurrent,

        // Tool result enhancements
        toolResultPreview: node.toolResultPreview,
        toolResultStatus: node.toolResultStatus,
        toolResultStdout: node.toolResultStdout,
        toolResultStderr: node.toolResultStderr,

        // Sub-agent fields
        isSubAgentContainer: node.isSubAgentContainer,
        subAgentInfo: node.subAgentInfo,
        onExpand: onSubAgentExpand,

        // Session start fields
        isSessionStart: node.isSessionStart,
        sessionMetadata: node.sessionMetadata,

        // Parallel tracking
        parallelGroupId: node.parallelGroupId,
        parallelIndex: node.parallelIndex,
        parallelCount: node.parallelCount,
      },
      style: {
        width: node.width,
      },
    };
  });

  // Convert edges
  const maxStep = currentStep ?? snapshot.totalSteps;
  const reactFlowEdges: Edge[] = layout.edges.map(edge => {
    const isCurrent = edge.stepIndex === maxStep - 1;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'workflow',
      data: {
        durationMs: edge.durationMs,
        durationClass: edge.durationClass,
        isParallel: edge.isParallel,
        isCrossLane: edge.isCrossLane,
        stepIndex: edge.stepIndex,
        isCurrent,
      },
    };
  });

  return { nodes: reactFlowNodes, edges: reactFlowEdges, totalHeight: layout.totalHeight };
}

/**
 * WorkflowView Component
 */
export function WorkflowView({ data }: WorkflowViewProps) {
  const { currentStep, setCurrentStep, setHighlightedStepIndex, graphId } = useAppContext();
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [selectedSubAgentId, setSelectedSubAgentId] = useState<string | null>(null);

  // Handle sub-agent expand
  const handleSubAgentExpand = useCallback((agentId: string) => {
    setSelectedSubAgentId(agentId);
  }, []);

  // Convert data to React Flow format
  const { nodes, edges, totalHeight } = useMemo(
    () => convertToReactFlow(data, currentStep, highlightedNodeId, handleSubAgentExpand),
    [data, currentStep, highlightedNodeId, handleSubAgentExpand]
  );

  // Handle node click
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const stepIndex = (node.data as { stepIndex?: number }).stepIndex;
      if (stepIndex !== undefined) {
        setCurrentStep(stepIndex);
        setHighlightedStepIndex(stepIndex);
      }
    },
    [setCurrentStep, setHighlightedStepIndex]
  );

  // Handle node hover
  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setHighlightedNodeId(node.id);
      const stepIndex = (node.data as { stepIndex?: number }).stepIndex;
      if (stepIndex !== undefined) {
        setHighlightedStepIndex(stepIndex);
      }
    },
    [setHighlightedStepIndex]
  );

  const onNodeMouseLeave = useCallback(() => {
    setHighlightedNodeId(null);
    setHighlightedStepIndex(null);
  }, [setHighlightedStepIndex]);

  // Calculate viewport dimensions
  const viewportHeight = useMemo(() => {
    return Math.max(600, totalHeight + TREE_LAYOUT_CONFIG.padding * 2);
  }, [totalHeight]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-700">
            No workflow data
          </div>
          <div className="text-sm text-slate-500">
            Upload a Claude Code log to visualize the workflow
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Graph Area - Full width (no time axis or lane headers) */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={extendedNodeTypes}
          edgeTypes={workflowEdgeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.3, minZoom: 0.3 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        >
          <Background gap={20} size={1} color="#f1f5f9" />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              const nodeType = (node.data as { nodeType?: string }).nodeType;
              const isSessionStart = (node.data as { isSessionStart?: boolean }).isSessionStart;
              const isSubAgent = (node.data as { isSubAgentContainer?: boolean }).isSubAgentContainer;

              if (isSessionStart) return '#3B82F6'; // Blue for session start
              if (isSubAgent) return '#8B5CF6'; // Purple for sub-agents
              return getNodeColor(nodeType || 'system_notice');
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlow>
      </div>

      {/* Sub-Agent Modal */}
      <SubAgentModal
        open={selectedSubAgentId !== null}
        onClose={() => setSelectedSubAgentId(null)}
        agentId={selectedSubAgentId}
        graphId={graphId}
        workflowData={data}
      />
    </div>
  );
}
