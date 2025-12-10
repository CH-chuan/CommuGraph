/**
 * GhostEdge - Temporal Edge Component with Visual Recession
 *
 * Design spec (Ghost Trails):
 * - Current (t):   100% opacity, 4px thickness, dashed flow animation, Orange color, Smart Routing
 * - Recent (t-1):  60% opacity, 2px thickness, static, Source Color
 * - History (t-n): 20% opacity, 1px thickness, static, Slate
 */

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath, useNodes } from '@xyflow/react';
import { getSmartEdge } from '@tisoap/react-flow-smart-edge';

export interface GhostEdgeData {
  interactions: Array<{ step_index: number }>;
  weight: number;
  isBidirectional?: boolean;
  currentStep?: number;
  latestInteractionStep?: number;
  isFocused?: boolean;
  currentInteractionCount?: number;
  sourceColor?: string;
}

// Determine edge visual state based on temporal distance
type EdgeState = 'current' | 'recent' | 'history';

const getEdgeState = (latestStep: number, currentStep: number): EdgeState => {
  const distance = currentStep - latestStep;
  if (distance <= 0) return 'current';
  if (distance === 1) return 'recent';
  return 'history';
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
  const nodes = useNodes();
  const edgeData = data as GhostEdgeData | undefined;
  const isBidirectional = edgeData?.isBidirectional ?? false;
  const currentStep = edgeData?.currentStep ?? 0;
  const latestInteractionStep = edgeData?.latestInteractionStep ?? 0;
  const isFocused = edgeData?.isFocused ?? false;
  const currentInteractionCount = edgeData?.currentInteractionCount ?? 0;
  const sourceColor = edgeData?.sourceColor || '#64748b';

  // Determine edge state
  const edgeState = getEdgeState(latestInteractionStep, currentStep);

  // Style configurations
  // Current: Orange, Thick
  // Recent: Source Color, Medium
  // History: Slate, Thin
  let strokeColor = '#64748b';
  let strokeWidth = 1;
  let opacity = 0.2;
  let dashArray = undefined;

  switch (edgeState) {
    case 'current':
      strokeColor = '#f97316'; // Orange
      strokeWidth = 5;
      opacity = 1; // Fully opaque
      dashArray = '10 5'; // Tighter dash for better "ink" ratio
      break;
    case 'recent':
      strokeColor = sourceColor; // Source node color
      strokeWidth = 4;
      opacity = 1; // Fully opaque
      break;
    case 'history':
      strokeColor = '#94a3b8'; // Slate 400
      strokeWidth = 2;
      opacity = 0.4;
      break;
  }

  // Override for focused state
  const hasFocusedEdge = data && 'isFocused' in data && data.isFocused !== undefined;
  if (isFocused) {
    strokeColor = '#10b981'; // Emerald 500
    strokeWidth = 6;
    opacity = 1;
    dashArray = '10 5';
  } else if (hasFocusedEdge) {
    opacity = 0.1; // Dim others
  }

  // Calculate Path using Smart Edge
  const smartEdgeResult = getSmartEdge({
    sourcePosition,
    targetPosition,
    sourceX,
    sourceY,
    targetX,
    targetY,
    nodes,
    options: {
      nodePadding: 40, // Reduced curvature near nodes to align arrows better
      gridRatio: 10,
    }
  });

  // Fallback to smooth step
  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (smartEdgeResult && 'svgPathString' in smartEdgeResult) {
    edgePath = smartEdgeResult.svgPathString;
    labelX = smartEdgeResult.edgeCenterX;
    labelY = smartEdgeResult.edgeCenterY;
  } else {
    // Manual fallback with offset for bidirectional
    const offset = isBidirectional ? 20 : 0; // Increased offset

    // Perpendicular offset calculation for smoothstep fallback
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / length;
    const perpY = dx / length;

    const offsetSourceX = sourceX + perpX * offset;
    const offsetSourceY = sourceY + perpY * offset;
    const offsetTargetX = targetX + perpX * offset;
    const offsetTargetY = targetY + perpY * offset;

    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX: offsetSourceX,
      sourceY: offsetSourceY,
      sourcePosition,
      targetX: offsetTargetX,
      targetY: offsetTargetY,
      targetPosition,
      borderRadius: 12, // Increased radius
    });
  }

  // Merged edge style for the BaseEdge (which works as the Rail or main line)
  // If current, we want a solid Rail first, then the Flow on top.
  // BaseEdge in React Flow usually renders the 'interaction' invisible path + the visible stroke.
  // We can treat BaseEdge as the "Rail" if we style it as solid/lighter,
  // then add a custom <path> on top for the Flow.

  // CURRENT STRATEGY:
  // BaseEdge: Used as the "Rail" (solid background) for Current/Focused.
  //           Used as normal solid line for Recent/History.
  // Overlay <path>: Used as "Flow" (dashed animation) for Current/Focused.

  let railStyle = { ...style, strokeWidth, opacity };

  if (edgeState === 'current' || isFocused) {
    // RAIL STYLE (Solid, lighter)
    // For Orange 700 flow, use Orange 200/300 for rail
    const railColor = isFocused ? '#d1fae5' : '#fed7aa'; // Emerald 100 or Orange 200
    railStyle = {
      ...railStyle,
      stroke: railColor,
      strokeDasharray: undefined, // Solid
      opacity: 1, // Rail is solid 
    };
  } else {
    // STANDARD STYLE
    railStyle = {
      ...railStyle,
      stroke: strokeColor,
      strokeDasharray: dashArray,
      opacity,
    };
  }

  // Custom Arrow Head - Extra small for current/focused (5x5), regular for others (5x5)
  // Current step arrows are more subtle to avoid visual clutter
  const arrowSize = (edgeState === 'current' || isFocused) ? 5 : 5;
  const arrowId = `arrow-${id}`;

  return (
    <>
      {/* SVG Marker Definition - Positioned at edge end with original orientation */}
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={strokeColor}
          />
        </marker>
      </defs>

      {/* Base Layer / Rail */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#${arrowId})`}
        style={railStyle}
      />

      {/* Top Layer / Flow (Current or Focused only) */}
      {(edgeState === 'current' || isFocused) && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          markerEnd={`url(#${arrowId})`}
          className="animate-dash-flow"
          style={{ opacity: 1 }}
        />
      )}

      <EdgeLabelRenderer>
        {/* Label (Interaction Count) */}
        {(isFocused || (label && edgeState !== 'history')) && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan"
          >
            <div
              className={`
                px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md border-2
              `}
              style={{
                backgroundColor: isFocused ? '#10b981' : (edgeState === 'current' ? '#ffffff' : '#ffffff'),
                color: isFocused ? '#fff' : strokeColor,
                borderColor: strokeColor,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              }}
            >
              {isFocused ? `${currentInteractionCount}` : label}
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
