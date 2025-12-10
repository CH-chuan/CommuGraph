/**
 * GraphView - React Flow Graph Visualization (Topology Mode)
 *
 * Implements the CommuGraph design spec:
 * - Rich Card nodes with icon, name, status
 * - Ghost Trail edges with temporal opacity
 * - Geometric/Force-directed layout
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppContext } from '@/context/AppContext';
import { useGraphData } from '@/hooks/useGraphData';
import {
  convertNodesToReactFlow,
  convertEdgesToReactFlow,
  getLayoutedElements,
} from '@/utils/graphAdapters';
import { AgentNode } from './AgentNode';
import { GhostEdge } from './GhostEdge';

// Define custom node and edge types
const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  ghost: GhostEdge,
};

export function GraphView() {
  const { graphId, currentStep, highlightedAgentId, highlightedStepIndex } = useAppContext();
  const { data, isLoading, isError } = useGraphData(graphId, currentStep);
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);

  // Clear focus when timeline changes (scrubbing, chat log navigation, etc.)
  useEffect(() => {
    setFocusedAgentId(null);
  }, [currentStep]);

  // Clear focus when hovering over chat log or timeline (highlightedAgentId or highlightedStepIndex changes)
  useEffect(() => {
    setFocusedAgentId(null);
  }, [highlightedAgentId, highlightedStepIndex]);

  const { nodes, edges } = useMemo(() => {
    if (!data?.graph) return { nodes: [], edges: [] };

    const reactFlowNodes = convertNodesToReactFlow(data.graph.nodes, {
      highlightedAgentId,
      currentStep,
    });
    const reactFlowEdges = convertEdgesToReactFlow(data.graph.edges, {
      currentStep,
      focusedAgentId, // Pass focused agent to edges
    });

    return getLayoutedElements(reactFlowNodes, reactFlowEdges);
  }, [data, highlightedAgentId, currentStep, focusedAgentId]);

  // Handle node single-click to clear focus
  const onNodeClick = useCallback(() => {
    setFocusedAgentId(null);
  }, []);

  // Handle node double-click to focus on its outgoing edges
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Toggle focus: if already focused, unfocus; otherwise focus this agent
    setFocusedAgentId((prev) => (prev === node.id ? null : node.id));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-slate-700">
            Loading graph...
          </div>
          <div className="text-sm text-slate-500">
            Step {currentStep}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-red-600">
            Error loading graph
          </div>
          <div className="text-sm text-slate-500">
            Please try refreshing the page
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-right"
        minZoom={0.3}
        maxZoom={2}
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => (node.data as { color?: string }).color || '#64748b'}
          maskColor="rgba(255, 255, 255, 0.8)"
          className="!bg-slate-50 !border-slate-200"
        />
      </ReactFlow>
    </div>
  );
}
