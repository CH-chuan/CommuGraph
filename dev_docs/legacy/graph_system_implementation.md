# Graph System Implementation Guide

**Version:** 2.1
**Last Updated:** December 10, 2025
**Scope:** Frontend Graph Visualization (Topology Mode)

## 1. Overview
The CommuGraph visualization engine provides interactive temporal graph visualization with rich nodes, smart edge routing, and cross-component highlighting. This document details the technical implementation of the graph system including the "Rail & Flow" visual pattern, smart routing logic, and interactive features.

## 2. Visual Design Pattern: "Rail & Flow"
To ensure high visibility of animated edges on white backgrounds, we implemented a dual-layer rendering strategy for active edges.

### Concept
*   **The Rail (Base Layer):** A solid, light-colored background line that acts as the track. Rendered using React Flow's `BaseEdge` component.
*   **The Flow (Top Layer):** A high-contrast, opaque, dashed line with CSS animation that rides on top of the rail.

### Styling Specification
| Edge State | Color | Width | Opacity | Layering | Animation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Current ($t$)** | **Orange** (`#f97316`) | **5px** | **100%** | Rail (`#fed7aa`) + Dashed Flow | `.animate-dash-flow` |
| **Recent ($t-1$)** | **Source Node Color** (agent-specific) | 4px | **100%** | Single Solid Layer | None |
| **History ($t-n$)** | Slate (`#94a3b8`) | 2px | 40% | Single Solid Layer | None |
| **Focused** | **Emerald** (`#10b981`) | 6px | **100%** | Rail (`#d1fae5`) + Dashed Flow | `.animate-dash-flow` |

## 3. Smart Routing & Layout
We use a hybrid approach combining Dagre (for node positioning) with Smart Edge (for obstacle avoidance) and custom handle logic (for bidirectional edges and cycles).

### A. Node Layout (Dagre)
*   **Algorithm:** `dagre` (Directed Graph)
*   **Rank Direction:** Left-to-Right (`LR`)
*   **Node Dimensions:** Fixed `180px` x `90px` to accommodate rich card nodes
*   **Spacing:** Configured for optimal visibility and routing space

### B. Obstacle Avoidance (Smart Edge)
*   **Library:** `@tisoap/react-flow-smart-edge`
*   **Function:** `getSmartEdge` calculates paths that route *around* nodes rather than cutting through them
*   **Configuration:**
    *   `gridRatio: 10` - Grid resolution for pathfinding
    *   `nodePadding: 40px` - Ensures edges enter nodes straight, improving arrow alignment
*   **Fallback:** If smart routing fails, falls back to `getSmoothStepPath` with perpendicular offset for bidirectional edges

### C. Bidirectional Edge Handling
When two agents communicate in both directions (A→B and B→A), edges need to be visually separated to prevent overlap.

**Logic in `GhostEdge.tsx`:**
1.  **Detection:** Edge data includes `isBidirectional` flag from backend
2.  **Strategy (Fallback Mode):**
    *   Calculate perpendicular offset (20px) based on edge direction
    *   Offset both source and target points
    *   Apply to `getSmoothStepPath` with increased `borderRadius: 12`

### D. Multiple Connection Handles
Nodes have multiple handles to support flexible routing and prevent edge crossings:

**Handle Configuration in `AgentNode.tsx`:**
*   **Left Side:**
    *   `left` (target) - Primary inputs at 30% height
    *   `left-source` (source) - Back-edge outputs at 70% height
*   **Right Side:**
    *   `right` (source) - Primary outputs
*   **Top Side:**
    *   `top-target` (target) - Vertical/diagonal inputs
*   **Bottom Side:**
    *   `bottom-target` (target) - Loop returns at 40% width
    *   `bottom-source` (source) - Loop outputs at 60% width

## 4. Component Architecture

### `GraphView.tsx` - Main Container
The top-level React Flow integration component.

**Responsibilities:**
*   React Flow setup with custom node and edge types
*   Data fetching via `useGraphData` hook
*   State management for focus mode (`focusedAgentId`)
*   Integration with `AppContext` for cross-component highlighting
*   Layout calculation via `getLayoutedElements`

**Key Features:**
*   **Focus Mode:** Double-click node to highlight its outgoing edges (emerald green)
*   **Clear Focus:** Single-click any node to clear focus
*   **Auto-Clear:** Focus clears on timeline changes or hover events (chat log, timeline)
*   **Node Coloring:** Maintains agent-specific color palette across all components

**Event Handlers:**
```typescript
onNodeClick={() => setFocusedAgentId(null)}          // Clear focus
onNodeDoubleClick((_, node) => setFocusedAgentId(...)) // Toggle focus
```

### `AgentNode.tsx` - Rich Card Nodes
The custom Node component displaying agent cards.

**Data Structure:**
```typescript
interface AgentNodeData {
  label: string;
  message_count: number;        // Deprecated, kept for backwards compatibility
  messages_sent: number;         // Time-based count up to current step
  messages_received: number;     // Time-based count up to current step
  status?: 'idle' | 'generating' | 'waiting' | 'tool_use';
  role?: string;
  activeTool?: string | null;
  isHighlighted?: boolean;
  color?: string;
}
```

**Visual Elements:**
1.  **Header:**
    *   Role-based icon (User, Cpu, Bot, MessageSquare) with agent color background
    *   Agent name (bold, truncated)
    *   **Time-based message counts**: "X sent, Y recv" (dynamically calculated based on currentStep - only counts messages up to current timeline position)

2.  **Status Pill:**
    *   Color-coded by status (idle: slate, generating: emerald with pulse, waiting: amber, tool_use: blue)
    *   Animated pulse dot for "generating" state

3.  **Tool Drawer:**
    *   Slides out at bottom when `activeTool` is set
    *   Shows spinning gear icon with tool name

4.  **Border Highlight:**
    *   Default: Light slate border
    *   Selected: Agent color border
    *   Highlighted: Ring with agent color (from cross-component hover)

**Connection Handles:**
*   8 handles total for flexible routing (see Section 3.D for details)
*   Positioned strategically to support bidirectional flows and loops

### `GhostEdge.tsx` - Temporal Edges
The custom Edge component with temporal visual states.

**Data Structure:**
```typescript
interface GhostEdgeData {
  interactions: Array<{ step_index: number }>;
  weight: number;
  isBidirectional?: boolean;
  currentStep?: number;
  latestInteractionStep?: number;
  isFocused?: boolean;
  currentInteractionCount?: number;
  sourceColor?: string;
}
```

**Rendering Logic:**
1.  **Determine Edge State:**
    ```typescript
    const distance = currentStep - latestInteractionStep;
    if (distance <= 0) return 'current';   // Active now
    if (distance === 1) return 'recent';    // Just happened
    return 'history';                       // In the past
    ```

2.  **Calculate Path:**
    *   Primary: `getSmartEdge` with obstacle avoidance
    *   Fallback: `getSmoothStepPath` with bidirectional offset

3.  **Render Layers:**
    *   `<BaseEdge>` - Rail layer (always rendered)
    *   `<path>` - Flow layer (current/focused only) with `animate-dash-flow` CSS class
    *   **Edge label** with interaction count badge:
        *   Solid white background (`#ffffff`)
        *   Strong shadow: `0 2px 8px rgba(0, 0, 0, 0.25)`
        *   Z-index: 1000 (always renders above edges)
        *   Border: 2px with edge color
        *   Shown for focused/current/recent states

4.  **Focus Override:**
    *   When `isFocused=true`: Emerald color, 6px width, dashed animation
    *   When focus exists but edge not focused: Dimmed to 10% opacity

**Arrow Markers:**
*   Uses React Flow's native `markerEnd` with `type: 'arrowclosed'` and `orient: 'auto'`
*   Automatically aligns with path tangent for perfect arrow orientation

### `TimelineControls.tsx` - Gantt Timeline
The interactive timeline component with agent activity tracks.

**Features:**
1.  **Playback Controls:**
    *   Play/Pause button (toggles 1 step/second animation)
    *   **Previous Step** (ChevronLeft icon) - Move back 1 step, disabled at step 0
    *   **Next Step** (ChevronRight icon) - Move forward 1 step, disabled at last step
    *   Slider for manual scrubbing
    *   **Note**: Uses chevron icons instead of skip icons to indicate single-step incremental navigation

2.  **Agent Tracks:**
    *   One horizontal track per agent (32px height)
    *   Agent name with color-coded dot
    *   Activity blocks at steps where agent sent messages
    *   Blocks use agent's color with opacity based on past/future state

3.  **Interactions:**
    *   Click block: Jump to that step
    *   Hover track: Highlight agent in graph and chat log
    *   Current step indicator: Blue vertical line

4.  **Collapsible Panel:**
    *   Expand/collapse button in header
    *   Max height limits to 5 tracks (scrollable for more agents)

**Data Source:**
*   Builds activity map from graph edges' interaction data
*   Uses `getAgentColor` utility for consistent coloring

### `GraphCanvas.tsx` - Wrapper
Simple container component that handles empty state and wraps `GraphView`.

### `graphAdapters.ts` - Data Transformation
The utility module that converts backend data to React Flow format.

**Key Functions:**

1.  **`convertNodesToReactFlow`:**
    *   Maps backend node data to React Flow node format
    *   Assigns agent colors from consistent palette
    *   Adds highlight state from context
    *   Sets node type to 'agent'

2.  **`convertEdgesToReactFlow`:**
    *   Maps backend edge data with temporal filtering
    *   Detects bidirectional edges
    *   Calculates edge states (current/recent/history)
    *   Applies focus mode styling
    *   Sets edge type to 'ghost'

3.  **`getLayoutedElements`:**
    *   Applies Dagre layout algorithm (left-to-right)
    *   Returns positioned nodes and edges

4.  **`getAgentColor`:**
    *   Returns consistent color for agent from 8-color palette
    *   Based on agent's index in sorted agent list

**Color Palette:**
```typescript
['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', 
 '#ef4444', '#06b6d4', '#ec4899', '#64748b']
```

## 5. Interactive Features

### Cross-Component Highlighting
Coordinated highlighting across Graph, Timeline, and Chat Log components:

*   **Graph → Others:** Hover node highlights its timeline track and chat messages
*   **Timeline → Graph:** Hover track highlights agent node
*   **Chat Log → Graph:** Hover message highlights sender node and step
*   **Implementation:** `highlightedAgentId` and `highlightedStepIndex` in `AppContext`

### Edge Focus Mode
User-initiated feature to isolate specific agent's communication:

*   **Activate:** Double-click agent node
*   **Visual:** Focused edges turn emerald green (6px, dashed), others dim to 10% opacity
*   **Deactivate:** Single-click any node, scrub timeline, or hover chat log/timeline
*   **Use Case:** Trace specific agent's conversation flow in complex graphs

### Timeline Navigation
Precise step navigation with multiple input methods:

*   **Slider:** Drag to scrub through conversation
*   **Playback:** Automated stepping at 1 step/second
*   **Block Click:** Jump directly to step by clicking activity block
*   **Skip Controls:** Jump to beginning/end

## 6. Styling & Theming

### Tailwind Classes
*   Node cards: `bg-white`, `rounded-lg`, `shadow-md`
*   Status pills: Color-coded backgrounds (emerald, amber, blue, slate)
*   Timeline tracks: `bg-slate-50` with colored activity blocks
*   Borders: `border-slate-200`, agent color for selection

### Custom CSS Animations
*   `.animate-dash-flow` - Dashed line flowing animation for current/focused edges
*   `.animate-pulse` - Pulsing dot for "generating" status
*   `.animate-spin` - Spinning gear icon for tool drawer

### Icons
*   **Library:** Lucide React
*   **Node Icons:** User, Cpu, Bot, MessageSquare (role-based)
*   **Control Icons:** Play, Pause, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Cog
*   **Note**: Timeline uses ChevronLeft/ChevronRight (not SkipBack/SkipForward) to indicate single-step navigation

## 7. Dependencies

### Core Libraries
*   `@xyflow/react` (v12+) - React Flow graph visualization
*   `@tisoap/react-flow-smart-edge` - Smart edge routing with obstacle avoidance
*   `dagre` - Graph layout algorithm
*   `lucide-react` - Icon library

### React Flow Features Used
*   Custom node types with multiple handles
*   Custom edge types with BaseEdge API
*   Edge markers (arrowclosed)
*   Background grid and controls
*   Fit view with padding

## 8. Performance Considerations

*   **Memoization:** `AgentNode` wrapped with `React.memo` to prevent unnecessary re-renders
*   **Selective Updates:** Edge focus only updates focused agent's edges
*   **Layout Caching:** Dagre layout calculated once per step change, not per render
*   **Smart Edge Fallback:** Falls back to faster smooth step path if smart routing fails
*   **Timeline Optimization:** Activity map built with useMemo, only recalculates when graph data changes
