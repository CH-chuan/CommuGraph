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

import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppContext } from '@/context/app-context';
import { WorkflowNode, workflowNodeTypes } from './WorkflowNode';
import { WorkflowEdge, workflowEdgeTypes } from './WorkflowEdge';
import { SessionStartNode } from './SessionStartNode';
import { SubAgentModal } from './SubAgentModal';
import type { WorkflowGraphSnapshot, WorkflowNode as WFNode } from '@/lib/models/types';
import {
  computeTreeLayout,
  getNodeColor,
  TREE_LAYOUT_CONFIG,
} from '@/utils/workflow-layout';
import { extractAgentIdFromLaneId } from '@/utils/agent-naming';

// Extended node types including new components
const extendedNodeTypes = {
  ...workflowNodeTypes,
  sessionStart: SessionStartNode,
};

interface WorkflowViewProps {
  data: WorkflowGraphSnapshot;
}

/**
 * Determine React Flow node type based on workflow node properties.
 */
function getReactFlowNodeType(node: WFNode): string {
  if (node.isSessionStart) return 'sessionStart';
  // Task tool calls with sub-agents use 'workflow' type and render via SubAgentToolCallComponent
  return 'workflow';
}

/**
 * Convert workflow data to React Flow format using tree layout.
 */
function convertToReactFlow(
  snapshot: WorkflowGraphSnapshot,
  currentStep: number | null,
  highlightedStepIndex: number | null,
  onSubAgentExpand: (agentId: string) => void,
  onImageClick: (image: { mediaType: string; data: string }) => void
): { nodes: Node[]; edges: Edge[]; totalHeight: number } {
  const { nodes, edges, lanes } = snapshot;

  // Build list of main agent nodes sorted by stepIndex for step mapping
  // Main agent nodes are in 'main' lane and not session start nodes
  const mainAgentNodes = nodes
    .filter(n => n.laneId === 'main' && !n.isSessionStart)
    .sort((a, b) => a.stepIndex - b.stepIndex);

  // Build main agent step mapping (stepIndex -> sequential number, 1-indexed)
  const mainAgentStepMap = new Map<number, number>();
  mainAgentNodes.forEach((n, idx) => {
    mainAgentStepMap.set(n.stepIndex, idx + 1);
  });

  // Build sub-agent step mapping per agent (agentId -> stepIndex -> sequential number)
  const subAgentStepMaps = new Map<string, Map<number, number>>();

  // Group sub-agent nodes by agentId
  const subAgentNodesGrouped = new Map<string, WFNode[]>();
  nodes.filter(n => n.laneId !== 'main' && !n.isSessionStart).forEach(n => {
    const agentId = n.agentId || extractAgentIdFromLaneId(n.laneId) || n.laneId;
    if (!subAgentNodesGrouped.has(agentId)) {
      subAgentNodesGrouped.set(agentId, []);
    }
    subAgentNodesGrouped.get(agentId)!.push(n);
  });

  // Sort each agent's nodes by stepIndex and assign sequential numbers
  for (const [agentId, agentNodes] of subAgentNodesGrouped) {
    const sortedNodes = agentNodes.sort((a, b) => a.stepIndex - b.stepIndex);
    const stepMap = new Map<number, number>();
    sortedNodes.forEach((n, idx) => {
      stepMap.set(n.stepIndex, idx + 1);
    });
    subAgentStepMaps.set(agentId, stepMap);
  }

  // Helper to get display step label for a node
  const getDisplayStepLabel = (node: WFNode): string => {
    if (node.isSessionStart) {
      return ''; // No step label for session start
    }
    if (node.laneId === 'main') {
      const mainStep = mainAgentStepMap.get(node.stepIndex);
      return mainStep !== undefined ? `#${mainStep}` : `#${node.stepIndex}`;
    }
    // Sub-agent node
    const agentId = node.agentId || extractAgentIdFromLaneId(node.laneId) || node.laneId;
    const agentIdShort = agentId.substring(0, 4); // Use first 4 chars
    const stepMap = subAgentStepMaps.get(agentId);
    const seq = stepMap?.get(node.stepIndex) ?? node.stepIndex;
    return `sub-${agentIdShort}-${seq}`;
  };

  // Map main agent step number to actual stepIndex
  // currentStep now represents "show up to the Nth main agent node"
  let effectiveStepIndex: number | null = null;
  if (currentStep !== null && mainAgentNodes.length > 0) {
    // Clamp to valid range (currentStep is 1-indexed for display, 0 means start)
    const targetIndex = Math.min(currentStep, mainAgentNodes.length) - 1;
    if (targetIndex >= 0) {
      effectiveStepIndex = mainAgentNodes[targetIndex].stepIndex;
    } else {
      // currentStep is 0, show only session start
      effectiveStepIndex = -1;
    }
  }

  // Filter nodes by effective step index
  const visibleNodes = effectiveStepIndex !== null
    ? nodes.filter(n => n.stepIndex <= effectiveStepIndex)
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
    // Use effectiveStepIndex for current node highlighting
    const isCurrent = effectiveStepIndex !== null && node.stepIndex === effectiveStepIndex;
    const isHighlighted = highlightedStepIndex !== null && node.stepIndex === highlightedStepIndex;
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
        displayStepLabel: getDisplayStepLabel(node),
        nodeType: node.nodeType,
        label: node.label,
        contentPreview: node.contentPreview,
        toolName: node.toolName,
        durationMs: node.durationMs,
        inputTokens: node.inputTokens,
        outputTokens: node.outputTokens,
        laneId: node.laneId,
        isHighlighted: isHighlighted || isCurrent,

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

        // Image content
        images: node.images,
        onImageClick,
      },
      style: {
        width: node.width,
      },
    };
  });

  // Convert edges
  // Use effectiveStepIndex for edge current highlighting
  const maxStep = effectiveStepIndex ?? snapshot.totalSteps;
  const reactFlowEdges: Edge[] = layout.edges.map(edge => {
    const isCurrent = edge.stepIndex === maxStep;

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
 * Inner WorkflowView Component - Has access to useReactFlow for focus/centering
 */
function WorkflowViewInner() {
  const { focusStepIndex, setFocusStepIndex } = useAppContext();
  const { setCenter, getNodes } = useReactFlow();

  // Focus on node when focusStepIndex changes (triggered by chat log double-click)
  useEffect(() => {
    if (focusStepIndex === null) return;

    // Find the node with this stepIndex
    const targetNode = getNodes().find(
      (n) => (n.data as { stepIndex?: number }).stepIndex === focusStepIndex
    );

    if (targetNode) {
      // Center on the node with animation
      const nodeWidth = (targetNode.style?.width as number) || 200;
      const nodeHeight = 100; // Approximate node height
      setCenter(
        targetNode.position.x + nodeWidth / 2,
        targetNode.position.y + nodeHeight / 2,
        { zoom: 1, duration: 500 }
      );
    }

    // Clear the focus after centering
    setFocusStepIndex(null);
  }, [focusStepIndex, setFocusStepIndex, setCenter, getNodes]);

  return (
    <>
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
    </>
  );
}

/**
 * WorkflowView Component - Wrapped with ReactFlowProvider
 */
export function WorkflowView({ data }: WorkflowViewProps) {
  const { currentStep, highlightedStepIndex, setCurrentStep, setHighlightedStepIndex, graphId } = useAppContext();
  const [selectedSubAgentId, setSelectedSubAgentId] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<{ mediaType: string; data: string } | null>(null);

  // Handle sub-agent expand
  const handleSubAgentExpand = useCallback((agentId: string) => {
    setSelectedSubAgentId(agentId);
  }, []);

  // Handle image click for full-size modal
  const handleImageClick = useCallback((image: { mediaType: string; data: string }) => {
    setModalImage(image);
  }, []);

  // Convert data to React Flow format
  const { nodes, edges, totalHeight } = useMemo(
    () => convertToReactFlow(data, currentStep, highlightedStepIndex, handleSubAgentExpand, handleImageClick),
    [data, currentStep, highlightedStepIndex, handleSubAgentExpand, handleImageClick]
  );

  // Handle single click - scroll chat log to message (don't change graph step)
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const stepIndex = (node.data as { stepIndex?: number }).stepIndex;
      if (stepIndex !== undefined) {
        // Only scroll chat log - don't change currentStep
        setHighlightedStepIndex(stepIndex);
      }
    },
    [setHighlightedStepIndex]
  );

  // Handle double click - restore graph to that step AND scroll chat log
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const stepIndex = (node.data as { stepIndex?: number }).stepIndex;
      if (stepIndex !== undefined) {
        // Set currentStep (restore graph) and scroll chat log
        setCurrentStep(stepIndex);
        setHighlightedStepIndex(stepIndex);
      }
    },
    [setCurrentStep, setHighlightedStepIndex]
  );

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-700">
            Click button at the bottom to start
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
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          fitViewOptions={{ padding: 0.3, minZoom: 0.3 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        >
          <WorkflowViewInner />
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

      {/* Image Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={`data:${modalImage.mediaType};base64,${modalImage.data}`}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setModalImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-gray-600 text-xl leading-none">&times;</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
