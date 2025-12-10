/**
 * Graph Adapters - Convert backend data to React Flow format
 *
 * Implements the CommuGraph visualization design spec:
 * - Rich Card nodes (AgentNode) with icon, name, status
 * - Ghost Trail edges with temporal opacity (GhostEdge)
 */

import type { Node, Edge } from '@xyflow/react';
import type { NodeData, EdgeData } from '@/types/graph';
import type { AgentNodeData } from '@/components/graph/AgentNode';
import dagre from 'dagre';

// Agent color palette (matches CSS variables)
const AGENT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

/**
 * Get consistent color for an agent based on their ID
 */
export const getAgentColor = (agentId: string, agentIds: string[]): string => {
  const index = agentIds.indexOf(agentId);
  return AGENT_COLORS[index % AGENT_COLORS.length];
};

/**
 * Convert backend NodeData[] to React Flow Node[] with Rich Card styling
 */
export const convertNodesToReactFlow = (
  backendNodes: NodeData[],
  options?: {
    highlightedAgentId?: string | null;
    currentStep?: number;
  }
): Node[] => {
  const agentIds = backendNodes.map((n) => n.id);

  return backendNodes.map((node) => ({
    id: node.id,
    type: 'agent', // Use custom AgentNode component
    position: { x: 0, y: 0 }, // Will be positioned by layout algorithm
    data: {
      label: node.label,
      message_count: node.message_count,
      status: 'idle', // TODO: determine from current step data
      role: node.metadata?.role,
      activeTool: null, // TODO: determine from current step data
      isHighlighted: options?.highlightedAgentId === node.id,
      color: getAgentColor(node.id, agentIds),
    } satisfies AgentNodeData,
  }));
};

/**
 * Convert backend EdgeData[] to React Flow Edge[] with Ghost Trail styling
 * Handles bidirectional edges and temporal opacity
 */
export const convertEdgesToReactFlow = (
  backendEdges: EdgeData[],
  options?: {
    currentStep?: number;
    focusedAgentId?: string | null;
  }
): Edge[] => {
  const currentStep = options?.currentStep ?? 0;
  const focusedAgentId = options?.focusedAgentId;

  // Build a set of bidirectional edge pairs
  const bidirectionalPairs = new Set<string>();
  backendEdges.forEach((edge) => {
    const reverseExists = backendEdges.some(
      (e) => e.source === edge.target && e.target === edge.source
    );
    if (reverseExists) {
      const pair = [edge.source, edge.target].sort().join('|');
      bidirectionalPairs.add(pair);
    }
  });

  return backendEdges.map((edge) => {
    const pair = [edge.source, edge.target].sort().join('|');
    const isBidirectional = bidirectionalPairs.has(pair);

    // Find the latest interaction step for this edge
    const latestInteractionStep = edge.interactions.length > 0
      ? Math.max(...edge.interactions.map((i) => i.step_index))
      : 0;

    // Calculate interaction count up to current step
    const currentInteractionCount = edge.interactions.filter(
      (i) => i.step_index <= currentStep
    ).length;

    // Determine if this edge should be highlighted (outgoing from focused agent)
    const isFocused = focusedAgentId ? edge.source === focusedAgentId : false;

    return {
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.weight.toString(),
      type: 'ghost', // Use custom GhostEdge component
      animated: false,
      markerEnd: {
        type: 'arrowclosed',
        width: 16,
        height: 16,
      },
      data: {
        interactions: edge.interactions,
        weight: edge.weight,
        isBidirectional,
        currentStep,
        latestInteractionStep,
        isFocused,
        currentInteractionCount,
      },
    };
  });
};

// Node dimensions for layout (Rich Card size)
const NODE_WIDTH = 180;
const NODE_HEIGHT = 90;

/**
 * Apply dagre layout algorithm with circular/force-directed positioning
 * Layout: Geometric (Circle/Polygon) as per design spec for < 10 agents
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  options?: {
    layout?: 'dagre' | 'circular';
  }
) => {
  const layout = options?.layout ?? 'dagre';

  if (layout === 'circular' && nodes.length <= 10) {
    // Circular layout for small graphs (per design spec)
    const radius = Math.max(200, nodes.length * 50);
    const angleStep = (2 * Math.PI) / nodes.length;

    const layoutedNodes = nodes.map((node, index) => ({
      ...node,
      position: {
        x: radius * Math.cos(index * angleStep - Math.PI / 2),
        y: radius * Math.sin(index * angleStep - Math.PI / 2),
      },
    }));

    return { nodes: layoutedNodes, edges };
  }

  // Dagre layout for larger graphs
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: 80,
    ranksep: 120,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
