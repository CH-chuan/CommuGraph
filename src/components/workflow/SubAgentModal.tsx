'use client';

/**
 * SubAgentModal - Modal for viewing full sub-agent workflow
 *
 * Displays the complete workflow of a sub-agent in a modal overlay.
 * Features:
 * - Full workflow visualization
 * - Same layout and interaction as main workflow
 * - Agent metadata header
 */

import { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Clock, Sparkles, Wrench, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { workflowNodeTypes } from './WorkflowNode';
import { workflowEdgeTypes } from './WorkflowEdge';
import type { WorkflowGraphSnapshot, WorkflowNode as WFNode } from '@/lib/models/types';
import { TREE_LAYOUT_CONFIG, getNodeHeight } from '@/utils/workflow-layout';

interface SubAgentModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string | null;
  workflowData: WorkflowGraphSnapshot;
}

/**
 * Layout sub-agent nodes vertically (simple linear layout).
 */
function layoutSubAgentNodes(
  nodes: WFNode[]
): { layoutedNodes: Array<WFNode & { x: number; y: number; width: number; height: number }>; totalHeight: number } {
  const config = TREE_LAYOUT_CONFIG;
  const sortedNodes = [...nodes].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const centerX = 400; // Center of modal
  let currentY = config.padding;

  const layoutedNodes = sortedNodes.map(node => {
    const height = getNodeHeight(node);
    const width = config.nodeWidth;
    const result = {
      ...node,
      x: centerX - width / 2,
      y: currentY,
      width,
      height,
    };
    currentY += height + config.verticalGap;
    return result;
  });

  return { layoutedNodes, totalHeight: currentY };
}

/**
 * Convert sub-agent workflow to React Flow format.
 */
function convertSubAgentToReactFlow(
  workflowData: WorkflowGraphSnapshot,
  agentId: string,
  onImageClick: (image: { mediaType: string; data: string }) => void
): { nodes: Node[]; edges: Edge[]; totalHeight: number; agentInfo: WFNode['subAgentInfo'] } {
  // Find nodes and edges for this sub-agent
  const laneId = `agent-${agentId.substring(0, 8)}`;
  const subAgentNodes = workflowData.nodes.filter(n => n.laneId === laneId || n.agentId === agentId);
  const subAgentNodeIds = new Set(subAgentNodes.map(n => n.id));
  const subAgentEdges = workflowData.edges.filter(
    e => subAgentNodeIds.has(e.source) && subAgentNodeIds.has(e.target)
  );

  // Find agent info from the container node
  const containerNode = workflowData.nodes.find(
    n => n.isSubAgentContainer && n.subAgentInfo?.agentId === agentId
  );
  const agentInfo = containerNode?.subAgentInfo;

  // Layout nodes
  const { layoutedNodes, totalHeight } = layoutSubAgentNodes(subAgentNodes);

  // Build position map for edges
  const positions = new Map(
    layoutedNodes.map(n => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }])
  );

  // Convert to React Flow nodes
  const reactFlowNodes: Node[] = layoutedNodes.map(node => ({
    id: node.id,
    type: 'workflow',
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
      isHighlighted: false,
      toolResultPreview: node.toolResultPreview,
      toolResultStatus: node.toolResultStatus,
      toolResultStdout: node.toolResultStdout,
      toolResultStderr: node.toolResultStderr,
      // Image content
      images: node.images,
      onImageClick,
    },
    style: { width: node.width },
  }));

  // Convert edges
  const reactFlowEdges: Edge[] = subAgentEdges
    .filter(e => positions.has(e.source) && positions.has(e.target))
    .map(edge => ({
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
        isCurrent: false,
      },
    }));

  return { nodes: reactFlowNodes, edges: reactFlowEdges, totalHeight, agentInfo };
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format token count with K/M suffix.
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

/**
 * Format agent type for display.
 */
function formatAgentType(type?: string): string {
  if (!type) return 'Sub-Agent';
  const formatted = type
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return formatted.includes('Agent') ? formatted : `${formatted} Agent`;
}

export function SubAgentModal({
  open,
  onClose,
  agentId,
  workflowData,
}: SubAgentModalProps) {
  const [modalImage, setModalImage] = useState<{ mediaType: string; data: string } | null>(null);

  // Handle image click for full-size modal
  const handleImageClick = useCallback((image: { mediaType: string; data: string }) => {
    setModalImage(image);
  }, []);

  // Convert sub-agent data to React Flow format
  const { nodes, edges, agentInfo } = useMemo(() => {
    if (!agentId) {
      return { nodes: [], edges: [], totalHeight: 0, agentInfo: undefined };
    }
    return convertSubAgentToReactFlow(workflowData, agentId, handleImageClick);
  }, [workflowData, agentId, handleImageClick]);

  if (!agentId) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        {/* Custom Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-purple-800">
                {formatAgentType(agentInfo?.subagentType)}
              </DialogTitle>
              {agentInfo?.promptPreview && (
                <p className="text-sm text-slate-500 max-w-md truncate">
                  &ldquo;{agentInfo.promptPreview}...&rdquo;
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" size="icon" className="border-0 hover:bg-slate-100" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Metrics Bar */}
        {agentInfo && (
          <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 border-b text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{formatDuration(agentInfo.totalDurationMs)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Sparkles className="w-4 h-4 text-slate-400" />
              <span>{formatTokens(agentInfo.totalTokens)} tokens</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Wrench className="w-4 h-4 text-slate-400" />
              <span>{agentInfo.totalToolCalls} tool calls</span>
            </div>
            <div className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
              agentInfo.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {agentInfo.status === 'completed' ? 'Completed' : 'Failed'}
            </div>
          </div>
        )}

        {/* Workflow Graph */}
        <div className="flex-1 relative">
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-medium text-slate-700">
                  No sub-agent workflow data
                </div>
                <div className="text-sm text-slate-500">
                  Sub-agent logs may not have been uploaded
                </div>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={workflowNodeTypes}
              edgeTypes={workflowEdgeTypes}
              fitView
              fitViewOptions={{ padding: 0.3, minZoom: 0.3 }}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} color="#f1f5f9" />
              <Controls showInteractive={false} position="bottom-right" />
            </ReactFlow>
          )}
        </div>

        {/* Image Modal */}
        {modalImage && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
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
      </DialogContent>
    </Dialog>
  );
}
