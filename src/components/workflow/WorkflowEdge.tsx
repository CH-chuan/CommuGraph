'use client';

/**
 * WorkflowEdge - Edge component for workflow visualization
 *
 * Features:
 * - Duration-based coloring (green -> yellow -> orange -> red)
 * - Animated dashed line for current step
 * - Arrow markers
 * - Duration label on hover
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { getDurationColor } from '@/utils/workflow-layout';

// Edge data interface
export interface WorkflowEdgeData {
  durationMs: number;
  durationClass: string;
  isParallel: boolean;
  isCrossLane: boolean;
  stepIndex: number;
  isCurrent?: boolean;
}

/**
 * Format duration for display.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Workflow Edge Component
 */
function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as unknown as WorkflowEdgeData | undefined;
  const durationClass = edgeData?.durationClass || 'fast';
  const durationMs = edgeData?.durationMs || 0;
  const isCurrent = edgeData?.isCurrent || false;
  const isCrossLane = edgeData?.isCrossLane || false;

  // Get edge color based on duration
  const strokeColor = getDurationColor(durationClass);

  // Calculate edge path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  // Edge styling
  const strokeWidth = isCurrent ? 3 : selected ? 2.5 : 2;
  const strokeDasharray = isCurrent ? '8 4' : undefined;
  const opacity = isCurrent ? 1 : 0.8;

  return (
    <>
      {/* Arrow marker definition */}
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="12"
          markerHeight="12"
          refX="8"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M2,2 L10,6 L2,10 L4,6 Z"
            fill={strokeColor}
            opacity={opacity}
          />
        </marker>
      </defs>

      {/* Edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          opacity,
        }}
        markerEnd={`url(#arrow-${id})`}
      />

      {/* Cross-lane indicator (dashed) */}
      {isCrossLane && (
        <BaseEdge
          id={`${id}-crosslane`}
          path={edgePath}
          style={{
            stroke: '#EC4899', // Pink for cross-lane
            strokeWidth: 1,
            strokeDasharray: '4 4',
            opacity: 0.5,
          }}
        />
      )}

      {/* Duration label (shown on hover via CSS) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="workflow-edge-label"
        >
          <div
            className={`
              px-1.5 py-0.5 rounded text-xs font-medium
              bg-white border shadow-sm
              opacity-0 hover:opacity-100 transition-opacity
              ${selected ? 'opacity-100' : ''}
            `}
            style={{ borderColor: strokeColor, color: strokeColor }}
          >
            {formatDuration(durationMs)}
          </div>
        </div>
      </EdgeLabelRenderer>

      {/* Current step animation */}
      {isCurrent && (
        <circle r="4" fill={strokeColor}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  );
}

export const WorkflowEdge = memo(WorkflowEdgeComponent);

// Export edge types for React Flow
export const workflowEdgeTypes = {
  workflow: WorkflowEdge,
};
