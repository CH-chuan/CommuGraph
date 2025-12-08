# CommuGraph Usage Guide & Test Plan

**Version**: Phase 2 MVP
**Last Updated**: December 2025
**Status**: Backend + Frontend Integrated

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

- Python 3.10+ with Poetry
- Node.js 18+ with npm
- A terminal application

### 5-Minute Setup

```bash
# 1. Clone and navigate to project
cd /path/to/CommuGraph

# 2. Start backend (Terminal 1)
cd backend
poetry install
poetry run uvicorn app.main:app --reload --port 8001

# 3. Start frontend (Terminal 2)
cd frontend
npm install
npm run dev

# 4. Open browser
# Navigate to http://localhost:5173
```

---

## Detailed Usage Guide

### System Architecture

CommuGraph is a **full-stack web application** for analyzing multi-agent conversation logs:

- **Backend**: FastAPI (Python) on port 8001
  - Parses log files (AutoGen format)
  - Builds temporal communication graphs
  - Provides REST API for graph queries

- **Frontend**: React + TypeScript on port 5173
  - File upload interface
  - Interactive graph visualization (React Flow)
  - Timeline controls for temporal analysis

### User Workflow

#### Step 1: Launch Application

1. **Start Backend Server**:
   ```bash
   cd backend
   poetry run uvicorn app.main:app --reload --port 8001
   ```

   **Expected Output**:
   ```
   INFO:     Uvicorn running on http://127.0.0.1:8001 (Press CTRL+C to quit)
   INFO:     Started reloader process [xxxxx] using WatchFiles
   INFO:     Started server process [xxxxx]
   INFO:     Application startup complete.
   ```

2. **Start Frontend Server**:
   ```bash
   cd frontend
   npm run dev
   ```

   **Expected Output**:
   ```
   VITE v7.2.7  ready in XXX ms
   ➜  Local:   http://localhost:5173/
   ```

3. **Open Browser**:
   - Navigate to `http://localhost:5173`
   - You should see the CommuGraph landing page

#### Step 2: Upload Conversation Log

The **PreFlight Modal** appears automatically on first load.

**Option A: Upload Your Own File**

1. **Select a Log File**:
   - Click "Browse Files" or drag-and-drop
   - Supported formats: `.json`, `.jsonl`
   - File should contain AutoGen conversation logs

2. **Choose Framework**:
   - Select "AutoGen" from dropdown
   - (Currently only AutoGen is supported)

3. **Process & Launch**:
   - Click the blue "Process & Launch" button
   - Backend will:
     - Parse the log file
     - Extract messages and agents
     - Build a temporal communication graph
     - Assign a unique `graph_id`
   - **Processing Time**: 1-3 seconds for typical logs (<100 messages)

**Option B: Load Sample Data (Quick Test)**

1. **Click "Load Sample Data (34 messages)"** button
   - Automatically loads a pre-built multi-agent scenario
   - Scenario: Software development team implementing notification system
   - Features: 9 agents, 34 messages, 3-hour conversation
   - Perfect for testing and demo purposes

2. **Success Indicators**:
   - Modal closes automatically
   - Main dashboard appears
   - Graph renders in center panel
   - Timeline controls appear at bottom

#### Step 3: Explore the Dashboard

The dashboard has a **3-column layout**:

```
┌─────────────┬──────────────────────┬─────────────┐
│  Narrative  │        Graph         │  Insights   │
│     Log     │   Visualization      │   Engine    │
│ (Phase 3)   │    + Timeline        │ (Phase 3)   │
└─────────────┴──────────────────────┴─────────────┘
```

**Current Phase 2 Features**:

- **Left Panel**: Placeholder (coming in Phase 3)
- **Center Panel**: Active graph visualization + timeline controls
- **Right Panel**: Placeholder (coming in Phase 3)

#### Step 4: Analyze the Graph

**Graph Visualization Features**:

1. **Nodes (Agents)**:
   - Each circle represents an agent in the conversation
   - Size: Fixed (will be proportional to message count in Phase 3)
   - Position: Automatically calculated using dagre layout algorithm
   - Label: Agent name displayed inside node

2. **Edges (Communications)**:
   - Arrows show direction of communication (A → B)
   - **Edge Label**: Number shows total interactions between agents
   - **Edge Type**: Smooth curved arrows
   - Thickness: Currently uniform (will be proportional to interaction count in Phase 3)

3. **Interaction Controls**:
   - **Zoom**: Mouse wheel or pinch gesture
   - **Pan**: Click and drag on canvas
   - **Fit View**: Automatically centers graph (happens on load)
   - **Mini-map**: Bottom-right corner shows overview

#### Step 5: Navigate Through Time

The **Timeline Controls** are at the bottom of the center panel.

**Control Buttons** (left to right):

1. **⏮ Skip to Start**: Jump to step 0
2. **▶️ Play / ⏸ Pause**: Animate through steps (1 step/second)
3. **⏭ Skip to End**: Jump to final step
4. **Slider**: Drag to specific step
5. **Step Counter**: Shows "Step X / Y"

**How Timeline Filtering Works**:

- Each step represents a **message in the conversation**
- Dragging the slider to step `N` shows **only interactions up to step N**
- Example: If total steps = 50 and you drag to step 25:
  - Backend filters graph: `GET /api/graph/{id}?step=25`
  - Only edges with interactions ≤ step 25 are displayed
  - Agents with no interactions yet are hidden

**Use Cases**:

- **Understand Conversation Flow**: Watch how communication patterns evolve
- **Identify Bottlenecks**: See when agents stop communicating
- **Detect Loops**: Notice if same agents keep exchanging messages
- **Find Critical Moments**: Scrub to specific steps mentioned in logs

#### Step 6: Review Graph Metrics (Phase 3)

*Coming Soon: The Insights panel will display:*
- Node centrality scores
- Graph density
- Anomaly detection (loops, stagnation)
- Token usage statistics

---

## Human Test Plan

### Test Environment Setup

**Before Testing**:
- [ ] Backend server running on port 8001
- [ ] Frontend server running on port 5173
- [ ] Browser console open (F12) to check for errors
- [ ] Sample AutoGen log file ready (see [Sample Data](#sample-data))

---

### Test Suite 1: Installation & Startup

#### Test 1.1: Backend Installation
**Objective**: Verify backend dependencies install correctly

**Steps**:
```bash
cd backend
poetry install
```

**Expected Results**:
- [ ] No error messages
- [ ] All packages installed successfully
- [ ] `poetry.lock` updated if needed

**Pass/Fail**: _______

---

#### Test 1.2: Backend Startup
**Objective**: Verify backend server starts correctly

**Steps**:
```bash
poetry run uvicorn app.main:app --reload --port 8001
```

**Expected Results**:
- [ ] Server starts without errors
- [ ] Logs show: `Uvicorn running on http://127.0.0.1:8001`
- [ ] Logs show: `Application startup complete`
- [ ] Can access http://localhost:8001/docs (Swagger UI)

**Pass/Fail**: _______

---

#### Test 1.3: Frontend Installation
**Objective**: Verify frontend dependencies install correctly

**Steps**:
```bash
cd frontend
npm install
```

**Expected Results**:
- [ ] No error messages
- [ ] `node_modules/` directory created
- [ ] All dependencies listed in package.json installed

**Pass/Fail**: _______

---

#### Test 1.4: Frontend Startup
**Objective**: Verify frontend dev server starts correctly

**Steps**:
```bash
npm run dev
```

**Expected Results**:
- [ ] Vite server starts without errors
- [ ] Logs show: `Local: http://localhost:5173/`
- [ ] No compilation errors in terminal

**Pass/Fail**: _______

---

### Test Suite 2: File Upload Flow

#### Test 2.1: Initial Load
**Objective**: Verify PreFlight modal appears on first load

**Steps**:
1. Open browser to http://localhost:5173

**Expected Results**:
- [ ] Page loads successfully
- [ ] PreFlight Modal is visible
- [ ] Modal has title "Upload Conversation Log"
- [ ] File input field is present
- [ ] Framework dropdown shows "AutoGen"
- [ ] "Process & Launch" button is disabled (no file selected)

**Pass/Fail**: _______

---

#### Test 2.2: File Selection via Browse
**Objective**: Test file selection using file input

**Steps**:
1. Click "Browse Files" button
2. Select `backend/tests/fixtures/autogen_sample.jsonl`
3. Observe UI changes

**Expected Results**:
- [ ] File picker dialog opens
- [ ] After selection, filename appears under input
- [ ] Text shows: "Selected: autogen_sample.jsonl"
- [ ] "Process & Launch" button becomes enabled

**Pass/Fail**: _______

---

#### Test 2.3: File Upload Success
**Objective**: Test successful file upload and processing

**Steps**:
1. With file selected, click "Process & Launch"
2. Wait for processing to complete

**Expected Results**:
- [ ] Button shows loading state: "Uploading..." with spinner icon
- [ ] Button is disabled during upload
- [ ] Network request to `POST /api/upload` succeeds (check Network tab)
- [ ] Response contains `graph_id`, `total_steps`, etc.
- [ ] Modal closes automatically (within 3 seconds)
- [ ] Main dashboard appears

**Pass/Fail**: _______

---

#### Test 2.4: File Upload Error - Invalid File
**Objective**: Test error handling for invalid file format

**Steps**:
1. Create a text file with invalid JSON: `echo "not json" > test.jsonl`
2. Attempt to upload this file
3. Click "Process & Launch"

**Expected Results**:
- [ ] Upload fails gracefully
- [ ] Error message appears in modal (red text)
- [ ] Error message is descriptive (e.g., "Invalid JSON on line 1")
- [ ] Modal does not close
- [ ] Can select a different file to retry

**Pass/Fail**: _______

---

#### Test 2.5: File Upload Error - Network Failure
**Objective**: Test error handling when backend is down

**Steps**:
1. Stop backend server (Ctrl+C)
2. Attempt to upload a valid file
3. Click "Process & Launch"

**Expected Results**:
- [ ] Upload fails after timeout
- [ ] Error message appears: "Error: Network Error" or similar
- [ ] Modal remains open
- [ ] Can retry after restarting backend

**Pass/Fail**: _______

---

### Test Suite 3: Graph Visualization

#### Test 3.1: Initial Graph Render
**Objective**: Verify graph renders correctly after upload

**Steps**:
1. Successfully upload `autogen_sample.jsonl`
2. Observe graph in center panel

**Expected Results**:
- [ ] React Flow canvas is visible
- [ ] Nodes are rendered (circles with agent names)
- [ ] Edges are rendered (arrows between nodes)
- [ ] Edge labels show interaction counts (e.g., "5")
- [ ] Graph is automatically centered (fit to view)
- [ ] Zoom controls appear in top-left
- [ ] Mini-map appears in bottom-right

**Pass/Fail**: _______

---

#### Test 3.2: Graph Layout Algorithm
**Objective**: Verify dagre layout positions nodes logically

**Steps**:
1. Observe node positions in the graph

**Expected Results**:
- [ ] Nodes do not overlap
- [ ] Edges follow logical flow (left-to-right or top-to-bottom)
- [ ] Graph is readable and not cluttered
- [ ] Similar to organizational chart or flowchart structure

**Pass/Fail**: _______

---

#### Test 3.3: Zoom In/Out
**Objective**: Test zoom functionality

**Steps**:
1. Scroll mouse wheel up (zoom in)
2. Scroll mouse wheel down (zoom out)
3. Click zoom controls (+/- buttons)

**Expected Results**:
- [ ] Graph zooms smoothly
- [ ] Nodes and edges scale proportionally
- [ ] Labels remain readable at various zoom levels
- [ ] Mini-map updates to reflect zoom level

**Pass/Fail**: _______

---

#### Test 3.4: Pan Canvas
**Objective**: Test panning functionality

**Steps**:
1. Click and hold on empty canvas area
2. Drag mouse to pan the view
3. Release mouse

**Expected Results**:
- [ ] Canvas pans smoothly while dragging
- [ ] Cursor changes to indicate drag mode
- [ ] Graph position updates in real-time
- [ ] Mini-map updates to show current viewport

**Pass/Fail**: _______

---

#### Test 3.5: Node Interaction
**Objective**: Test node hover and selection

**Steps**:
1. Hover mouse over a node
2. Click on a node

**Expected Results**:
- [ ] Hovering shows cursor change (pointer)
- [ ] Node appearance may change on hover (if styled)
- [ ] Clicking selects node (if interaction enabled)
- [ ] No errors in console

**Pass/Fail**: _______

---

### Test Suite 4: Timeline Controls

#### Test 4.1: Timeline Initial State
**Objective**: Verify timeline controls appear correctly

**Steps**:
1. After successful upload, observe timeline at bottom

**Expected Results**:
- [ ] Timeline controls bar is visible
- [ ] Four buttons present: ⏮ ▶️ ⏭ (and ⏸ when playing)
- [ ] Slider is visible and enabled
- [ ] Step counter shows: "Step 0 / [total]"
- [ ] Slider is at position 0

**Pass/Fail**: _______

---

#### Test 4.2: Manual Scrubbing
**Objective**: Test dragging timeline slider

**Steps**:
1. Click and drag slider to middle position
2. Release slider
3. Observe graph changes

**Expected Results**:
- [ ] Slider moves smoothly while dragging
- [ ] Step counter updates in real-time: "Step X / Y"
- [ ] Graph updates to show filtered state
- [ ] Network request: `GET /api/graph/{id}?step=X`
- [ ] Nodes/edges that appear after step X are hidden
- [ ] Loading state may appear briefly during API call

**Pass/Fail**: _______

---

#### Test 4.3: Play Animation
**Objective**: Test play/pause controls

**Steps**:
1. Reset to step 0 (click ⏮)
2. Click Play button ▶️
3. Watch animation for 5 seconds
4. Click Pause button ⏸

**Expected Results**:
- [ ] Play button changes to Pause button
- [ ] Step counter increments every 1 second
- [ ] Slider advances automatically
- [ ] Graph updates at each step
- [ ] Animation is smooth and continuous
- [ ] Pause button stops animation immediately
- [ ] Can resume from paused position

**Pass/Fail**: _______

---

#### Test 4.4: Skip to Start
**Objective**: Test skip-to-start button

**Steps**:
1. Drag slider to middle position (e.g., step 25)
2. Click ⏮ button

**Expected Results**:
- [ ] Slider jumps to position 0
- [ ] Step counter shows: "Step 0 / [total]"
- [ ] Graph resets to initial state (minimal edges)
- [ ] Animation stops if playing

**Pass/Fail**: _______

---

#### Test 4.5: Skip to End
**Objective**: Test skip-to-end button

**Steps**:
1. From any position, click ⏭ button

**Expected Results**:
- [ ] Slider jumps to maximum position
- [ ] Step counter shows: "Step [total] / [total]"
- [ ] Graph shows complete state (all edges)
- [ ] Animation stops if playing

**Pass/Fail**: _______

---

#### Test 4.6: Play to End Behavior
**Objective**: Test animation when reaching final step

**Steps**:
1. Drag slider to step [total - 5]
2. Click Play ▶️
3. Let animation continue to end

**Expected Results**:
- [ ] Animation plays normally until final step
- [ ] At final step, animation stops automatically
- [ ] Play button does not restart automatically
- [ ] Step counter shows final state
- [ ] Can manually restart by clicking ⏮ then ▶️

**Pass/Fail**: _______

---

### Test Suite 5: API Integration

#### Test 5.1: Upload Endpoint
**Objective**: Test POST /api/upload endpoint

**Steps**:
```bash
curl -X POST http://localhost:8001/api/upload \
  -F "file=@backend/tests/fixtures/autogen_sample.jsonl" \
  -F "framework=autogen"
```

**Expected Results**:
- [ ] HTTP 200 OK response
- [ ] Response JSON contains:
  - `graph_id` (8-character string)
  - `message_count` (integer)
  - `node_count` (integer)
  - `edge_count` (integer)
  - `total_steps` (integer)
  - `framework` (string: "autogen")

**Example Response**:
```json
{
  "graph_id": "abc123de",
  "message_count": 15,
  "node_count": 4,
  "edge_count": 8,
  "total_steps": 14,
  "framework": "autogen"
}
```

**Pass/Fail**: _______

---

#### Test 5.2: Graph Retrieval - Full Graph
**Objective**: Test GET /api/graph/{graph_id} without filtering

**Steps**:
1. Note `graph_id` from upload response
2. Request full graph:
```bash
curl http://localhost:8001/api/graph/abc123de
```

**Expected Results**:
- [ ] HTTP 200 OK response
- [ ] Response JSON contains `graph` object with:
  - `nodes` array (length matches `node_count`)
  - `edges` array (length matches `edge_count`)
  - `total_steps` integer
  - `current_step` is null (no filtering)
  - `metadata` object

**Pass/Fail**: _______

---

#### Test 5.3: Graph Retrieval - Filtered by Step
**Objective**: Test GET /api/graph/{graph_id}?step=N

**Steps**:
```bash
curl http://localhost:8001/api/graph/abc123de?step=5
```

**Expected Results**:
- [ ] HTTP 200 OK response
- [ ] Response `current_step` = 5
- [ ] `edges` array only contains edges with interactions ≤ step 5
- [ ] Edge `weight` values are adjusted for filtered data
- [ ] Nodes without interactions at step 5 are excluded

**Pass/Fail**: _______

---

#### Test 5.4: Graph Metrics
**Objective**: Test GET /api/graph/{graph_id}/metrics

**Steps**:
```bash
curl http://localhost:8001/api/graph/abc123de/metrics
```

**Expected Results**:
- [ ] HTTP 200 OK response
- [ ] Response contains:
  - `node_count` (integer)
  - `edge_count` (integer)
  - `density` (float, 0.0 to 1.0)
  - `centrality` (object with agent names as keys)

**Pass/Fail**: _______

---

#### Test 5.5: Error Handling - Invalid Graph ID
**Objective**: Test 404 error for non-existent graph

**Steps**:
```bash
curl http://localhost:8001/api/graph/invalid123
```

**Expected Results**:
- [ ] HTTP 404 Not Found response
- [ ] Error message: "Graph not found" or similar

**Pass/Fail**: _______

---

### Test Suite 6: Data Persistence & Sessions

#### Test 6.1: Session Persistence During Use
**Objective**: Verify session data persists while app is open

**Steps**:
1. Upload a file and note `graph_id`
2. Interact with graph and timeline
3. Refresh browser page (F5)
4. Attempt to use same `graph_id` via API

**Expected Results**:
- [ ] After refresh, PreFlight modal appears (UI state lost - expected)
- [ ] Backend session still exists (API call succeeds)
- [ ] Can view graph via direct API call
- [ ] **Note**: Frontend does not persist graph_id in localStorage (expected in Phase 2)

**Pass/Fail**: _______

---

#### Test 6.2: Session Expiration
**Objective**: Test session cleanup after 24 hours

**Steps**:
1. Upload a file and note `graph_id`
2. Wait 24 hours OR manually modify backend session expiry time
3. Try to retrieve graph

**Expected Results**:
- [ ] After expiration, session is deleted
- [ ] API returns 404 Not Found
- [ ] Must re-upload file to continue

**Pass/Fail**: _______

---

### Test Suite 7: Cross-Browser Compatibility

#### Test 7.1: Chrome/Chromium
**Objective**: Test in Chrome/Edge/Brave

**Steps**: Repeat Test Suites 2-4 in Chrome

**Expected Results**:
- [ ] All features work as expected
- [ ] No console errors
- [ ] Graph renders smoothly

**Pass/Fail**: _______

---

#### Test 7.2: Firefox
**Objective**: Test in Firefox

**Steps**: Repeat Test Suites 2-4 in Firefox

**Expected Results**:
- [ ] All features work as expected
- [ ] No console errors
- [ ] Graph renders smoothly

**Pass/Fail**: _______

---

#### Test 7.3: Safari (macOS)
**Objective**: Test in Safari

**Steps**: Repeat Test Suites 2-4 in Safari

**Expected Results**:
- [ ] All features work as expected
- [ ] No console errors
- [ ] Graph renders smoothly

**Pass/Fail**: _______

---

### Test Suite 8: Performance & Load

#### Test 8.1: Small Log File (<20 messages)
**Objective**: Test with minimal data

**Steps**:
1. Upload log file with <20 messages
2. Measure processing time

**Expected Results**:
- [ ] Upload completes in <1 second
- [ ] Graph renders in <500ms
- [ ] Timeline scrubbing is instant (<100ms per step)
- [ ] No lag or stuttering

**Pass/Fail**: _______

---

#### Test 8.2: Medium Log File (50-100 messages)
**Objective**: Test with typical data volume

**Steps**:
1. Upload log file with 50-100 messages
2. Measure processing time

**Expected Results**:
- [ ] Upload completes in 1-3 seconds
- [ ] Graph renders in <1 second
- [ ] Timeline scrubbing is smooth (<200ms per step)
- [ ] Minor lag acceptable during layout calculation

**Pass/Fail**: _______

---

#### Test 8.3: Large Log File (>200 messages)
**Objective**: Test performance limits

**Steps**:
1. Upload log file with >200 messages
2. Observe performance

**Expected Results**:
- [ ] Upload completes in <5 seconds
- [ ] Graph may take 2-3 seconds to render
- [ ] Timeline scrubbing may have slight delay (<500ms)
- [ ] No crashes or errors
- [ ] **Note**: Phase 2 optimized for <100 messages (expected)

**Pass/Fail**: _______

---

### Test Suite 9: Edge Cases

#### Test 9.1: Empty Log File
**Objective**: Test with empty file

**Steps**:
1. Create empty file: `touch empty.jsonl`
2. Attempt upload

**Expected Results**:
- [ ] Upload fails gracefully
- [ ] Error message: "No valid messages found in log file"
- [ ] Modal remains open for retry

**Pass/Fail**: _______

---

#### Test 9.2: Single Message
**Objective**: Test with minimal valid data

**Steps**:
1. Upload log with exactly 1 message
2. Observe graph

**Expected Results**:
- [ ] Upload succeeds
- [ ] Graph shows 1 node (sender)
- [ ] No edges (no receiver)
- [ ] Timeline shows "Step 0 / 0"

**Pass/Fail**: _______

---

#### Test 9.3: Graph with No Edges
**Objective**: Test broadcast messages only (no directed communication)

**Steps**:
1. Upload log where all messages have `receiver: null`
2. Observe graph

**Expected Results**:
- [ ] Graph shows nodes but no edges
- [ ] No errors or crashes
- [ ] Timeline works normally

**Pass/Fail**: _______

---

#### Test 9.4: Circular Communication
**Objective**: Test detection of loops (A→B→A pattern)

**Steps**:
1. Upload log with circular pattern
2. Observe graph

**Expected Results**:
- [ ] Bidirectional edges render correctly
- [ ] No infinite loops in rendering
- [ ] **Note**: Loop highlighting coming in Phase 3

**Pass/Fail**: _______

---

## Troubleshooting

### Issue: "Connection Refused" Error in Frontend

**Symptoms**:
- Browser console shows: `ERR_CONNECTION_REFUSED`
- Upload fails immediately

**Solution**:
1. Check backend is running: `curl http://localhost:8001/health`
2. Verify backend port is 8001 (not 8000)
3. Check CORS settings in `backend/app/main.py`

---

### Issue: Graph Not Rendering

**Symptoms**:
- Upload succeeds
- Dashboard appears but center panel is blank

**Solution**:
1. Open browser console (F12)
2. Check for React Flow errors
3. Verify graph data returned from API: `GET /api/graph/{id}`
4. Check if nodes array is empty

---

### Issue: Timeline Slider Not Moving Graph

**Symptoms**:
- Slider moves but graph doesn't update

**Solution**:
1. Check Network tab for API calls to `/api/graph/{id}?step=X`
2. Verify `currentStep` state updates in React DevTools
3. Check TanStack Query cache in DevTools

---

### Issue: "Module Not Found" Errors

**Symptoms**:
- Vite build fails with import errors

**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

### Issue: Backend Tests Failing

**Symptoms**:
- `pytest` shows failures

**Solution**:
1. Ensure in virtual environment: `poetry shell`
2. Check Python version: `python --version` (should be 3.10+)
3. Re-install dependencies: `poetry install`

---

## Sample Data

### Built-in Mock Data (Recommended for Testing)

**File**: `frontend/public/mock_chat_history.jsonl`

A comprehensive 34-message multi-agent conversation demonstrating a realistic software development scenario.

**Quick Access**: Click "Load Sample Data (34 messages)" button in the PreFlight modal.

**Scenario Details**:
- **Agents**: ProductManager, TechLead, BackendDev, FrontendDev, DatabaseAdmin, Designer, QAEngineer, SecurityEngineer, DevOps
- **Duration**: 3 hours (09:00 - 11:50)
- **Task**: Implementing a real-time notification system
- **Features Demonstrated**:
  - Task delegation patterns
  - Multi-agent collaboration
  - Testing and iteration loops
  - Security review workflow
  - Deployment process

**Graph Characteristics**:
- 9 nodes (agents)
- Hub-and-spoke patterns (Manager → Team)
- Peer-to-peer collaboration
- Feedback loops (QA → Dev → QA)
- Temporal evolution as agents join

### AutoGen Sample Log Format

**File**: `backend/tests/fixtures/autogen_sample.jsonl`

Each line is a JSON object:

```json
{
  "sender": "Manager",
  "recipient": "Coder",
  "message": "Please implement the authentication feature",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Creating Custom Test Data

**Minimal Valid Log**:

```jsonl
{"sender": "Alice", "recipient": "Bob", "message": "Hello Bob"}
{"sender": "Bob", "recipient": "Alice", "message": "Hi Alice"}
```

**Multi-Agent Conversation**:

```jsonl
{"sender": "Manager", "recipient": "Planner", "message": "Create project plan"}
{"sender": "Planner", "recipient": "Manager", "message": "Plan ready"}
{"sender": "Manager", "recipient": "Coder", "message": "Implement features"}
{"sender": "Coder", "recipient": "Reviewer", "message": "Code ready"}
{"sender": "Reviewer", "recipient": "Manager", "message": "Approved"}
```

---

## Test Execution Log

**Tester**: _________________
**Date**: _________________
**Environment**: _________________

| Test ID | Description | Pass | Fail | Notes |
|---------|-------------|------|------|-------|
| 1.1 | Backend Install | ☐ | ☐ | |
| 1.2 | Backend Startup | ☐ | ☐ | |
| 1.3 | Frontend Install | ☐ | ☐ | |
| 1.4 | Frontend Startup | ☐ | ☐ | |
| 2.1 | Initial Load | ☐ | ☐ | |
| 2.2 | File Selection | ☐ | ☐ | |
| 2.3 | Upload Success | ☐ | ☐ | |
| 2.4 | Invalid File Error | ☐ | ☐ | |
| 2.5 | Network Error | ☐ | ☐ | |
| 3.1 | Initial Render | ☐ | ☐ | |
| 3.2 | Layout Algorithm | ☐ | ☐ | |
| 3.3 | Zoom | ☐ | ☐ | |
| 3.4 | Pan | ☐ | ☐ | |
| 3.5 | Node Interaction | ☐ | ☐ | |
| 4.1 | Timeline Initial | ☐ | ☐ | |
| 4.2 | Manual Scrubbing | ☐ | ☐ | |
| 4.3 | Play Animation | ☐ | ☐ | |
| 4.4 | Skip to Start | ☐ | ☐ | |
| 4.5 | Skip to End | ☐ | ☐ | |
| 4.6 | Play to End | ☐ | ☐ | |
| 5.1 | Upload Endpoint | ☐ | ☐ | |
| 5.2 | Full Graph | ☐ | ☐ | |
| 5.3 | Filtered Graph | ☐ | ☐ | |
| 5.4 | Metrics | ☐ | ☐ | |
| 5.5 | Invalid Graph ID | ☐ | ☐ | |
| 6.1 | Session Persist | ☐ | ☐ | |
| 6.2 | Session Expiry | ☐ | ☐ | |
| 7.1 | Chrome | ☐ | ☐ | |
| 7.2 | Firefox | ☐ | ☐ | |
| 7.3 | Safari | ☐ | ☐ | |
| 8.1 | Small File | ☐ | ☐ | |
| 8.2 | Medium File | ☐ | ☐ | |
| 8.3 | Large File | ☐ | ☐ | |
| 9.1 | Empty File | ☐ | ☐ | |
| 9.2 | Single Message | ☐ | ☐ | |
| 9.3 | No Edges | ☐ | ☐ | |
| 9.4 | Circular Comm | ☐ | ☐ | |

**Total**: ___ / 38 tests passed

---

## Next Steps

After completing this test plan:

1. **Report Issues**: Document any failed tests as GitHub issues
2. **Phase 3 Planning**: Use test results to prioritize Phase 3 features
3. **Performance Optimization**: Address any performance bottlenecks found
4. **Documentation Updates**: Add any missing steps or clarifications to this guide

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial release for Phase 2 MVP |

---

**End of Usage Guide & Test Plan**
