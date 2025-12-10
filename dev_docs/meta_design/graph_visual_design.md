# CommuGraph Visualization Design Specification (v2.0)

## 1. Executive Summary
The visualization module consists of a **Split-View Architecture**. Users can toggle between two distinct modes to analyze Multi-Agent System (MAS) interactions:
1.  **Topology Mode (Role-Based):** Focuses on "Who is talking to whom" (Spatial relationships).
2.  **Sequence Mode (Process-Based):** Focuses on "In what order did events happen" (Logical flow).

**Constraint:** The system generally handles sessions with **< 50 interactions**. We prioritize visual richness and completeness over aggressive performance culling.

---

## 2. Global Layout Components
These elements remain static regardless of the selected graph view.

### A. The "Smart" Timeline (Bottom)
* **Structure:** A Gantt-chart style timeline, not just a simple slider.
* **Visuals:**
    * **Rows:** Each agent has a dedicated horizontal track.
    * **Blocks:** Messages and actions are represented as colored blocks. The length of the block represents duration (if available) or standard width.
    * **Color Matching:** The track color must hex-match the Agent’s identity color in the main graph.
* **Interaction:** Clicking a block snaps the main graph to that specific step ($t$).

### B. The Chat Log (Left Sidebar)
* **Function:** Displays the raw text content.
* **Interaction:** Hovering over a message here highlights the corresponding node/edge in the main graph (Cross-Highlighting).

---

## 3. View A: Topology Mode (Role-Based Graph)
**Primary Goal:** Demonstrate the structure of the team and the current "hotspot" of activity.

### 3.1 Node Design ("Rich Cards")
* **Shape:** Rectangular card with rounded corners (8px).
* **Content:**
    * **Icon:** Top-left (Visual anchor for the role).
    * **Name:** Bold text (e.g., **Coder**, **Manager**).
    * **Status Pill:** Current state (e.g., "Idle", "Generating").
* **Tool Usage (The "Self-Process"):**
    * **Mechanism:** When an agent uses a tool (e.g., Python REPL), **do not** spawn a new node.
    * **Visual:** A "Drawer" or "Thinking Bubble" slides out from the bottom of the Agent Card containing the tool name and a spinner.
    * *Why:* Keeps the graph topology clean while showing internal work.

### 3.2 Edge Design ("Visual Recession")
We display the full history of interactions using a transparency gradient (Ghost Trails) to show accumulation without clutter.

| State | Opacity | Thickness | Animation | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Current ($t$)** | 100% | 4px | Dashed Flow | The message happening *right now*. |
| **Recent ($t-1$)** | 60% | 2px | Static | The immediate previous context. |
| **History ($t-n$)** | 20% | 1px | Static | The "Ghost Web" showing established pathways. |

### 3.3 Layout
* **Algorithm:** Geometric (Circle/Polygon) or Force-Directed.
* **Constraint:** Since $N < 10$ agents usually, distinct separation is easy. Avoid overlap.

---

## 4. View B: Sequence Mode (Process-Oriented)
**Primary Goal:** Debugging logic, race conditions, and understanding the linear flow of time.

### 4.1 Format: The Interactive Sequence Diagram
Instead of a "Directly-Follows Graph" (which gets messy with loops), we use a **UML-style Sequence visualization**.

* **X-Axis:** Agents (Columns).
* **Y-Axis:** Time (Flows downwards).
* **Lifelines:** Vertical dashed lines extending down from each agent.

### 4.2 Visuals
* **Messages:** Horizontal arrows connecting one Agent's lifeline to another.
* **Tool Usage:** Represented as a **Self-Loop** or a "Execution Box" on the agent's own lifeline.
* **Focus:** This view clearly shows:
    * A talking to B.
    * B thinking (gap in time).
    * B responding to A.

---

## 5. Interaction Guidelines

### 5.1 The Toggle
* **Location:** Top-Right of the canvas.
* **Labels:** "Map View" (Topology) vs. "Flow View" (Sequence).
* **Transition:** Cross-fade. Do not try to morph nodes into columns (too disorienting).

### 5.2 Synchronization
* **The "One-Truth" Rule:** The step index ($t$) is global.
* If the user scrubs to Step 15 in the Timeline:
    * **View A** updates to show the ghost trails up to Step 15.
    * **View B** scrolls down to center Step 15 on the screen.

---

## 6. Summary for Engineering

| Feature | Specification |
| :--- | :--- |
| **Nodes** | Rich HTML/SVG Components (Icon + Text). No generic circles. |
| **Edge History** | **Keep all edges**. Use CSS opacity to fade older edges (Current: 100%, Old: 20%). |
| **Tooling** | **Internal State**. Rendered as a sub-component of the Agent Node (Drawer/Badge). |
| **View Strategy** | **Swappable**. View A (Graph) for demos/overview. View B (Sequence) for deep-dive debugging. |
| **Data Volume** | Optimization not required for < 50 items. Render full history for maximum context. |