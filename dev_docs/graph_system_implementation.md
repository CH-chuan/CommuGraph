# Graph System Implementation Guide

**Version:** 1.0
**Last Updated:** December 2025
**Scope:** Frontend Graph Visualization (Topology Mode)

## 1. Overview
The CommuGraph visualization engine has been upgraded to support complex routing, high-visibility styling, and correct "flow" semantics for multi-agent interactions. This document details the technical implementation of the "Smart Edge" system, custom routing logic, and visual styling patterns.

## 2. Visual Design Pattern: "Rail & Flow"
To resolve optical illusions where dashed lines appear faint on white backgrounds, we implemented a dual-layer rendering strategy.

### Concept
*   **The Rail (Base Layer):** A solid, semi-transparent line that acts as the background track. It fills the gaps between dashes.
*   **The Flow (Top Layer):** A high-contrast, opaque, dashed line that rides on top of the rail.

### Styling Specification
| Edge State | Color | Width | Opacity | Layering |
| :--- | :--- | :--- | :--- | :--- |
| **Current ($t$)** | **Dark Orange** (`#c2410c`) | **5px** | **100%** | Solid Rail (`#fed7aa`) + Dashed Flow |
| **Recent ($t-1$)** | **Source Node Color** | 4px | **100%** | Single Solid Layer |
| **History ($t-n$)** | Slate (`#94a3b8`) | 2px | 40% | Single Solid Layer |

## 3. Smart Routing & Layout
We use a hybrid approach combining Dagre (for node positioning) with Smart Edge (for obstacle avoidance) and custom handle logic (for cycle management).

### A. Node Layout (Dagre)
*   **Algorithm:** `dagre` (Directed Graph)
*   **Rank Direction:** Left-to-Right (`LR`)
*   **Node Dimensions:** Fixed `180px` x `90px` to accommodate rich cards.

### B. Obstacle Avoidance (Smart Edge)
*   **Library:** `@tisoap/react-flow-smart-edge`
*   **Function:** `getSmartEdge` calculates paths that route *around* nodes rather than cutting through them.
*   **Configuration:**
    *   `gridRatio: 10`
    *   `nodePadding: 40px` (Increased to ensure edges enter nodes straight, improving arrow alignment).

### C. Back-Edge Routing ("Under-Loop")
Standard layouts often draw straight lines for cycles (e.g., Manager -> User), which cut through the graph. We implemented custom logic to route these "under" the graph.

**Logic in `graphAdapters.ts`:**
1.  **Detection:** If `Source.x > Target.x + buffer`, it's a Back-Edge.
2.  **Strategy:**
    *   **Horizontal Return:** If nodes are roughly on the same level (`abs(dy) < 50`), use **Bottom-to-Bottom** routing.
    *   **Diagonal Return:** If Source is far vertically from Target, use **Left-Source** projecting to **Top/Bottom Target**.

## 4. Component Architecture

### `GhostEdge.tsx`
The custom Edge component responsible for the visual rendering.
*   **Inputs:** `sourcePosition`, `targetPosition`, `data` (EdgeState).
*   **Logic:**
    1.  Determines `EdgeState` (Current/Recent/History).
    2.  Calculates path using `getSmartEdge`.
    3.  Renders `<BaseEdge>` (Rail) and `<path>` (Flow).
*   **Changes:** Removed manual SVG arrows; now relies on native markers for alignment.

### `AgentNode.tsx`
The Node component.
*   **Handles:** Enhanced with multiple handles to support complex routing:
    *   `left` (Standard Target)
    *   `right` (Standard Source)
    *   `bottom-source` / `bottom-target` (For Under-Loops)
    *   `top-target` (For vertical entry)
    *   `left-source` (For backward projection)

### `graphAdapters.ts`
The data transformation layer.
*   **Responsibility:** Converts backend `EdgeData` to React Flow `Edge` objects.
*   **Key Logic:**
    *   Calculates layouts.
    *   **Dynamic Handle Assignment:** iterate edges *after* layout to assign specific handles (e.g., `bottom-source`) based on geometric positions.
    *   **Marker Injection:** Configures the native `markerEnd` with `type: 'arrowclosed'` and `orient: 'auto'`.

## 5. Artifacts
*   **Icons:** Lucide React (`User`, `Cpu`, `Bot`, `MessageSquare`).
*   **Colors:** Tailwind Palette (Slate, Orange, Emerald).
