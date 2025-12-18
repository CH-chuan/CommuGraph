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
  nodeHeight: 120,          // Increased for better content display
  compactNodeHeight: 70,    // Increased
  resultNodeHeight: 110,    // Increased for preview content
  subAgentToolCallHeight: 150, // Task tool calls with sub-agent info are taller
  sessionStartHeight: 90,

  // Spacing - generous for visual clarity
  horizontalGap: 100,       // Between parallel nodes (increased significantly)
  verticalGap: 60,          // Between sequential nodes
  parallelVerticalGap: 70,  // Between parallel group and next node

  // Canvas
  canvasWidth: 1400,        // Wider canvas for parallel nodes
  padding: 100,             // Edge padding
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
  // Task tool calls with sub-agent info are taller
  if (node.isSubAgentContainer && node.subAgentInfo) {
    return TREE_LAYOUT_CONFIG.subAgentToolCallHeight;
  }
  switch (node.nodeType) {
    case 'result_success':
    case 'result_failure':
    case 'tool_result':
      return TREE_LAYOUT_CONFIG.resultNodeHeight;
    case 'agent_reasoning':
      return TREE_LAYOUT_CONFIG.nodeHeight;
    case 'tool_call':
      // Regular tool calls need moderate height for label + preview
      return TREE_LAYOUT_CONFIG.compactNodeHeight + 30;
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
  // Map from tool call ID to its result node for proper alignment
  toolCallToResult: Map<string, WorkflowNode>;
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
          toolCallToResult: new Map(),
        };
        groups.set(node.parallelGroupId, group);
      }
      group.toolCallNodes.push(node);

      // Find corresponding result node (include all result types)
      const childIds = adjacency.children.get(node.id) || [];
      for (const childId of childIds) {
        const childNode = nodeMap.get(childId);
        if (childNode && (
          childNode.nodeType === 'result_success' ||
          childNode.nodeType === 'result_failure' ||
          childNode.nodeType === 'tool_result'
        )) {
          // Map this result to its parent tool call
          group.toolCallToResult.set(node.id, childNode);
          break; // Only one result per tool call
        }
      }
    }
  }

  // Sort tool call nodes within each group by parallelIndex
  for (const group of groups.values()) {
    group.toolCallNodes.sort((a, b) => (a.parallelIndex ?? 0) - (b.parallelIndex ?? 0));
  }

  return groups;
}

/**
 * Compute tree-based layout for workflow graph.
 * Filters to main lane only (sub-agents shown as cards).
 */
export function computeTreeLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
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
    for (const node of group.toolCallNodes) {
      nodesInParallelGroups.add(node.id);
    }
    for (const resultNode of group.toolCallToResult.values()) {
      nodesInParallelGroups.add(resultNode.id);
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

        // Store X positions for each tool call to align results
        const toolCallXPositions = new Map<string, number>();

        // Position tool call nodes
        let maxToolCallHeight = 0;
        for (let i = 0; i < group.toolCallNodes.length; i++) {
          const toolNode = group.toolCallNodes[i];
          const height = getNodeHeight(toolNode);
          maxToolCallHeight = Math.max(maxToolCallHeight, height);
          const xPos = startX + i * (nodeWidth + config.horizontalGap);

          toolCallXPositions.set(toolNode.id, xPos);
          positions.set(toolNode.id, {
            x: xPos,
            y: currentY,
            width: nodeWidth,
            height,
          });
          placed.add(toolNode.id);
        }

        currentY += maxToolCallHeight + config.verticalGap;

        // Position result nodes directly below their parent tool calls
        let maxResultHeight = 0;
        for (const toolNode of group.toolCallNodes) {
          const resultNode = group.toolCallToResult.get(toolNode.id);
          if (resultNode) {
            const height = getNodeHeight(resultNode);
            maxResultHeight = Math.max(maxResultHeight, height);
            const parentX = toolCallXPositions.get(toolNode.id) ?? startX;

            positions.set(resultNode.id, {
              x: parentX,
              y: currentY,
              width: nodeWidth,
              height,
            });
            placed.add(resultNode.id);
          }
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
  const layout = computeTreeLayout(nodes, edges);

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
