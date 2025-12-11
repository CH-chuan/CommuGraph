/**
 * Workflow Tree Layout Algorithm
 *
 * Computes a tree-based layout for workflow visualization:
 * - Sequential nodes stack vertically, centered
 * - Parallel tool calls (same requestId) spread horizontally
 * - Sub-agent containers are full-width summary cards
 * - No global lane headers (metadata in session start node)
 */

import type { WorkflowNode, WorkflowEdge, WorkflowLane } from '@/lib/models/types';

// Layout configuration
export const TREE_LAYOUT_CONFIG = {
  // Node dimensions
  nodeWidth: 280,
  nodeHeight: 100,
  compactNodeHeight: 60,
  resultNodeHeight: 80,
  subAgentCardHeight: 120,
  sessionStartHeight: 80,

  // Spacing
  horizontalGap: 40,        // Between parallel nodes
  verticalGap: 30,          // Between sequential nodes
  parallelVerticalGap: 20,  // Between parallel group and next node

  // Canvas
  canvasWidth: 1200,        // Base canvas width
  padding: 60,              // Edge padding
};

export interface LayoutedNode extends WorkflowNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutedEdge extends WorkflowEdge {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface TreeLayout {
  nodes: LayoutedNode[];
  edges: LayoutedEdge[];
  totalWidth: number;
  totalHeight: number;
}

/**
 * Get height for node based on type and properties.
 */
export function getNodeHeight(node: WorkflowNode): number {
  if (node.isSessionStart) {
    return TREE_LAYOUT_CONFIG.sessionStartHeight;
  }
  if (node.isSubAgentContainer) {
    return TREE_LAYOUT_CONFIG.subAgentCardHeight;
  }
  switch (node.nodeType) {
    case 'result_success':
    case 'result_failure':
    case 'tool_result':
      return TREE_LAYOUT_CONFIG.resultNodeHeight;
    case 'agent_reasoning':
      return TREE_LAYOUT_CONFIG.nodeHeight;
    case 'tool_call':
      return TREE_LAYOUT_CONFIG.compactNodeHeight + 20;
    case 'user_input':
      return TREE_LAYOUT_CONFIG.nodeHeight;
    default:
      return TREE_LAYOUT_CONFIG.compactNodeHeight;
  }
}

/**
 * Get width for node based on type and properties.
 */
export function getNodeWidth(node: WorkflowNode): number {
  // Sub-agent cards and session start are wider
  if (node.isSubAgentContainer) {
    return TREE_LAYOUT_CONFIG.nodeWidth + 100;
  }
  if (node.isSessionStart) {
    return TREE_LAYOUT_CONFIG.nodeWidth + 60;
  }
  return TREE_LAYOUT_CONFIG.nodeWidth;
}

/**
 * Get color for node type.
 */
export function getNodeColor(nodeType: string): string {
  switch (nodeType) {
    case 'user_input':
      return '#3B82F6'; // Blue
    case 'agent_reasoning':
      return '#8B5CF6'; // Purple
    case 'tool_call':
      return '#10B981'; // Emerald
    case 'result_success':
      return '#22C55E'; // Green
    case 'result_failure':
      return '#EF4444'; // Red
    case 'system_notice':
      return '#64748B'; // Slate
    default:
      return '#64748B';
  }
}

/**
 * Get color for duration class.
 */
export function getDurationColor(durationClass: string): string {
  switch (durationClass) {
    case 'fast':
      return '#22C55E'; // Green
    case 'medium':
      return '#EAB308'; // Yellow
    case 'slow':
      return '#F97316'; // Orange
    case 'very_slow':
      return '#EF4444'; // Red
    default:
      return '#64748B';
  }
}

/**
 * Build adjacency map from edges.
 */
function buildAdjacencyMap(
  edges: WorkflowEdge[]
): { children: Map<string, string[]>; parents: Map<string, string[]> } {
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  for (const edge of edges) {
    // Add to children map
    const existingChildren = children.get(edge.source) || [];
    existingChildren.push(edge.target);
    children.set(edge.source, existingChildren);

    // Add to parents map
    const existingParents = parents.get(edge.target) || [];
    existingParents.push(edge.source);
    parents.set(edge.target, existingParents);
  }

  return { children, parents };
}

/**
 * Identify parallel groups and their result nodes.
 * A parallel group consists of tool_call nodes with the same parallelGroupId,
 * followed by their corresponding result nodes.
 */
interface ParallelGroup {
  id: string;
  toolCallNodes: WorkflowNode[];
  resultNodes: WorkflowNode[];
}

function identifyParallelGroups(
  nodes: WorkflowNode[],
  adjacency: { children: Map<string, string[]> }
): Map<string, ParallelGroup> {
  const groups = new Map<string, ParallelGroup>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Find all nodes that are part of parallel groups
  for (const node of nodes) {
    if (node.parallelGroupId && node.nodeType === 'tool_call') {
      let group = groups.get(node.parallelGroupId);
      if (!group) {
        group = {
          id: node.parallelGroupId,
          toolCallNodes: [],
          resultNodes: [],
        };
        groups.set(node.parallelGroupId, group);
      }
      group.toolCallNodes.push(node);

      // Find corresponding result node
      const childIds = adjacency.children.get(node.id) || [];
      for (const childId of childIds) {
        const childNode = nodeMap.get(childId);
        if (childNode && (childNode.nodeType === 'result_success' || childNode.nodeType === 'result_failure')) {
          group.resultNodes.push(childNode);
        }
      }
    }
  }

  // Sort nodes within each group by parallelIndex
  for (const group of groups.values()) {
    group.toolCallNodes.sort((a, b) => (a.parallelIndex ?? 0) - (b.parallelIndex ?? 0));
    // Match result nodes to their tool calls
    group.resultNodes.sort((a, b) => {
      const aParent = nodes.find(n => n.id === a.parentNodeIds?.[0]);
      const bParent = nodes.find(n => n.id === b.parentNodeIds?.[0]);
      return (aParent?.parallelIndex ?? 0) - (bParent?.parallelIndex ?? 0);
    });
  }

  return groups;
}

/**
 * Compute tree-based layout for workflow graph.
 * Filters to main lane only (sub-agents shown as cards).
 */
export function computeTreeLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  _lanes: WorkflowLane[]
): TreeLayout {
  const config = TREE_LAYOUT_CONFIG;

  // Filter to main lane only (sub-agents are collapsed into cards)
  const mainNodes = nodes.filter(n => n.laneId === 'main');
  const mainNodeIds = new Set(mainNodes.map(n => n.id));

  // Filter edges to main lane
  const mainEdges = edges.filter(
    e => mainNodeIds.has(e.source) && mainNodeIds.has(e.target)
  );

  // Build adjacency map
  const adjacency = buildAdjacencyMap(mainEdges);

  // Identify parallel groups
  const parallelGroups = identifyParallelGroups(mainNodes, adjacency);

  // Track which nodes are in parallel groups
  const nodesInParallelGroups = new Set<string>();
  for (const group of parallelGroups.values()) {
    for (const node of [...group.toolCallNodes, ...group.resultNodes]) {
      nodesInParallelGroups.add(node.id);
    }
  }

  // Sort main nodes by timestamp to establish order
  const sortedNodes = [...mainNodes].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Compute positions using topological traversal
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
  const placed = new Set<string>();

  const centerX = config.canvasWidth / 2;
  let currentY = config.padding;

  // Process nodes in sorted order, handling parallel groups specially
  const processedParallelGroups = new Set<string>();

  for (const node of sortedNodes) {
    if (placed.has(node.id)) continue;

    // Check if this node starts a parallel group
    if (node.parallelGroupId && !processedParallelGroups.has(node.parallelGroupId)) {
      const group = parallelGroups.get(node.parallelGroupId);
      if (group && group.toolCallNodes.length > 1) {
        // Layout parallel group horizontally
        const toolCallCount = group.toolCallNodes.length;
        const nodeWidth = config.nodeWidth;
        const totalWidth = toolCallCount * nodeWidth + (toolCallCount - 1) * config.horizontalGap;
        const startX = centerX - totalWidth / 2;

        // Position tool call nodes
        let maxToolCallHeight = 0;
        for (let i = 0; i < group.toolCallNodes.length; i++) {
          const toolNode = group.toolCallNodes[i];
          const height = getNodeHeight(toolNode);
          maxToolCallHeight = Math.max(maxToolCallHeight, height);

          positions.set(toolNode.id, {
            x: startX + i * (nodeWidth + config.horizontalGap),
            y: currentY,
            width: nodeWidth,
            height,
          });
          placed.add(toolNode.id);
        }

        currentY += maxToolCallHeight + config.verticalGap;

        // Position result nodes below their tool calls
        let maxResultHeight = 0;
        for (let i = 0; i < group.resultNodes.length; i++) {
          const resultNode = group.resultNodes[i];
          const height = getNodeHeight(resultNode);
          maxResultHeight = Math.max(maxResultHeight, height);

          positions.set(resultNode.id, {
            x: startX + i * (nodeWidth + config.horizontalGap),
            y: currentY,
            width: nodeWidth,
            height,
          });
          placed.add(resultNode.id);
        }

        currentY += maxResultHeight + config.parallelVerticalGap;
        processedParallelGroups.add(node.parallelGroupId);
        continue;
      }
    }

    // Skip if already placed as part of a parallel group
    if (nodesInParallelGroups.has(node.id) && placed.has(node.id)) {
      continue;
    }

    // Single node - center it
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);

    positions.set(node.id, {
      x: centerX - width / 2,
      y: currentY,
      width,
      height,
    });
    placed.add(node.id);
    currentY += height + config.verticalGap;
  }

  // Build layouted nodes
  const layoutedNodes: LayoutedNode[] = mainNodes
    .filter(n => positions.has(n.id))
    .map(node => {
      const pos = positions.get(node.id)!;
      return {
        ...node,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
      };
    });

  // Build layouted edges
  const layoutedEdges: LayoutedEdge[] = mainEdges
    .filter(e => positions.has(e.source) && positions.has(e.target))
    .map(edge => {
      const sourcePos = positions.get(edge.source)!;
      const targetPos = positions.get(edge.target)!;

      // Calculate connection points
      const sourceX = sourcePos.x + sourcePos.width / 2;
      const sourceY = sourcePos.y + sourcePos.height;
      const targetX = targetPos.x + targetPos.width / 2;
      const targetY = targetPos.y;

      return {
        ...edge,
        sourceX,
        sourceY,
        targetX,
        targetY,
      };
    });

  // Calculate total dimensions
  let maxX = 0;
  let maxY = 0;
  for (const node of layoutedNodes) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    totalWidth: Math.max(config.canvasWidth, maxX + config.padding),
    totalHeight: maxY + config.padding,
  };
}

// Legacy export for backward compatibility
export function computeWorkflowLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  lanes: WorkflowLane[]
): TreeLayout & { lanes: Array<WorkflowLane & { x: number; width: number }> } {
  const layout = computeTreeLayout(nodes, edges, lanes);

  // Add lane positions for backward compatibility (not used in new layout)
  const layoutedLanes = lanes.map((lane, idx) => ({
    ...lane,
    x: TREE_LAYOUT_CONFIG.padding + idx * 250,
    width: TREE_LAYOUT_CONFIG.nodeWidth,
  }));

  return {
    ...layout,
    lanes: layoutedLanes,
  };
}
