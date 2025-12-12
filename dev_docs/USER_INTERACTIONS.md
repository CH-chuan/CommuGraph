# CommuGraph User Interactions Reference

**Last Updated**: 2025-12-12

This document describes all supported user interactions in the CommuGraph visualization interface.

---

## Table of Contents

1. [File Upload](#file-upload)
2. [Graph View (Center Panel)](#graph-view-center-panel)
3. [Claude Code Workflow View](#claude-code-workflow-view)
4. [Annotation View (Claude Code)](#annotation-view-claude-code)
5. [Chat Log (Left Panel)](#chat-log-left-panel)
6. [Timeline Controls (Bottom)](#timeline-controls-bottom)
7. [Gantt Chart Timeline](#gantt-chart-timeline)
8. [Cross-Component Synchronization](#cross-component-synchronization)

---

## File Upload

### PreFlight Modal

The upload modal appears automatically on first load and supports two frameworks.

**Framework Selection:**
- **AutoGen**: Single file upload (`.jsonl` or `.json`)
- **Claude Code**: Multi-file upload (main session + sub-agent logs)

### AutoGen Upload

| Action | Behavior |
|--------|----------|
| **Select file** | Choose a single `.jsonl` or `.json` file |
| **Process & Launch** | Parses file and opens agent graph view |

### Claude Code Upload (Multi-File)

| Action | Behavior |
|--------|----------|
| **Select framework** | Choose "Claude Code" from dropdown |
| **Select files** | File picker allows multiple selection |
| **File detection** | Main session file (UUID format) auto-detected, agent-*.jsonl files marked as sub-agents |
| **Remove file** | Click X button to remove individual files |
| **Process & Launch** | Merges all files and opens workflow view |

**Visual Indicators:**
- **Main session file**: Blue background with "main" badge
- **Sub-agent files**: Purple background with "sub-agent" badge

**File Limits:**
- Max 10MB per file
- Max 50MB total

---

## Graph View (Center Panel)

### Rich Card Nodes (Agent Cards)

**Visual Elements:**
- Rectangular card with rounded corners (8px)
- Agent-specific color border (8-color palette)
- Role-based icon (top-left): Manager, Coder, Assistant, Bot
- Agent name (bold)
- **Time-based message counts**: "X sent, Y recv" (shows counts up to current step only)
- Status pill: Idle, Generating, Waiting, Tool Use

**Interactions:**

| Action | Behavior |
|--------|----------|
| **Hover** | Card shadow increases, shows as interactive |
| **Click** | Selects node (blue border highlights), clears any edge focus |
| **Double Click** | Focuses on agent's outgoing edges: highlights them in emerald green (5px width), shows interaction count badges, dims all other edges (15% opacity). Double-click again to unfocus. |
| **Drag** | Not enabled (nodes are auto-positioned) |

**Focus Behavior:**
- Edge focus is **automatically cleared** when:
  - Timeline slider is moved
  - Chat log message is clicked
  - Any agent or timeline element is hovered
  - Any node is single-clicked
  - Play/pause button is pressed

**Visual States:**
- **Selected**: Blue border with shadow
- **Highlighted** (from Chat Log hover): Colored ring around card
- **Normal**: Subtle gray border

---

### Ghost Trail Edges (Communication Arrows)

**Visual Elements:**
- Directed arrows showing message flow (A → B)
- Temporal opacity gradient:
  - **Current step (t)**: 100% opacity, 5px width, orange (#f97316), animated dashed flow
  - **Recent step (t-1)**: 100% opacity, 4px width, agent color
  - **Historical (t-n)**: 40% opacity, 2px width, slate gray (#94a3b8)
  - **Focused (agent double-click)**: 100% opacity, 6px width, emerald green (#10b981), animated dashed flow
- **Edge labels**: Interaction count badges with solid white background, strong shadow (z-index 1000), always visible above edges (always visible on current/recent edges, or when focused)
- Bidirectional edges (A↔B) are offset by 20px to prevent overlap

**Interactions:**

| Action | Behavior |
|--------|----------|
| **Visual only** | Edges are non-interactive (display only) |
| **Temporal fade** | Automatically updates as timeline scrubs |
| **Focus mode** | When an agent is double-clicked, its outgoing edges are highlighted in emerald green with bold interaction count badges, while all other edges are dimmed to 15% opacity |

---

### MiniMap (Bottom-Right Corner)

**Visual Elements:**
- Small overview of entire graph
- Nodes colored by agent color
- Shows viewport position (white rectangle)

**Interactions:**

| Action | Behavior |
|--------|----------|
| **Click & Drag** | Pan viewport to that area of graph |
| **Drag viewport box** | Navigate around graph |

---

### Controls (Bottom-Right)

**Buttons:**
- Zoom In (+)
- Zoom Out (-)
- Fit View (center all nodes)
- Lock/Unlock pan

---

## Claude Code Workflow View

When a Claude Code log is uploaded, CommuGraph displays a specialized **Workflow View** instead of the standard agent graph. This view is optimized for visualizing the sequential, agent-centric execution pattern of Claude Code.

### Layout Overview

```
┌───────────┬─────────────────────────────────┬──────────────┐
│   Chat    │         Workflow Graph          │   Metrics    │
│   Log     │      (Tree Layout DAG)          │  Dashboard   │
│           │                                 │              │
└───────────┴─────────────────────────────────┴──────────────┘
```

### Workflow Graph Layout

**Visual Elements:**
- Tree-based vertical DAG layout (grows top-to-bottom)
- Session start node at top with metadata
- Parallel tool calls spread horizontally (fork pattern)
- Results converge to next reasoning node (join pattern)
- No lane headers - sub-agents shown as special Task tool call cards

**Fork/Join Pattern:**
```
         [Agent Reasoning]
                │
    ┌───────────┼───────────┐     Fork: parallel tool calls
    ↓           ↓           ↓
 [Read]      [Bash]      [Grep]
    ↓           ↓           ↓
 [Result]   [Result]    [Result]
    └───────────┼───────────┘     Join: all results connect
                ↓
         [Agent Reasoning]
```

---

### Workflow Nodes

Nodes represent discrete activities in the Claude Code session.

**Node Types:**

| Type | Color | Icon | Description |
|------|-------|------|-------------|
| **User Input** | Blue (#3B82F6) | User | User's prompt or follow-up |
| **Tool Result** | Teal (#14B8A6) | Terminal | Result from tool execution |
| **System Notice** | Slate (#64748B) | Gear | System messages |
| **Agent Reasoning** | Purple (#8B5CF6) | Brain | LLM thinking/response |
| **Tool Call** | Emerald (#10B981) | Tool-specific | Tool invocation |
| **Sub-Agent Call** | Purple (#8B5CF6) | Rocket | Task tool with sub-agent info |
| **Result Success** | Green (#22C55E) | Check | Successful operation with preview |
| **Result Failure** | Red (#EF4444) | X | Failed operation with error preview |

**Node Content:**
- Label (truncated)
- Content preview (2 lines max)
- Tool name badge (for tool calls)
- Duration badge (when available)
- Token count (input/output)
- Parallel indicator (e.g., "Parallel 1/3")

**Sub-Agent Tool Call Cards:**
- Purple themed card for Task tool calls
- Shows sub-agent type (e.g., "Explore Agent")
- Prompt preview
- Metrics: duration, tokens, tool count
- Status indicator (completed/failed)
- "Open" button for sub-agent modal

**Interactions:**

| Action | Behavior | Visual Feedback |
|--------|----------|-----------------|
| **Single Click** | Scrolls chat log to message, highlights node | Chat log scrolls + pulse animation |
| **Double Click** | Updates graph to that step, scrolls chat log | Graph filters to step, message highlighted |

**Visual States:**
- **Current Step**: Blue ring, elevated shadow
- **Highlighted** (from click): Amber ring
- **Normal**: Standard shadow

---

### Workflow Edges

Edges connect sequential activities within the workflow.

**Visual Elements:**
- Animated edges connecting nodes top-to-bottom
- Duration-based coloring:
  - **Fast (<1s)**: Green (#22C55E)
  - **Normal (1-5s)**: Yellow (#EAB308)
  - **Slow (5-30s)**: Orange (#F97316)
  - **Very slow (>30s)**: Red (#EF4444)
- Arrow markers indicating direction
- Cross-lane edges (dashed) for sub-agent spawning

**Edge States:**
- **Current step**: 3px width, bright color
- **Historical**: 2px width, muted color

---

### Metrics Dashboard (Right Panel)

Displays session-level analytics for Claude Code logs.

**Summary Cards:**
- **Duration**: Total session time
- **Tokens**: Total input/output tokens (formatted: 1.2k, 3.5M)
- **Tool Calls**: Number of tool invocations
- **Success Rate**: Tool success percentage (color-coded)

**Collapsible Sections:**

| Section | Content |
|---------|---------|
| **Activity Breakdown** | Bar chart of node types |
| **Tool Usage** | Top 10 tools by frequency |
| **Sub-agents** | List of spawned sub-agents with metadata |

**Sub-agent Cards:**
- Sub-agent type/ID
- Status badge (completed/failed)
- Duration, tokens, tool count

**Warning Banner:**
- Appears when tool success rate < 90%
- Amber background with alert icon

---

### Workflow-Specific Interactions

| Action | Effect |
|--------|--------|
| **Single Click Node** | Scrolls chat log to corresponding message + pulse animation (no graph change) |
| **Double Click Node** | Updates graph to that step + scrolls chat log |
| **Click Sub-Agent "Open"** | Opens modal showing sub-agent workflow details |
| **Pan/Zoom** | Standard React Flow controls |
| **Fit View** | Centers all workflow nodes |

**Note**: Hover interactions have been removed for simplicity. All interactions are click-based.

---

## Annotation View (Claude Code)

The Annotation View provides a sequence-based visualization for Claude Code logs, optimized for labeling and annotation workflows. Instead of a workflow DAG, it presents a linear conversation flow with expandable content sections.

### Layout Overview

```
┌───────────┬─────────────────────────────────┬──────────────┐
│   Chat    │        Annotation View          │   Metrics    │
│   Log     │   (Vertical Sequence Layout)    │  Dashboard   │
│           │                                 │              │
└───────────┴─────────────────────────────────┴──────────────┘
```

### Layout Algorithm

**Row Grouping:**
- **User turns**: Always in their own row (single centered node)
- **Consecutive assistant turns**: Grouped horizontally in the same row (left to right)

**Edge Patterns:**
- **Vertical edges**: Connect first node of each row to next row (main conversation flow)
- **Horizontal edges** (dashed purple): Connect consecutive assistant turns within a row

```
       [User Prompt]          ← Single node, centered
              │
              ↓
  [Assist 1]──[Assist 2]──[Assist 3]   ← Horizontal row of consecutive turns
              │                         ← Rightmost connects to next
              ↓
       [User Prompt]
```

---

### Annotation Nodes

**Node Types:**

| Type | Theme | Icon | Description |
|------|-------|------|-------------|
| **User Turn** | Blue border (#3B82F6) | User | User's prompt or input |
| **Assistant Turn** | Purple border (#8B5CF6) | Brain | Claude's response with thinking/text/tools |

**User Turn Node Content:**
- Header: "User Prompt" with sequence number
- Prompt text (truncated to 300 chars, 4 lines max)
- Timestamp (if available)
- Label slot (for annotations)

**Assistant Turn Node Content:**
- Header: "Assistant Turn" with tool names if present
- **Thinking** (collapsible): Expandable section showing Claude's thinking
- **Text Response**: Main response text (truncated to 400 chars)
- **Tool Calls** (collapsible): Expandable list of tool invocations with inputs
- **Tool Summary**: Quick stats when tool calls collapsed (success/error counts)
- Timestamp (if available)
- Label slot (for annotations)

---

### Collapsible Sections

**Thinking Section:**

| State | Visual |
|-------|--------|
| **Collapsed** | "Thinking (N chars)" with chevron |
| **Expanded** | Gray background, monospace font, max 160px height with scroll |

**Tool Calls Section:**

| State | Visual |
|-------|--------|
| **Collapsed** | "N Tool Call(s)" with wrench icon |
| **Expanded** | Green background, tool names + JSON inputs, max 240px height with scroll |

**Interactions:**

| Action | Behavior |
|--------|----------|
| **Click "Thinking"** | Toggles thinking content visibility |
| **Click "Tool Calls"** | Toggles tool calls list visibility |
| **Expand any section** | Node elevates (z-index 100) to appear above overlapping nodes |

---

### Label Slots

Each node has a label slot at the bottom for annotation labels.

**Empty State:**
- Gray background with tag icon
- Text: "No labels (click to annotate)"

**With Labels:**
- Pills showing label IDs with confidence percentages
- Indigo color scheme

---

### Interactions

| Action | Behavior | Visual Feedback |
|--------|----------|-----------------|
| **Single Click Node** | Triggers onNodeClick callback (scrolls chat log) | Node highlighted with amber ring |
| **Double Click Node** | Centers view on node + triggers callback | Smooth animation to node center |
| **Pan/Zoom** | Standard React Flow controls | - |
| **Fit View** | Centers all nodes (0.2 padding, 0.3 min zoom) | - |
| **Drag Scrollbar** | Vertical scrollbar synced with viewport | Thumb position updates |
| **Click Scrollbar Track** | Jumps to that scroll position | Viewport pans |

---

### Visual States

**Node States:**
- **Normal**: Standard shadow, default z-index
- **Selected**: Ring with blue (user) or purple (assistant) color
- **Highlighted**: Amber ring (`ring-amber-400`)
- **Expanded**: Elevated shadow (`shadow-xl`), z-index 100

**Edge Styles:**
- **Vertical edges**: Solid gray (#94a3b8), 2px, smoothstep
- **Horizontal edges**: Dashed purple (#a78bfa), 2px, straight

---

### Custom Scrollbar

The Annotation View includes a custom vertical scrollbar that syncs with the React Flow viewport.

**Visual Elements:**
- Right-side scrollbar track (16px width)
- Draggable thumb (size proportional to visible content)

**Behavior:**
- Tracks viewport position automatically
- Click track to jump to position
- Drag thumb to scroll
- Resizes based on zoom level

---

### MiniMap

**Position**: Bottom-left corner

**Node Colors:**
- User turns: Blue (#3B82F6)
- Assistant turns: Purple (#8B5CF6)

---

## Chat Log (Left Panel)

### Message Cards

**Visual Elements:**
- Card with border (blue when current, amber when highlighted)
- Step number badge (e.g., `#5`)
- Sender and receiver names with agent colors
- Arrow icon (→) between sender and receiver
- Message content (2 lines preview or expanded)
- "Show more/less" button (for messages >80 chars)

**Interactions:**

| Action | Behavior | Visual Feedback |
|--------|----------|-----------------|
| **Single Click** | Highlights message + highlights corresponding node in graph (if visible) | Card border turns amber, graph node highlighted |
| **Double Click** | Updates graph to that step | Card border turns blue (current step), graph filters to step |
| **Click "Show more"** | Expands message (max 256px height with scroll) | Content expands, button changes to "Show less" |
| **Click "Show less"** | Collapses message to 2 lines | Content collapses, button changes to "Show more" |
| **Manual Scroll** | Standard scrolling behavior | No automatic effects |

**Note**: Hover interactions have been removed. Auto-scroll only occurs when clicking nodes in the graph.

**Visual States:**
- **Current step**: Blue border (`border-blue-500`), blue background (`bg-blue-50`)
- **Highlighted** (from single click or graph node click): Amber border (`border-amber-400`), amber background (`bg-amber-50`), pulse animation
- **Future step**: 40% opacity (dimmed)
- **Past step**: 100% opacity (normal)

**Pulse Animation:**
- Triggered when scrolling to message from graph node click
- Animation plays AFTER scroll completes (uses IntersectionObserver for detection)
- 800ms amber glow + scale effect
- Helps user identify which message corresponds to the clicked graph node

**Message Expansion:**
- Triggered for messages with >80 characters OR containing line breaks (`\n`)
- Expanded state shows full content with vertical scrollbar if needed
- Max height: 256px (16rem)
- Prevents text selection during double-click (`select-none`)

---

## Timeline Controls (Bottom)

### Playback Controls

**Buttons:**

| Button | Icon | Action | Keyboard Shortcut |
|--------|------|--------|-------------------|
| **Previous Step** | ◀ (ChevronLeft) | Go back 1 step (disabled at step 0) | *(Arrow Left - planned)* |
| **Play/Pause** | ▶/⏸ | Start/stop animation (1 step/second) | *(Space - planned)* |
| **Next Step** | ▶ (ChevronRight) | Go forward 1 step (disabled at last step) | *(Arrow Right - planned)* |

### Slider

**Visual Elements:**
- Horizontal slider spanning full width
- Blue track (filled portion shows progress)
- Draggable thumb

**Interactions:**

| Action | Behavior |
|--------|----------|
| **Drag thumb** | Scrubs to any step (updates all views) |
| **Click track** | Jumps to that step |
| **Auto-play** | Thumb moves automatically when playing (1 step/sec) |

**Display:**
- Shows "Step X / Y" (e.g., "Step 15 / 42")

---

## Gantt Chart Timeline

### Expand/Collapse

**Button:**
- Chevron icon (▼/▲) in top-right of timeline controls

**Behavior:**
- Click to toggle Gantt chart visibility
- Collapsed: Only shows playback controls and slider
- Expanded: Shows agent tracks with activity blocks

---

### Agent Tracks

**Visual Elements:**
- One horizontal track per agent
- Agent name label (left, 120px wide) with colored dot
- Activity blocks: Colored rectangles showing when agent sent messages
- Each block positioned at its step index (horizontal axis)
- Vertical blue line indicates current step

**Track Layout:**
- Height: 32px per track
- Max visible: 5 tracks (scrollable if more agents)
- Block height: 24px
- Block color: Matches agent's color
- Block width: Proportional to total steps (min 8px)

**Interactions:**

| Action | Behavior | Visual Feedback |
|--------|----------|-----------------|
| **Hover agent label** | Highlights agent in graph | Agent gets colored ring |
| **Click activity block** | Jumps timeline to that step | Timeline updates, graph filters, chat log scrolls |
| **Hover activity block** | Shows step number in tooltip | Block shows as interactive |

**Visual States:**
- **Current step block**: Blue ring (`ring-2 ring-blue-500 ring-offset-1`), full opacity
- **Past blocks**: Full opacity (100%)
- **Future blocks**: Dimmed (30% opacity)

---

### Step Markers

**Visual Elements:**
- Bottom ruler showing step numbers at 0%, 25%, 50%, 75%, 100%
- Small gray text labels

**Purpose:**
- Provides scale reference for timeline navigation
- Non-interactive (display only)

---

## Cross-Component Synchronization

All components share a global "current step" state managed by React Context. Here's how they synchronize:

### Timeline Scrubbing

**Action**: User drags timeline slider to step 25

| Component | Automatic Update |
|-----------|------------------|
| **Graph View** | Shows graph state at step 25 (ghost trails update, current edges blue) |
| **Chat Log** | Scrolls to message #25, highlights it in blue |
| **Gantt Timeline** | Vertical blue line moves to step 25, blocks update opacity |

---

### Chat Log Navigation

**Action**: User single-clicks message card for step 15

| Component | Automatic Update |
|-----------|------------------|
| **Chat Log** | Message highlighted in amber |
| **Graph View** | Corresponding node highlighted in amber (if visible in current step) |
| **Timeline Slider** | No change |
| **Gantt Timeline** | No change |

**Action**: User double-clicks message card for step 15

| Component | Automatic Update |
|-----------|------------------|
| **Timeline Slider** | Moves to position 15 |
| **Graph View** | Filters to step 15, node highlighted in blue |
| **Gantt Timeline** | Blue line moves to step 15 |
| **Chat Log** | Message highlighted in blue (current step) |

---

### Gantt Timeline Navigation

**Action**: User clicks activity block at step 30 for agent "Manager"

| Component | Automatic Update |
|-----------|------------------|
| **Timeline Slider** | Moves to position 30 |
| **Graph View** | Filters to step 30 |
| **Chat Log** | Scrolls to message #30 |
| **Gantt Timeline** | Blue line moves to step 30 |

---

### Graph View Selection (AutoGen)

**Action**: User clicks on "Coder" node

| Component | Automatic Update |
|-----------|------------------|
| **Graph View** | "Coder" node border turns blue |
| *(Other components)* | No change (graph selection is independent) |

**Action**: User double-clicks on "Manager" node

| Component | Automatic Update |
|-----------|------------------|
| **Graph View** | "Manager" node's outgoing edges highlighted in emerald green (5px, animated dash), all other edges dimmed to 15% opacity |
| **Edge Labels** | Focused edges show bold interaction count badges with emerald background (e.g., "3", "7") |
| **Unfocus** | Double-click "Manager" again to remove focus, OR perform any other action (timeline scrub, chat click, etc.) |
| *(Other components)* | No change (focus is graph-only) |

---

### Workflow View Navigation (Claude Code)

**Action**: User single-clicks on a workflow node

| Component | Automatic Update |
|-----------|------------------|
| **Workflow Graph** | Node highlighted in amber |
| **Chat Log** | Scrolls to corresponding message, pulse animation after scroll completes |
| **Timeline Slider** | No change |

**Action**: User double-clicks on a workflow node

| Component | Automatic Update |
|-----------|------------------|
| **Workflow Graph** | Filters to that step, node highlighted in blue |
| **Chat Log** | Scrolls to corresponding message |
| **Timeline Slider** | Moves to that step |

---

### Annotation View Navigation (Claude Code)

**Action**: User single-clicks on an annotation node

| Component | Automatic Update |
|-----------|------------------|
| **Annotation View** | Node highlighted with amber ring |
| **Chat Log** | Scrolls to corresponding message |
| *(Other components)* | No change |

**Action**: User double-clicks on an annotation node

| Component | Automatic Update |
|-----------|------------------|
| **Annotation View** | Centers view on node with smooth animation (zoom 0.8, 500ms) |
| **Chat Log** | Scrolls to corresponding message |
| *(Other components)* | Focus cleared after centering |

---

## Highlighting System

CommuGraph uses a two-level highlighting system:

### 1. Current Step Highlighting (Blue)
- **Trigger**: Timeline scrubbing, double-click on chat message or graph node, Gantt block click
- **Affected Components**: All components
- **Duration**: Persistent until step changes
- **Color**: Blue (`blue-500`)
- **Effect**: Updates graph to show only nodes up to this step

### 2. Highlighted Step (Amber)
- **Trigger**: Single click on chat message or graph node
- **Affected Components**: Chat log + graph (cross-highlighting)
- **Duration**: Persistent until another element is clicked
- **Color**: Amber (`amber-400`)
- **Effect**:
  - In Chat Log: Amber border + pulse animation (after scroll completes)
  - In Graph: Amber ring around corresponding node (if visible)
- **Note**: Does NOT change graph step - only highlights for visibility

### Interaction Summary

| Action | Chat Log | Graph | Graph Step |
|--------|----------|-------|------------|
| Single click node | Scroll + highlight + pulse | Amber ring | No change |
| Double click node | Scroll + highlight | Blue ring | Updated |
| Single click message | Amber highlight | Amber ring (if visible) | No change |
| Double click message | Blue highlight | Blue ring | Updated |

---

## Animation & Transitions

| Element | Animation | Duration | Purpose |
|---------|-----------|----------|---------|
| **Ghost Trail current edge** | Dashed line flow | 1s loop | Shows active communication |
| **Message card highlight** | Border color transition | 200ms | Smooth state changes |
| **Message pulse (graph click)** | Amber glow + scale | 800ms | Identifies clicked node's message |
| **Node highlight ring** | Fade in/out | 200ms | Smooth appearance |
| **Chat log scroll** | Smooth scroll | Auto | Auto-scroll to message (from graph click) |
| **Gantt block opacity** | Opacity transition | 200ms | Past/future distinction |
| **Timeline playback** | Linear step progression | 1s per step | Animated playback |

### Pulse Animation Details

The chat log pulse animation (`animate-pulse-highlight`) is triggered when:
1. User clicks a node in the workflow graph
2. Chat log scrolls to the corresponding message
3. IntersectionObserver detects the message is visible (50% threshold)
4. Animation plays: amber box-shadow expands/contracts with subtle scale

```css
@keyframes pulse-highlight {
  0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); transform: scale(1); }
  50% { box-shadow: 0 0 0 12px rgba(251, 191, 36, 0.2); transform: scale(1.01); }
  100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); transform: scale(1); }
}
```

---

## Tooltips & Help Text

| Element | Tooltip |
|---------|---------|
| **Agent node (graph)** | *(Hover shows interactivity, double-click focuses on outgoing edges)* |
| **Chat message card** | "Click to navigate • Double-click to jump and highlight" |
| **Gantt activity block** | "Step {number}" |
| **Timeline controls** | *(Standard button tooltips)* |

---

## Accessibility Notes

- **Keyboard Navigation**: Not yet implemented (planned for Phase 4)
- **Screen Readers**: Limited support (visual-first design)
- **Color Blindness**: 8 distinct colors chosen for maximum differentiation
- **Text Selection**: Disabled on interactive cards (`select-none`) to prevent double-click issues
- **Focus States**: Standard browser focus rings on buttons and interactive elements

---

## Performance Considerations

- **Graph Scale**: Optimized for <50 agents, <100 messages
- **Auto-scroll**: Uses smooth scroll with `behavior: 'smooth'`
- **Debouncing**: Timeline slider updates are real-time (no debounce needed for <100 steps)
- **Memoization**: React.memo and useMemo used throughout to prevent unnecessary re-renders

---

## Future Interaction Enhancements (Planned)

1. **Keyboard Shortcuts**:
   - Space: Play/Pause
   - Arrow Left/Right: Step backward/forward
   - Home/End: Jump to first/last step

2. **Resizable Panels**:
   - Drag column dividers to resize Chat Log, Graph, Insights

3. **Graph Interactions**:
   - Click node to show agent details in Insights panel
   - Right-click edge to filter by communication pair

4. **Export**:
   - Download graph as PNG/SVG
   - Export timeline as video/GIF

---

## Troubleshooting Common Issues

### "Show more" button not appearing
- **Cause**: Message content is ≤80 characters
- **Fix**: Button only appears for messages >80 chars or with line breaks

### Agent not highlighting when hovering
- **Cause**: Agent name mismatch between Chat Log and Graph
- **Fix**: Ensure parser correctly extracts agent IDs

### Timeline not syncing with chat log
- **Cause**: Step index mismatch
- **Fix**: Check that `step_index` is consistent in backend data

### Gantt blocks not clickable
- **Cause**: Z-index issue or overlapping elements
- **Fix**: Ensure no absolute-positioned elements covering the Gantt area

---

**For implementation details, see `CLAUDE.md` and `dev_docs/graph_visual_design.md`**
