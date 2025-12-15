'use client';

/**
 * AnnotationView - Main annotation visualization component
 *
 * Vertical sequence view for Claude Code annotation records
 * Features:
 * - Linear vertical layout (conversation flow)
 * - User turns (blue) and assistant turns (purple)
 * - Label slots for annotation
 * - Expandable thinking/tool sections
 * - Custom vertical scrollbar synced with viewport
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useOnViewportChange,
  type Node,
  type Edge,
  type Viewport,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { annotationNodeTypes, type AnnotationNodeData } from './AnnotationNode';
import type { AnnotationRecord } from '@/lib/annotation/types';

// Layout configuration
const LAYOUT_CONFIG = {
  nodeWidth: 400,
  nodeSpacing: 120,       // Vertical space between rows
  horizontalSpacing: 50,  // Horizontal space between consecutive assistant turns
  startY: 50,
  startX: 600,            // Base X position (allows horizontal expansion to both sides)
};

interface AnnotationViewProps {
  annotations: AnnotationRecord[];
  highlightedIndex?: number | null;
  focusIndex?: number | null;
  onNodeClick?: (index: number) => void;
  onFocusHandled?: () => void;
}

/**
 * Row type for grouping annotations
 * - User turns are always in their own row
 * - Consecutive assistant turns are grouped in a horizontal row
 */
interface LayoutRow {
  records: AnnotationRecord[];
  indices: number[];
}

/**
 * Convert annotation records to React Flow nodes and edges
 *
 * Layout algorithm:
 * - User turns: single node, centered
 * - Consecutive assistant turns: laid out horizontally (left to right)
 * - Vertical edges connect first node in each row (main flow on left)
 * - Horizontal edges connect consecutive assistant turns within a row
 */
function convertToReactFlow(
  annotations: AnnotationRecord[],
  highlightedIndex: number | null,
  onImageClick: (image: { mediaType: string; data: string }) => void
): { nodes: Node[]; edges: Edge[]; totalHeight: number } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Group annotations into rows
  const rows: LayoutRow[] = [];
  let assistantRow: LayoutRow = { records: [], indices: [] };

  annotations.forEach((record, index) => {
    if (record.unit_type === 'user_turn' || record.unit_type === 'system_turn') {
      // User turn and system turn always start a new row (by themselves)
      // First, push any pending assistant row
      if (assistantRow.records.length > 0) {
        rows.push(assistantRow);
        assistantRow = { records: [], indices: [] };
      }
      rows.push({ records: [record], indices: [index] });
    } else {
      // Assistant turn - group consecutive ones
      assistantRow.records.push(record);
      assistantRow.indices.push(index);
    }
  });
  // Don't forget the last assistant row if it exists
  if (assistantRow.records.length > 0) {
    rows.push(assistantRow);
  }

  // Layout rows
  let currentY = LAYOUT_CONFIG.startY;

  rows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(...row.records.map(r => estimateNodeHeight(r)));
    const nodeCount = row.records.length;

    // Calculate starting X for this row (center the group)
    const totalWidth = nodeCount * LAYOUT_CONFIG.nodeWidth +
                       (nodeCount - 1) * LAYOUT_CONFIG.horizontalSpacing;
    const rowStartX = LAYOUT_CONFIG.startX - totalWidth / 2 + LAYOUT_CONFIG.nodeWidth / 2;

    row.records.forEach((record, nodeIndexInRow) => {
      const globalIndex = row.indices[nodeIndexInRow];
      const x = rowStartX + nodeIndexInRow * (LAYOUT_CONFIG.nodeWidth + LAYOUT_CONFIG.horizontalSpacing);

      const nodeData: AnnotationNodeData = {
        record,
        sequenceIndex: globalIndex + 1,
        isHighlighted: highlightedIndex === globalIndex,
        onImageClick,
      };

      nodes.push({
        id: record.event_id,
        type: 'annotation',
        position: { x, y: currentY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: nodeData as unknown as Record<string, unknown>,
        style: {
          width: LAYOUT_CONFIG.nodeWidth,
        },
      });

      // Horizontal edge to next node in same row (for consecutive assistant turns)
      if (nodeIndexInRow < row.records.length - 1) {
        edges.push({
          id: `edge-h-${rowIndex}-${nodeIndexInRow}`,
          source: record.event_id,
          target: row.records[nodeIndexInRow + 1].event_id,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'straight',
          style: {
            stroke: '#a78bfa', // Purple to match assistant theme
            strokeWidth: 2,
            strokeDasharray: '5,5', // Dashed line for horizontal flow
          },
          animated: false,
        });
      }
    });

    // Vertical edge to next row
    // - If current row is user_turn or system_turn: connect to FIRST (leftmost) node in next row
    // - If current row is assistant_turn(s): connect LAST (rightmost) node to next row's first
    if (rowIndex < rows.length - 1) {
      const isCurrentRowSingleNode = row.records[0].unit_type === 'user_turn' || row.records[0].unit_type === 'system_turn';
      const sourceNode = isCurrentRowSingleNode
        ? row.records[0]  // User/System connects from itself
        : row.records[row.records.length - 1];  // Assistant row: rightmost connects out
      const targetNode = rows[rowIndex + 1].records[0];  // Always connect to first/leftmost of next row

      edges.push({
        id: `edge-v-${rowIndex}`,
        source: sourceNode.event_id,
        target: targetNode.event_id,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'smoothstep',
        style: {
          stroke: '#94a3b8',
          strokeWidth: 2,
        },
        animated: false,
      });
    }

    currentY += rowHeight + LAYOUT_CONFIG.nodeSpacing;
  });

  return { nodes, edges, totalHeight: currentY };
}

/**
 * Estimate node height based on content for layout
 */
function estimateNodeHeight(record: AnnotationRecord): number {
  let height = 100; // Base height (header + label slot)

  const ref = record.text_or_artifact_ref;

  // Text content
  if (ref?.text) {
    const lines = Math.min(4, Math.ceil(ref.text.length / 60));
    height += lines * 20;
  }

  // Tool calls (collapsed by default)
  if (ref?.tool_calls && ref.tool_calls.length > 0) {
    height += 30; // Tool call header
  }

  // Thinking (collapsed by default)
  if (ref?.thinking) {
    height += 30; // Thinking header
  }

  // Timestamp
  if (record.timestamp) {
    height += 25;
  }

  return Math.max(height, 120); // Minimum height
}

/**
 * Custom Vertical Scrollbar Component
 * Syncs with ReactFlow viewport position
 */
interface ScrollbarProps {
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function VerticalScrollbar({ totalHeight, containerRef }: ScrollbarProps) {
  const { setViewport, getViewport } = useReactFlow();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(20);
  const [isDragging, setIsDragging] = useState(false);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ y: 0, scrollPos: 0 });

  // Track viewport changes
  useOnViewportChange({
    onChange: (viewport: Viewport) => {
      if (!containerRef.current || isDragging) return;

      const containerHeight = containerRef.current.clientHeight;
      const zoom = viewport.zoom;
      const scaledTotalHeight = totalHeight * zoom;
      const viewableHeight = containerHeight;

      // Calculate thumb size based on how much content is visible
      const visibleRatio = Math.min(1, viewableHeight / scaledTotalHeight);
      setThumbHeight(Math.max(30, visibleRatio * (containerHeight - 20)));

      // Calculate scroll position (0 to 1)
      const maxScroll = scaledTotalHeight - viewableHeight;
      if (maxScroll > 0) {
        const currentScroll = -viewport.y;
        setScrollPosition(Math.max(0, Math.min(1, currentScroll / maxScroll)));
      } else {
        setScrollPosition(0);
      }
    },
  });

  // Handle scrollbar track click
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrollbarRef.current || !containerRef.current) return;

      const rect = scrollbarRef.current.getBoundingClientRect();
      const clickY = e.clientY - rect.top - 10; // Account for padding
      const trackHeight = rect.height - 20 - thumbHeight;
      const newPosition = Math.max(0, Math.min(1, clickY / trackHeight));

      // Update local scroll position state
      setScrollPosition(newPosition);

      const viewport = getViewport();
      const containerHeight = containerRef.current.clientHeight;
      const zoom = viewport.zoom;
      const scaledTotalHeight = totalHeight * zoom;
      const maxScroll = scaledTotalHeight - containerHeight;

      setViewport({
        x: viewport.x,
        y: -newPosition * maxScroll,
        zoom: viewport.zoom,
      });
    },
    [getViewport, setViewport, totalHeight, thumbHeight, containerRef]
  );

  // Handle thumb drag
  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = { y: e.clientY, scrollPos: scrollPosition };
    },
    [scrollPosition]
  );

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollbarRef.current || !containerRef.current) return;

      const rect = scrollbarRef.current.getBoundingClientRect();
      const trackHeight = rect.height - 20 - thumbHeight;
      const deltaY = e.clientY - dragStartRef.current.y;
      const deltaPosition = deltaY / trackHeight;
      const newPosition = Math.max(0, Math.min(1, dragStartRef.current.scrollPos + deltaPosition));

      // Update local scroll position state for thumb rendering
      setScrollPosition(newPosition);

      const viewport = getViewport();
      const containerHeight = containerRef.current.clientHeight;
      const zoom = viewport.zoom;
      const scaledTotalHeight = totalHeight * zoom;
      const maxScroll = scaledTotalHeight - containerHeight;

      setViewport({
        x: viewport.x,
        y: -newPosition * maxScroll,
        zoom: viewport.zoom,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getViewport, setViewport, totalHeight, thumbHeight, containerRef]);

  // Track the scrollbar height for thumb position calculation
  const [scrollbarHeight, setScrollbarHeight] = useState(0);

  // Update scrollbar height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (scrollbarRef.current) {
        setScrollbarHeight(scrollbarRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Calculate thumb position
  const trackHeight = Math.max(0, scrollbarHeight - 20 - thumbHeight);
  const thumbTop = 10 + scrollPosition * trackHeight;

  return (
    <div
      ref={scrollbarRef}
      className="absolute right-0 top-0 bottom-0 w-4 bg-slate-100 border-l border-slate-200 cursor-pointer z-10"
      onClick={handleTrackClick}
    >
      {/* Scrollbar thumb */}
      <div
        className={`absolute right-1 w-2 rounded-full transition-colors ${
          isDragging ? 'bg-slate-500' : 'bg-slate-400 hover:bg-slate-500'
        }`}
        style={{
          top: thumbTop,
          height: thumbHeight,
        }}
        onMouseDown={handleThumbMouseDown}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * Inner AnnotationView with ReactFlow hooks access
 */
interface InnerAnnotationViewProps {
  nodes: Node[];
  edges: Edge[];
  totalHeight: number;
  focusIndex?: number | null;
  onNodeClick?: (index: number) => void;
  onFocusHandled?: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function InnerAnnotationView({
  nodes,
  edges,
  totalHeight,
  focusIndex,
  onNodeClick,
  onFocusHandled,
  containerRef,
}: InnerAnnotationViewProps) {
  const { setCenter, getNodes } = useReactFlow();

  // Handle focus on node when focusIndex changes (from chat log double-click)
  useEffect(() => {
    if (focusIndex === null || focusIndex === undefined) return;

    // Find the node with this index (sequenceIndex is 1-based)
    const targetNode = getNodes().find(
      (n) => (n.data as unknown as AnnotationNodeData).sequenceIndex === focusIndex + 1
    );

    if (targetNode) {
      // Center on the node with animation
      const nodeWidth = (targetNode.style?.width as number) || 400;
      const nodeHeight = 150; // Approximate node height
      setCenter(
        targetNode.position.x + nodeWidth / 2,
        targetNode.position.y + nodeHeight / 2,
        { zoom: 0.8, duration: 500 }
      );
    }

    // Clear the focus after centering
    if (onFocusHandled) {
      onFocusHandled();
    }
  }, [focusIndex, setCenter, getNodes, onFocusHandled]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        const nodeData = node.data as unknown as AnnotationNodeData;
        const index = nodeData.sequenceIndex - 1;
        onNodeClick(index);
      }
    },
    [onNodeClick]
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={annotationNodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.05 }}
        minZoom={0.02}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
      >
        <Background gap={20} size={1} color="#f1f5f9" />
        <Controls showInteractive={false} position="bottom-right" className="!right-6" />
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            const data = node.data as unknown as AnnotationNodeData;
            if (data.record.unit_type === 'user_turn') return '#3B82F6'; // Blue
            if (data.record.unit_type === 'system_turn') return '#94A3B8'; // Slate/Grey
            return '#8B5CF6'; // Purple (assistant)
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
      <VerticalScrollbar totalHeight={totalHeight} containerRef={containerRef} />
    </>
  );
}

/**
 * AnnotationView Component
 */
export function AnnotationView({
  annotations,
  highlightedIndex = null,
  focusIndex = null,
  onNodeClick,
  onFocusHandled,
}: AnnotationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalImage, setModalImage] = useState<{ mediaType: string; data: string } | null>(null);

  // Handle image click for full-size modal
  const handleImageClick = useCallback((image: { mediaType: string; data: string }) => {
    setModalImage(image);
  }, []);

  // Convert data to React Flow format
  const { nodes, edges, totalHeight } = useMemo(
    () => convertToReactFlow(annotations, highlightedIndex, handleImageClick),
    [annotations, highlightedIndex, handleImageClick]
  );

  if (annotations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-700">
            No dialog records
          </div>
          <div className="text-sm text-slate-500">
            Upload a Claude Code log to see dialog units
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ReactFlowProvider>
        <InnerAnnotationView
          nodes={nodes}
          edges={edges}
          totalHeight={totalHeight}
          focusIndex={focusIndex}
          onNodeClick={onNodeClick}
          onFocusHandled={onFocusHandled}
          containerRef={containerRef}
        />
      </ReactFlowProvider>

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
