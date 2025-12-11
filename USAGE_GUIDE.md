# CommuGraph Usage Guide & Test Plan

**Version**: Next.js 15 Unified Stack
**Last Updated**: December 2025
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

**Option A: Upload Your Own File**

1. **Select a Log File**:
   - Click file input or drag-and-drop
   - Supported formats: `.json`, `.jsonl`
   - File should contain AutoGen conversation logs

2. **Choose Framework**:
   - Select "AutoGen" from dropdown

3. **Process & Launch**:
   - Click "Process & Launch" button
   - Processing typically takes 1-2 seconds

**Option B: Load Sample Data (Quick Test)**

1. Click **"Load Sample Data (34 messages)"** button
2. Automatically loads a pre-built multi-agent scenario
3. Perfect for testing and demos

#### Step 3: Explore the Dashboard

The dashboard has a **3-column layout**:

```
┌─────────────┬──────────────────────┬─────────────┐
│   Chat      │        Graph         │  Insights   │
│    Log      │   Visualization      │   Panel     │
│             │    + Timeline        │             │
└─────────────┴──────────────────────┴─────────────┘
```

**Features**:

- **Left Panel (Chat Log)**: Message history with cross-highlighting
- **Center Panel**: Interactive graph + timeline controls
- **Right Panel**: Insights placeholder (metrics coming soon)

#### Step 4: Analyze the Graph

**Graph Visualization Features**:

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

#### Test 2.3: Custom File Upload
1. Select a `.jsonl` file
2. Click "Process & Launch"

- [ ] File name shown after selection
- [ ] Upload succeeds
- [ ] Graph renders correctly

#### Test 2.4: Error Handling
1. Upload invalid file (e.g., text file renamed to .jsonl)

- [ ] Error message appears in modal
- [ ] Modal stays open for retry
- [ ] No console errors crash the app

---

### Test Suite 3: Graph Visualization

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

### Test Suite 4: Timeline Controls

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
- [ ] Returns `{"frameworks":["autogen"]}`

#### Test 6.2: Sessions
```bash
curl http://localhost:3000/api/sessions
```
- [ ] Returns `{"sessions":[...]}`

#### Test 6.3: Upload
```bash
curl -X POST -F "file=@public/mock_chat_history.jsonl" -F "framework=autogen" http://localhost:3000/api/upload
```
- [ ] Returns JSON with `graph_id`, `node_count`, `edge_count`, `total_steps`

#### Test 6.4: Graph Retrieval
```bash
curl "http://localhost:3000/api/graph/{graph_id}"
```
- [ ] Returns graph snapshot with nodes and edges

#### Test 6.5: Graph Filtering
```bash
curl "http://localhost:3000/api/graph/{graph_id}?step=10"
```
- [ ] Returns filtered graph
- [ ] Only interactions ≤ step 10 included

#### Test 6.6: Metrics
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

### Built-in Mock Data

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

### Creating Custom Test Data

**Minimal Valid Log**:
```jsonl
{"sender": "Alice", "recipient": "Bob", "message": "Hello Bob"}
{"sender": "Bob", "recipient": "Alice", "message": "Hi Alice"}
```

---

## Test Execution Log

**Tester**: _________________
**Date**: _________________

| Suite | Test | Pass | Notes |
|-------|------|------|-------|
| 1 | Installation | ☐ | |
| 1 | Dev Server | ☐ | |
| 1 | Prod Build | ☐ | |
| 2 | Initial Load | ☐ | |
| 2 | Sample Data | ☐ | |
| 2 | File Upload | ☐ | |
| 2 | Error Handling | ☐ | |
| 3 | Graph Render | ☐ | |
| 3 | Node Interaction | ☐ | |
| 3 | Zoom/Pan | ☐ | |
| 4 | Timeline State | ☐ | |
| 4 | Scrubbing | ☐ | |
| 4 | Play Animation | ☐ | |
| 4 | Step Navigation | ☐ | |
| 4 | Gantt Timeline | ☐ | |
| 5 | Chat Log Display | ☐ | |
| 5 | Chat Interaction | ☐ | |
| 6 | API Endpoints | ☐ | |
| 7 | Performance | ☐ | |

**Total**: ___ / 19 tests passed

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Dec 2025 | Next.js 15 unified stack migration |
| 1.0 | Dec 2025 | Initial React + FastAPI implementation |

---

**End of Usage Guide & Test Plan**
