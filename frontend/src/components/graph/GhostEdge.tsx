/**
 * GhostEdge - Temporal Edge Component with Visual Recession
 *
 * Design spec (Ghost Trails):
 * - Current (t):   100% opacity, 4px thickness, dashed flow animation
 * - Recent (t-1):  60% opacity, 2px thickness, static
 * - History (t-n): 20% opacity, 1px thickness, static
 */

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from '@xyflow/react';

export interface GhostEdgeData {
  interactions: Array<{ step_index: number }>;
  weight: number;
  isBidirectional?: boolean;
  currentStep?: number;
  latestInteractionStep?: number;
  isFocused?: boolean;
  currentInteractionCount?: number;
}

// Determine edge visual state based on temporal distance
type EdgeState = 'current' | 'recent' | 'history';

const getEdgeState = (latestStep: number, currentStep: number): EdgeState => {
  const distance = currentStep - latestStep;
  if (distance <= 0) return 'current';
  if (distance === 1) return 'recent';
  return 'history';
};

// Style configurations for each state
const edgeStyles: Record<EdgeState, { opacity: number; strokeWidth: number; dashArray?: string }> = {
  current: { opacity: 1, strokeWidth: 4, dashArray: '8 4' },
  recent: { opacity: 0.6, strokeWidth: 2 },
  history: { opacity: 0.2, strokeWidth: 1 },
};

export function GhostEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  data,
  style,
}: EdgeProps) {
  const edgeData = data as GhostEdgeData | undefined;
  const isBidirectional = edgeData?.isBidirectional ?? false;
  const currentStep = edgeData?.currentStep ?? 0;
  const latestInteractionStep = edgeData?.latestInteractionStep ?? 0;
  const isFocused = edgeData?.isFocused ?? false;
  const currentInteractionCount = edgeData?.currentInteractionCount ?? 0;

  // Determine edge state
  const edgeState = getEdgeState(latestInteractionStep, currentStep);
  const stateStyle = edgeStyles[edgeState];

  // Check if any edge is focused (if so, dim non-focused edges)
  const hasFocusedEdge = data && 'isFocused' in data && data.isFocused !== undefined;

  // Add offset for bidirectional edges to prevent overlap
  const offset = isBidirectional ? 15 : 0;

  // Calculate perpendicular offset
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / length;
  const perpY = dx / length;

  // Apply offset
  const offsetSourceX = sourceX + perpX * offset;
  const offsetSourceY = sourceY + perpY * offset;
  const offsetTargetX = targetX + perpX * offset;
  const offsetTargetY = targetY + perpY * offset;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: offsetSourceX,
    sourceY: offsetSourceY,
    sourcePosition,
    targetX: offsetTargetX,
    targetY: offsetTargetY,
    targetPosition,
    borderRadius: 8,
  });

  // Determine visual styling
  let finalOpacity = stateStyle.opacity;
  let finalStrokeWidth = stateStyle.strokeWidth;
  let finalStroke = edgeState === 'current' ? '#3b82f6' : '#64748b';

  // If this edge is focused, enhance it
  if (isFocused) {
    finalOpacity = 1;
    finalStrokeWidth = Math.max(stateStyle.strokeWidth, 5);
    finalStroke = '#10b981'; // Emerald green for focused edges
  } else if (hasFocusedEdge && !isFocused) {
    // Dim non-focused edges when there's a focus
    finalOpacity = stateStyle.opacity * 0.15;
  }

  // Merged styles
  const mergedStyle = {
    ...style,
    strokeWidth: finalStrokeWidth,
    opacity: finalOpacity,
    strokeDasharray: stateStyle.dashArray,
    stroke: finalStroke,
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={mergedStyle} />

      {/* Animated dash for current or focused edges */}
      {(edgeState === 'current' || isFocused) && (
        <path
          d={edgePath}
          fill="none"
          stroke={isFocused ? '#10b981' : '#3b82f6'}
          strokeWidth={finalStrokeWidth}
          strokeDasharray="8 4"
          strokeLinecap="round"
          className="animate-dash-flow"
        />
      )}

      <EdgeLabelRenderer>
        {/* Always show label when focused, otherwise show for current/recent edges */}
        {(isFocused || (label && edgeState !== 'history')) && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={`
                px-2.5 py-1 rounded-full text-xs font-bold
                ${isFocused ? 'bg-emerald-500 text-white shadow-lg' :
                  edgeState === 'current' ? 'bg-blue-500 text-white' :
                  'bg-slate-100 text-slate-600'}
              `}
            >
              {isFocused ? `${currentInteractionCount}` : label}
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
