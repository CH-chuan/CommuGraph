# CommuGraph User Interactions Reference

**Last Updated**: 2025-12-10

This document describes all supported user interactions in the CommuGraph visualization interface.

---

## Table of Contents

1. [Graph View (Center Panel)](#graph-view-center-panel)
2. [Chat Log (Left Panel)](#chat-log-left-panel)
3. [Timeline Controls (Bottom)](#timeline-controls-bottom)
4. [Gantt Chart Timeline](#gantt-chart-timeline)
5. [Cross-Component Synchronization](#cross-component-synchronization)

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
| **Hover** | Highlights sender agent in graph + Gantt timeline | Card shadow increases, border turns blue |
| **Single Click** | Navigates timeline to that step | Card border turns blue (current step) |
| **Double Click** | Jumps to step + highlights sender for 2 seconds | Sender gets colored ring in graph |
| **Click "Show more"** | Expands message (max 256px height with scroll) | Content expands, button changes to "Show less" |
| **Click "Show less"** | Collapses message to 2 lines | Content collapses, button changes to "Show more" |

**Visual States:**
- **Current step**: Blue border (`border-blue-500`), blue background (`bg-blue-50`)
- **Highlighted** (from hover/timeline): Amber border (`border-amber-400`), amber background (`bg-amber-50`)
- **Future step**: 40% opacity (dimmed)
- **Past step**: 100% opacity (normal)

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

**Action**: User clicks message card for step 15

| Component | Automatic Update |
|-----------|------------------|
| **Timeline Slider** | Moves to position 15 |
| **Graph View** | Filters to step 15 |
| **Gantt Timeline** | Blue line moves to step 15 |
| **Chat Log** | Scrolls message into view, highlights in blue |

**Action**: User double-clicks message from agent "Coder"

| Component | Automatic Update |
|-----------|------------------|
| *(All above)* | Same as single-click |
| **Graph View (additional)** | "Coder" node gets colored ring highlight for 2 seconds |

---

### Gantt Timeline Navigation

**Action**: User clicks activity block at step 30 for agent "Manager"

| Component | Automatic Update |
|-----------|------------------|
| **Timeline Slider** | Moves to position 30 |
| **Graph View** | Filters to step 30 |
| **Chat Log** | Scrolls to message #30 |
| **Gantt Timeline** | Blue line moves to step 30 |

**Action**: User hovers over "Manager" track label

| Component | Automatic Update |
|-----------|------------------|
| **Graph View** | "Manager" node gets colored ring highlight |
| **Gantt Timeline** | Track shows hover state |

---

### Graph View Selection

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
| **Unfocus** | Double-click "Manager" again to remove focus, OR perform any other action (timeline scrub, chat click, hover, etc.) |
| *(Other components)* | No change (focus is graph-only) |

---

## Highlighting System

CommuGraph uses a two-level highlighting system:

### 1. Current Step Highlighting (Blue)
- **Trigger**: Timeline scrubbing, chat log click, Gantt block click
- **Affected Components**: All components
- **Duration**: Persistent until step changes
- **Color**: Blue (`blue-500`)

### 2. Hover Highlighting (Amber/Agent Color)
- **Trigger**: Hover over chat message, hover over Gantt agent label
- **Affected Components**: Graph view, source component
- **Duration**: Only while hovering
- **Color**: Amber (`amber-400`) for general, agent color for specific highlights

### 3. Double-Click Highlighting (Agent Color Ring)
- **Trigger**: Double-click chat message
- **Affected Components**: Graph view (sender node)
- **Duration**: 2 seconds, then auto-clears
- **Color**: Agent's color as ring around node

---

## Animation & Transitions

| Element | Animation | Duration | Purpose |
|---------|-----------|----------|---------|
| **Ghost Trail current edge** | Dashed line flow | 1s loop | Shows active communication |
| **Message card highlight** | Border color transition | 200ms | Smooth state changes |
| **Node highlight ring** | Fade in/out | 200ms | Smooth appearance |
| **Chat log scroll** | Smooth scroll | Auto | Auto-scroll to current message |
| **Gantt block opacity** | Opacity transition | 200ms | Past/future distinction |
| **Timeline playback** | Linear step progression | 1s per step | Animated playback |

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
