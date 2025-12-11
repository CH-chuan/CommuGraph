# CommuGraph Usage Guide & Test Plan

**Version**: Next.js 15 Unified Stack
**Last Updated**: December 11, 2025
**Status**: Full-Stack TypeScript Implementation

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Detailed Usage Guide](#detailed-usage-guide)
3. [Human Test Plan](#human-test-plan)
4. [Troubleshooting](#troubleshooting)
5. [Sample Data](#sample-data)

---

## Quick Start

### Prerequisites

- Node.js 18+ with npm
- A terminal application
- Modern web browser (Chrome, Firefox, Safari, Edge)

### 2-Minute Setup

```bash
# 1. Navigate to project
cd /path/to/CommuGraph

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open browser
# Navigate to http://localhost:3000
```

That's it! No separate backend server needed.

---

## Detailed Usage Guide

### System Architecture

CommuGraph is a **unified Next.js application** for analyzing multi-agent conversation logs:

- **Frontend**: React components with TanStack Query
- **Backend**: Next.js API routes (TypeScript)
- **Graph Engine**: Custom DiGraph implementation
- **Visualization**: React Flow (@xyflow/react)

Everything runs on a single server at **http://localhost:3000**.

### User Workflow

#### Step 1: Launch Application

```bash
npm run dev
```

**Expected Output**:
```
▲ Next.js 16.x.x (Turbopack)
- Local:    http://localhost:3000
✓ Ready in XXXms
```

Open browser to `http://localhost:3000`.

#### Step 2: Upload Conversation Log

The **PreFlight Modal** appears automatically on first load.

**Option A: Upload AutoGen Log (Single File)**

1. **Choose Framework**: Select "AutoGen" from dropdown
2. **Select a Log File**:
   - Click file input or drag-and-drop
   - Supported formats: `.json`, `.jsonl`
   - File should contain AutoGen conversation logs
3. **Process & Launch**: Click button to parse and visualize

**Option B: Upload Claude Code Log (Multi-File)**

Claude Code sessions consist of multiple JSONL files:
- Main session file (UUID format, e.g., `a1b2c3d4-xxxx.jsonl`)
- Sub-agent files (e.g., `agent-explore-xyz.jsonl`, `agent-plan-abc.jsonl`)

1. **Choose Framework**: Select "Claude Code" from dropdown
2. **Select Files**:
   - Click file input (multi-select enabled)
   - Select ALL `.jsonl` files from the session folder
   - The main session file is automatically detected (UUID format)
   - Sub-agent files (starting with `agent-`) are identified
3. **Review Selection**:
   - Files are listed with color-coded badges
   - Blue "main" badge for main session
   - Purple "sub-agent" badge for agent files
   - Click X to remove unwanted files
4. **Process & Launch**: Click button to parse and visualize

**What if you only upload the main file?**
- The workflow will still display
- You'll see sub-agent Task spawns and their results
- You'll miss the internal activity within sub-agents (their reasoning, tool calls)

**Option C: Load Sample Data (Quick Test)**

1. Click **"Load Sample Data (34 messages)"** button
2. Automatically loads a pre-built AutoGen multi-agent scenario
3. Perfect for testing and demos

#### Step 3: Explore the Dashboard

The dashboard layout varies by framework:

**AutoGen Layout (3-column):**
```
┌─────────────┬──────────────────────┬─────────────┐
│   Chat      │        Graph         │  Insights   │
│    Log      │   Visualization      │   Panel     │
│             │    + Timeline        │             │
└─────────────┴──────────────────────┴─────────────┘
```

**Claude Code Layout (3-panel):**
```
┌─────────────┬─────────────────────────────────────┐
│   Chat      │   Workflow View   │    Metrics      │
│    Log      │ (DAG + Lanes)     │   Dashboard     │
└─────────────┴─────────────────────────────────────┘
```

**Features**:

- **Left Panel (Chat Log)**: Message history with cross-highlighting
- **Center Panel**:
  - AutoGen: Interactive agent graph + timeline controls
  - Claude Code: Vertical workflow DAG with swim lanes
- **Right Panel**:
  - AutoGen: Insights placeholder
  - Claude Code: Metrics dashboard with activity breakdown

#### Step 4: Analyze the Visualization

**AutoGen: Graph Visualization Features**

1. **Nodes (Agents)**:
   - Rich cards with role-based icons
   - Status indicators (idle/generating/waiting/tool_use)
   - Color-coded by agent
   - Shows "X sent, Y recv" message counts

2. **Edges (Communications)**:
   - **Current (orange)**: Active step, 5px dashed
   - **Recent (agent color)**: Previous step, 4px solid
   - **History (slate)**: Older steps, 2px, 40% opacity
   - Smart routing avoids node overlap

3. **Interaction Controls**:
   - **Zoom**: Mouse wheel or pinch
   - **Pan**: Click and drag canvas
   - **Double-click node**: Focus on its outgoing edges
   - **Single-click node**: Clear focus

**Claude Code: Workflow View Features**

1. **Swim Lanes**:
   - Main agent lane (blue header)
   - Sub-agent lanes (purple headers)
   - Lanes show: tokens, duration, tool count

2. **Workflow Nodes** (type-colored):
   - **User Input** (blue): User prompts
   - **Agent Reasoning** (purple): LLM responses
   - **Tool Call** (green): Tool invocations
   - **Success/Failure** (emerald/red): Results

3. **Edges** (duration-colored):
   - Fast (<1s): Green
   - Normal (1-5s): Yellow
   - Slow (5-30s): Orange
   - Very slow (>30s): Red

4. **Time Axis** (left):
   - Click timestamps to jump to nearest node
   - Blue indicator shows current position

5. **Metrics Dashboard** (right):
   - Session summary cards
   - Activity breakdown chart
   - Tool usage statistics
   - Sub-agent list with status

#### Step 5: Navigate Through Time

**Timeline Controls** at bottom of center panel:

| Button | Action |
|--------|--------|
| ◀ | Previous step (-1) |
| ▶ / ⏸ | Play / Pause animation |
| ▶ | Next step (+1) |
| Slider | Drag to specific step |

**How Timeline Filtering Works**:

- Each step = one message in the conversation
- Dragging to step N shows only interactions up to step N
- Graph updates in real-time via API: `GET /api/graph/{id}?step=N`

**Gantt Chart** (expandable):
- Each row = one agent
- Colored blocks = steps where agent sent messages
- Click block to jump to that step
- Hover to highlight agent across all components

#### Step 6: Cross-Highlighting

All components are synchronized:

- **Hover message in Chat Log** → Highlights agent in graph and timeline
- **Hover agent track in Timeline** → Highlights agent in graph
- **Double-click node in Graph** → Focuses outgoing edges

---

## Human Test Plan

### Test Environment Setup

**Before Testing**:
- [ ] Server running: `npm run dev`
- [ ] Browser open to http://localhost:3000
- [ ] Browser console open (F12) for error checking

---

### Test Suite 1: Installation & Startup

#### Test 1.1: Installation
```bash
npm install
```
- [ ] No error messages
- [ ] `node_modules/` directory created

#### Test 1.2: Development Server
```bash
npm run dev
```
- [ ] Server starts without errors
- [ ] Shows "Ready" message
- [ ] Can access http://localhost:3000

#### Test 1.3: Production Build
```bash
npm run build
```
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Shows route summary

---

### Test Suite 2: File Upload Flow

#### Test 2.1: Initial Load
1. Open http://localhost:3000

- [ ] Page loads successfully
- [ ] PreFlight Modal appears
- [ ] File input and framework selector visible
- [ ] "Process & Launch" button disabled (no file)

#### Test 2.2: Sample Data Load
1. Click "Load Sample Data (34 messages)"

- [ ] Button shows loading state
- [ ] Modal closes after success
- [ ] Graph appears in center panel
- [ ] Timeline controls visible

#### Test 2.3: AutoGen File Upload
1. Select "AutoGen" framework
2. Select a single `.jsonl` file
3. Click "Process & Launch"

- [ ] File name shown after selection
- [ ] Upload succeeds
- [ ] Graph renders correctly

#### Test 2.4: Claude Code Multi-File Upload
1. Select "Claude Code" framework
2. Select multiple `.jsonl` files (main + agent-*.jsonl)

- [ ] File picker allows multi-select
- [ ] Files listed with badges (main vs sub-agent)
- [ ] Main session file shows blue "main" badge
- [ ] Agent files show purple "sub-agent" badge
- [ ] Can remove individual files with X button
- [ ] Upload succeeds
- [ ] Workflow view renders (not standard graph)
- [ ] Metrics dashboard appears on right

#### Test 2.5: Claude Code Single File (Main Only)
1. Select "Claude Code" framework
2. Select only the main session file

- [ ] Upload succeeds
- [ ] Workflow view renders
- [ ] Sub-agent spawns visible (from Task tool calls)
- [ ] Sub-agent lanes may be empty (no internal activity)

#### Test 2.6: Error Handling
1. Upload invalid file (e.g., text file renamed to .jsonl)

- [ ] Error message appears in modal
- [ ] Modal stays open for retry
- [ ] No console errors crash the app

---

### Test Suite 3: Graph Visualization (AutoGen)

#### Test 3.1: Initial Render
- [ ] Nodes (agent cards) visible
- [ ] Edges (arrows) connecting nodes
- [ ] Edge labels show interaction counts
- [ ] Graph auto-fits to viewport

#### Test 3.2: Node Interaction
- [ ] Hover shows cursor change
- [ ] Double-click highlights outgoing edges
- [ ] Single-click clears highlight

#### Test 3.3: Zoom & Pan
- [ ] Mouse wheel zooms smoothly
- [ ] Click-drag pans canvas
- [ ] Zoom controls work (+/- buttons)

---

### Test Suite 3B: Claude Code Workflow View

#### Test 3B.1: Initial Render
- [ ] Workflow nodes visible (vertical DAG)
- [ ] Lane headers at top (main + sub-agents)
- [ ] Time axis on left
- [ ] Metrics dashboard on right

#### Test 3B.2: Node Types
- [ ] User input nodes (blue)
- [ ] Agent reasoning nodes (purple)
- [ ] Tool call nodes (green)
- [ ] Success/failure nodes (emerald/red)
- [ ] Compact result nodes vs full nodes

#### Test 3B.3: Edges
- [ ] Duration-colored edges visible
- [ ] Fast edges green, slow edges red
- [ ] Animated current step edge

#### Test 3B.4: Lanes
- [ ] Main lane shows blue header
- [ ] Sub-agent lanes show purple headers
- [ ] Lane metadata visible (tokens, duration)

#### Test 3B.5: Metrics Dashboard
- [ ] Duration card shows session time
- [ ] Tokens card shows formatted count
- [ ] Tool calls count visible
- [ ] Success rate percentage with color
- [ ] Activity breakdown collapsible
- [ ] Tool usage list visible
- [ ] Sub-agent list (if any)

#### Test 3B.6: Interactions
- [ ] Click node updates step
- [ ] Hover node highlights
- [ ] Click time axis jumps to node
- [ ] Zoom and pan work

---

### Test Suite 4: Timeline Controls (AutoGen)

#### Test 4.1: Initial State
- [ ] Controls visible at bottom
- [ ] Step counter shows "Step 0 / [total]"
- [ ] Slider at position 0

#### Test 4.2: Manual Scrubbing
1. Drag slider to middle

- [ ] Step counter updates
- [ ] Graph filters to show only interactions up to that step
- [ ] Edge styles change based on temporal state

#### Test 4.3: Play Animation
1. Click Play button

- [ ] Steps advance (1 per second)
- [ ] Graph updates at each step
- [ ] Button changes to Pause

#### Test 4.4: Step Navigation
- [ ] Left arrow moves -1 step
- [ ] Right arrow moves +1 step
- [ ] Disabled at boundaries (0 and max)

#### Test 4.5: Gantt Timeline
1. Expand timeline panel

- [ ] Agent tracks visible
- [ ] Colored blocks for activity
- [ ] Click block jumps to step
- [ ] Hover highlights agent

---

### Test Suite 5: Chat Log

#### Test 5.1: Message Display
- [ ] Messages listed chronologically
- [ ] Step number shown for each
- [ ] Sender → Receiver format
- [ ] Agent colors match graph

#### Test 5.2: Interaction
- [ ] Click message navigates to step
- [ ] Double-click highlights sender
- [ ] Hover highlights agent in graph
- [ ] Long messages expandable

#### Test 5.3: Auto-Scroll
- [ ] Current step message scrolls into view
- [ ] Smooth scroll animation

---

### Test Suite 6: API Endpoints

#### Test 6.1: Frameworks
```bash
curl http://localhost:3000/api/frameworks
```
- [ ] Returns `{"frameworks":["autogen","claudecode"]}`

#### Test 6.2: Sessions
```bash
curl http://localhost:3000/api/sessions
```
- [ ] Returns `{"sessions":[...]}`

#### Test 6.3: AutoGen Upload
```bash
curl -X POST -F "file=@public/mock_chat_history.jsonl" -F "framework=autogen" http://localhost:3000/api/upload
```
- [ ] Returns JSON with `graph_id`, `node_count`, `edge_count`, `total_steps`

#### Test 6.4: Claude Code Multi-File Upload
```bash
curl -X POST -F "file=@main.jsonl" -F "file=@agent-explore.jsonl" -F "framework=claudecode" http://localhost:3000/api/upload
```
- [ ] Returns JSON with `graph_id`, `message_count`, `total_steps`
- [ ] Accepts multiple files

#### Test 6.5: Graph Retrieval
```bash
curl "http://localhost:3000/api/graph/{graph_id}"
```
- [ ] Returns graph snapshot with nodes and edges

#### Test 6.6: Graph Filtering
```bash
curl "http://localhost:3000/api/graph/{graph_id}?step=10"
```
- [ ] Returns filtered graph
- [ ] Only interactions ≤ step 10 included

#### Test 6.7: Workflow Retrieval (Claude Code)
```bash
curl "http://localhost:3000/api/graph/{graph_id}/workflow"
```
- [ ] Returns workflow snapshot with nodes, edges, lanes
- [ ] Returns 400 if not a Claude Code session

#### Test 6.8: Workflow Filtering (Claude Code)
```bash
curl "http://localhost:3000/api/graph/{graph_id}/workflow?step=10"
```
- [ ] Returns filtered workflow
- [ ] Only nodes ≤ step 10 included

#### Test 6.9: Metrics
```bash
curl "http://localhost:3000/api/graph/{graph_id}/metrics"
```
- [ ] Returns density, centrality metrics

---

### Test Suite 7: Performance

#### Test 7.1: Small Data (<20 messages)
- [ ] Upload < 1 second
- [ ] Graph renders instantly
- [ ] Timeline scrubbing instant

#### Test 7.2: Medium Data (50-100 messages)
- [ ] Upload < 2 seconds
- [ ] Graph renders < 1 second
- [ ] Timeline scrubbing smooth

---

## Troubleshooting

### Issue: Page Not Loading

**Symptoms**: Browser shows connection error

**Solution**:
1. Check server is running: `npm run dev`
2. Verify port 3000 is free
3. Try `npm run build && npm start` for production mode

### Issue: Graph Not Rendering

**Symptoms**: Upload succeeds but graph area is blank

**Solution**:
1. Open browser console (F12)
2. Check for React Flow errors
3. Verify API response: `curl http://localhost:3000/api/graph/{id}`
4. Ensure nodes array is not empty

### Issue: Timeline Not Updating Graph

**Symptoms**: Slider moves but graph stays same

**Solution**:
1. Check Network tab for API calls
2. Verify step parameter in request
3. Check TanStack Query devtools for cache issues

### Issue: Build Errors

**Symptoms**: `npm run build` fails

**Solution**:
```bash
# Clear caches and rebuild
rm -rf .next node_modules
npm install
npm run build
```

---

## Sample Data

### Built-in Mock Data (AutoGen)

**File**: `public/mock_chat_history.jsonl`

Click "Load Sample Data (34 messages)" in the PreFlight modal.

**Scenario**: Software development team implementing notification system

**Agents**: User, Manager, Coder, Reviewer, quality_assurance

**Features Demonstrated**:
- Task delegation patterns
- Code review workflow
- Testing and iteration loops

### AutoGen Log Format

Each line is a JSON object:

```json
{"sender": "Manager", "recipient": "Coder", "message": "Implement the feature", "timestamp": "2024-01-15T10:30:00Z"}
```

### Claude Code Log Format

Claude Code logs are stored in `~/.claude/projects/[project-hash]/` with multiple files:

**Main session file** (UUID format):
```
a1b2c3d4-5678-9abc-def0-123456789abc.jsonl
```

**Sub-agent files** (agent-* prefix):
```
agent-explore-xyz123.jsonl
agent-plan-abc456.jsonl
```

Each line is a JSON record with structure like:
```json
{
  "uuid": "unique-id",
  "parentUuid": "parent-id",
  "sessionId": "session-id",
  "timestamp": "2025-01-15T10:30:00Z",
  "type": "assistant",
  "message": { "role": "assistant", "content": [...] }
}
```

### Creating Custom Test Data

**AutoGen Minimal Log**:
```jsonl
{"sender": "Alice", "recipient": "Bob", "message": "Hello Bob"}
{"sender": "Bob", "recipient": "Alice", "message": "Hi Alice"}
```

**Claude Code**: Export logs from `~/.claude/projects/` directory

---

## Test Execution Log

**Tester**: _________________
**Date**: _________________

| Suite | Test | Pass | Notes |
|-------|------|------|-------|
| 1 | Installation | ☐ | |
| 1 | Dev Server | ☐ | |
| 1 | Prod Build | ☐ | |
| 2.1 | Initial Load | ☐ | |
| 2.2 | Sample Data | ☐ | |
| 2.3 | AutoGen Upload | ☐ | |
| 2.4 | Claude Code Multi-File | ☐ | |
| 2.5 | Claude Code Single File | ☐ | |
| 2.6 | Error Handling | ☐ | |
| 3 | AutoGen Graph Render | ☐ | |
| 3 | Node Interaction | ☐ | |
| 3 | Zoom/Pan | ☐ | |
| 3B | Workflow Render | ☐ | |
| 3B | Node Types | ☐ | |
| 3B | Edges | ☐ | |
| 3B | Lanes | ☐ | |
| 3B | Metrics Dashboard | ☐ | |
| 3B | Workflow Interactions | ☐ | |
| 4 | Timeline State | ☐ | |
| 4 | Scrubbing | ☐ | |
| 4 | Play Animation | ☐ | |
| 4 | Step Navigation | ☐ | |
| 4 | Gantt Timeline | ☐ | |
| 5 | Chat Log Display | ☐ | |
| 5 | Chat Interaction | ☐ | |
| 6 | API - Frameworks | ☐ | |
| 6 | API - Upload | ☐ | |
| 6 | API - Workflow | ☐ | |
| 7 | Performance | ☐ | |

**Total**: ___ / 29 tests passed

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | Dec 11, 2025 | Claude Code parser and workflow view, multi-file upload support |
| 2.0 | Dec 2025 | Next.js 15 unified stack migration |
| 1.0 | Dec 2025 | Initial React + FastAPI implementation |

---

**End of Usage Guide & Test Plan**
