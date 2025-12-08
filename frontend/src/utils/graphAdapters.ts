/**
 * Graph Adapters - Convert backend data to React Flow format
 */

import type { Node, Edge } from '@xyflow/react';
import type { NodeData, EdgeData } from '@/types/graph';
import dagre from 'dagre';

/**
 * Convert backend NodeData[] to React Flow Node[]
 */
export const convertNodesToReactFlow = (backendNodes: NodeData[]): Node[] => {
  return backendNodes.map((node) => ({
    id: node.id,
    type: 'default',
    position: { x: 0, y: 0 }, // Will be positioned by layout algorithm
    data: {
      label: node.label,
      message_count: node.message_count,
    },
  }));
};

/**
 * Convert backend EdgeData[] to React Flow Edge[]
 */
export const convertEdgesToReactFlow = (backendEdges: EdgeData[]): Edge[] => {
  return backendEdges.map((edge) => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.weight.toString(), // Show interaction count
    type: 'smoothstep',
    data: {
      interactions: edge.interactions,
      weight: edge.weight,
    },
  }));
};

/**
 * Apply dagre layout algorithm to position nodes
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR' }); // Left-to-right layout

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 50 });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Update node positions
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 75, // Center the node (width / 2)
        y: nodeWithPosition.y - 25, // Center the node (height / 2)
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
