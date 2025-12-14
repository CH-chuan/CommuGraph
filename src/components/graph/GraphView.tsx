'use client';

/**
 * GraphView - React Flow Graph Visualization (Topology Mode)
 *
 * Implements the CommuGraph design spec:
 * - Rich Card nodes with icon, name, status
 * - Ghost Trail edges with temporal opacity
 * - Geometric/Force-directed layout
 */

import { useMemo, useState, useCallback } from 'react';
import { ReactFlow, Background, Controls, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppContext } from '@/context/app-context';
import { useGraphData } from '@/hooks/use-graph-data';
import {
  convertNodesToReactFlow,
  convertEdgesToReactFlow,
  getLayoutedElements,
} from '@/utils/graph-adapters';
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
  const { graphId, currentStep, highlightedAgentId, highlightedStepIndex } =
    useAppContext();
  const { data, isLoading, isError } = useGraphData(graphId, currentStep);
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);

  // Auto-clear focus when context changes (timeline scrubbing, chat log navigation)
  // Using a key-based reset pattern: when the context key changes, focus becomes null
  const contextKey = `${currentStep}-${highlightedAgentId ?? ''}-${highlightedStepIndex ?? ''}`;
  const [lastContextKey, setLastContextKey] = useState(contextKey);

  // Derive effective focus: null if context changed, otherwise current focus
  const effectiveFocusedAgentId = contextKey !== lastContextKey ? null : focusedAgentId;

  // Sync the context key after render to track changes
  if (contextKey !== lastContextKey) {
    setLastContextKey(contextKey);
  }

  const { nodes, edges } = useMemo(() => {
    if (!data?.graph) return { nodes: [], edges: [] };

    const reactFlowNodes = convertNodesToReactFlow(data.graph.nodes, {
      highlightedAgentId,
      currentStep,
    });

    // Create map of node colors for edges
    const nodeColors = reactFlowNodes.reduce(
      (acc, node) => {
        acc[node.id] = (node.data as { color?: string }).color || '#64748b';
        return acc;
      },
      {} as Record<string, string>
    );

    const reactFlowEdges = convertEdgesToReactFlow(data.graph.edges, {
      currentStep,
      focusedAgentId: effectiveFocusedAgentId, // Pass focused agent to edges
      nodeColors,
    });

    return getLayoutedElements(reactFlowNodes, reactFlowEdges);
  }, [data, highlightedAgentId, currentStep, effectiveFocusedAgentId]);

  // Handle node single-click to clear focus
  const onNodeClick = useCallback(() => {
    setFocusedAgentId(null);
  }, []);

  // Handle node double-click to focus on its outgoing edges
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Toggle focus: if already focused, unfocus; otherwise focus this agent
      setFocusedAgentId((prev) => (prev === node.id ? null : node.id));
    },
    []
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-slate-700">
            Loading graph...
          </div>
          <div className="text-sm text-slate-500">Step {currentStep}</div>
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
        proOptions={{ hideAttribution: true }}
        elevateEdgesOnSelect={true} // Bring selected edges to front
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        {/* Global SVG definitions for better z-index control */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            {/* Markers will be defined by individual edges but this ensures proper SVG context */}
          </defs>
        </svg>
      </ReactFlow>
    </div>
  );
}
