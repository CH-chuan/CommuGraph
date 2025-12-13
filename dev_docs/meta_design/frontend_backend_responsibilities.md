# Frontend vs Backend Responsibilities

**Document Purpose**: This document clearly delineates what work is performed by the frontend (React/TypeScript) versus the backend (Python/FastAPI) in CommuGraph's architecture.

**Last Updated**: 2025-12-09

---

## Architecture Philosophy

CommuGraph follows a **clear separation of concerns**:
- **Backend = Data & Logic**: All heavy computation, data processing, and business logic
- **Frontend = Presentation & Interaction**: Visualization, user interactions, and UI state management

This separation ensures:
1. The backend can be consumed by multiple clients (web UI, CLI tools, notebooks)
2. The frontend remains responsive with all heavy work offloaded to the backend
3. Each layer can be developed, tested, and deployed independently

---

## Backend Responsibilities (Python/FastAPI)

### Core Domains

#### 1. **Log Parsing & Validation**
**What**: Convert raw multi-agent chat logs into structured data

**Implementation**:
- Location: `backend/app/parsers/`
- Framework-specific parsers (AutoGen, CrewAI, etc.) inherit from `BaseParser`
- Each parser implements `parse(file_path) -> List[Message]`
- Pydantic models validate and normalize messy LLM log formats

**Why Backend**: Log formats vary wildly; robust error handling and validation require Python's rich ecosystem (Pydantic, pandas)

**Example Flow**:
```
User uploads JSONL → Backend receives file → AutoGenParser.parse()
→ Validates with Pydantic → Returns List[Message]
```

---

#### 2. **Graph Construction**
**What**: Build temporal communication graphs from parsed messages

**Implementation**:
- Location: `backend/app/services/graph_builder.py`
- Uses NetworkX to construct directed graphs
- Edges store `List[Interaction]` with timestamps and step indices
- Calculates graph metrics (centrality, clustering coefficients)

**Why Backend**: Graph algorithms are CPU-intensive; NetworkX is Python's standard library

**Data Structures**:
```python
# Backend creates:
Node: {id: "agent_name", type: "agent", metadata: {...}}
Edge: {source: "A", target: "B", interactions: [
    {timestamp: "...", step_index: 5, content: "...", intent: "delegation"}
]}
```

---

#### 3. **Temporal Filtering**
**What**: Slice graphs by time/step to show conversation evolution

**Implementation**:
- Function: `filter_graph_by_step(G: nx.DiGraph, max_step: int)`
- Creates subgraphs containing only interactions up to step N
- Recalculates edge weights based on filtered interactions

**Why Backend**: Filtering is a data operation; avoids sending massive graphs to frontend

**API Contract**:
```
GET /api/graph/{graph_id}?step=25
→ Backend returns only nodes/edges visible at step 25
```

---

#### 4. **Analytics & Anomaly Detection**
**What**: Detect patterns (loops, stagnation, bottlenecks)

**Implementation**:
- Location: `backend/app/services/analyzer.py`
- Algorithms:
  - Loop detection (cycles in temporal graph)
  - Stagnation detection (repeated failed interactions)
  - Centrality analysis (identify critical agents)

**Why Backend**: Complex algorithms requiring graph theory expertise; Python's scipy/networkx ecosystem

**Metrics Exposed**:
```json
{
  "loop_detected": true,
  "loop_agents": ["AgentA", "AgentB"],
  "stagnation_periods": [{"start_step": 10, "end_step": 15}],
  "centrality_scores": {"AgentA": 0.85, "AgentB": 0.45}
}
```

---

#### 5. **LLM Integration (Semantic Abstraction)**
**What**: Use LLMs to generate natural language summaries of interactions

**Implementation**:
- Location: `backend/app/services/llm_service.py`
- Abstracts raw message content into high-level intents
- Generates insights and report narratives

**Why Backend**:
- API keys/secrets should never touch the frontend
- LLM calls are I/O-bound; FastAPI's async handles this efficiently
- Prevents exposing OpenAI/Anthropic credentials in browser

**Example**:
```
Raw message: "Here's the data you requested: [1000 lines of JSON]"
↓ Backend LLM processing ↓
Abstraction: "Data transfer: AgentA → AgentB (delegation intent)"
```

---

#### 6. **Session Management**
**What**: Cache processed graphs to avoid re-computation

**Implementation**:
- Location: `backend/app/services/session_manager.py`
- In-memory dictionary: `{graph_id: {graph: nx.DiGraph, metadata: {...}}}`
- No database required (scale assumption: <100 messages per session)

**Why Backend**: Server-side caching prevents re-parsing logs on every timeline scrub

---

#### 7. **API Contract Definition**
**What**: Provide well-defined REST and WebSocket APIs

**Implementation**:
- Location: `backend/app/api/endpoints/`
- FastAPI auto-generates OpenAPI docs at `/docs`
- All endpoints use Pydantic schemas for request/response validation

**Key Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload log file, return `graph_id` |
| `/api/graph/{id}` | GET | Retrieve graph (optionally filtered by `?step=N`) |
| `/api/graph/{id}/metrics` | GET | Get analytics (centrality, anomalies) |
| `/ws/analysis/{id}` | WebSocket | Stream real-time updates |

**Why Backend**: Single source of truth for API contract; type-safe communication

---

## Frontend Responsibilities (React/TypeScript)

### Core Domains

#### 1. **Interactive Graph Visualization**
**What**: Render node-link diagrams with smooth animations

**Implementation**:
- Location: `frontend/src/components/graph/GraphView.tsx`
- Uses React Flow (`@xyflow/react`)
- Auto-layout with dagre algorithm
- Custom node/edge renderers (avatars, colors, labels)

**Why Frontend**:
- React Flow requires React; cannot run in Python
- Browser rendering is optimized for SVG/Canvas
- User interactions (zoom, pan, drag) need low-latency DOM updates

**Data Flow**:
```
Backend sends: {nodes: [...], edges: [...]}
→ Frontend transforms to React Flow format
→ dagre calculates positions
→ React Flow renders SVG
```

---

#### 2. **Timeline Controls & Playback**
**What**: Let users scrub through conversation history

**Implementation**:
- Location: `frontend/src/components/graph/TimelineControls.tsx`
- Slider: Set `currentStep` state
- Play/Pause: Auto-increment step every 1 second
- Step navigation: Keyboard arrows (future)

**Why Frontend**:
- UI state (current step) lives in React
- Smooth animations require requestAnimationFrame (browser API)
- No need to persist timeline position on server

**Interaction Flow**:
```
User drags slider to step 25
→ Frontend: setCurrentStep(25)
→ TanStack Query refetches: GET /api/graph/{id}?step=25
→ Backend returns filtered graph
→ React Flow re-renders with new data
```

---

#### 3. **File Upload & Pre-Flight Modal**
**What**: Guide users through log upload and abstraction config

**Implementation**:
- Location: `frontend/src/components/upload/PreFlightModal.tsx`
- Drag-and-drop file upload
- Framework selection (AutoGen, CrewAI, etc.)
- Abstraction settings (LLM model, prompt customization)

**Why Frontend**:
- UI/UX concerns (form validation, progress indicators)
- File upload uses browser FormData API
- Backend shouldn't care about UI layout

**Submission Flow**:
```
User drops JSONL file
→ Frontend validates: file size, extension
→ POST /api/upload with multipart/form-data
→ Backend processes and returns graph_id
→ Frontend navigates to visualization view
```

---

#### 4. **Multi-Panel Layout Management**
**What**: Resizable 3-column layout (Log | Graph | Insights)

**Implementation**:
- Location: `frontend/src/components/layout/MainLayout.tsx`
- Uses `react-resizable-panels`
- Panel sizes stored in React Context or localStorage

**Why Frontend**:
- Layout state is purely UI concern
- Dragging gutters requires DOM manipulation
- Backend has no concept of "panels"

**Panels**:
- **Left**: Narrative Log (message list with auto-scroll)
- **Center**: Graph + Timeline (React Flow + scrubber)
- **Right**: Insight Engine (metrics, anomalies)

---

#### 5. **API Client & Data Fetching**
**What**: Handle all HTTP/WebSocket communication with backend

**Implementation**:
- Location: `frontend/src/api/client.ts`
- Uses Axios for HTTP, native WebSocket API
- TanStack Query for caching, refetching, loading states

**Why Frontend**:
- React ecosystem best practices (React Query)
- Automatic retry, deduplication, stale-while-revalidate
- Loading/error states sync with UI

**Example Hook**:
```typescript
// frontend/src/hooks/useGraphData.ts
export const useGraphData = (graphId: string, step: number) => {
  return useQuery({
    queryKey: ['graph', graphId, step],
    queryFn: () => api.getGraph(graphId, step),
    staleTime: 1000 * 60 * 5, // Cache for 5 min
  });
};
```

---

#### 6. **UI State Management**
**What**: Manage ephemeral UI state (selected node, panel sizes, etc.)

**Implementation**:
- Location: `frontend/src/context/AppContext.tsx`
- React Context for global state
- Local component state for isolated concerns

**State Categories**:
- **Server State** (managed by TanStack Query): graphs, metrics, messages
- **UI State** (managed by React Context): currentStep, selectedNode, panelSizes
- **Form State** (managed by local `useState`): upload form inputs

**Why Frontend**:
- UI state is transient (doesn't need persistence)
- Backend is stateless per-request (no session storage for UI preferences)

---

#### 7. **User Interaction Handling**
**What**: Respond to clicks, hovers, keyboard shortcuts

**Implementation**:
- Event handlers in components
- Keyboard shortcuts (future): `Space` for play/pause, arrows for step navigation
- React Flow events: `onNodeClick`, `onEdgeClick`

**Why Frontend**:
- Browser events can't be handled by backend
- Low latency required (16ms for 60fps)

**Example**:
```typescript
const onNodeClick = (event, node) => {
  setSelectedNode(node.id);
  // Could trigger: GET /api/graph/{id}/node/{node_id} for details
};
```

---

#### 8. **Type Safety & Validation**
**What**: Mirror backend Pydantic models as TypeScript interfaces

**Implementation**:
- Location: `frontend/src/types/graph.ts`, `api.ts`
- Manually maintained (future: OpenAPI code generation)

**Example**:
```typescript
// Mirrors backend/app/models/types.py
export interface Interaction {
  timestamp: string;
  step_index: number;
  content: string;
  intent?: string;
}

export interface EdgeData {
  interactions: Interaction[];
  weight: number;
}
```

**Why Frontend**:
- TypeScript compiler catches mismatches before runtime
- IntelliSense autocomplete in IDE

---

## Data Flow Scenarios

### Scenario 1: Initial Upload & Visualization

**Step 1: User Uploads File**
- **Frontend**:
  - `PreFlightModal` validates file (size, extension)
  - Sends `POST /api/upload` with FormData
  - Shows loading spinner
- **Backend**:
  - Receives file, saves to temp directory
  - Selects parser (AutoGen, CrewAI)
  - Parses JSONL → `List[Message]`
  - Builds NetworkX graph
  - Runs LLM abstraction (if enabled)
  - Caches graph in session store
  - Returns `{graph_id: "abc123", total_steps: 42}`
- **Frontend**:
  - Receives `graph_id`
  - Navigates to `/graph/abc123`

**Step 2: Render Initial Graph**
- **Frontend**:
  - Calls `useGraphData("abc123", step=0)`
  - TanStack Query sends `GET /api/graph/abc123?step=0`
- **Backend**:
  - Loads graph from cache
  - Filters to step 0 (initial state)
  - Serializes to JSON: `{nodes: [...], edges: [...]}`
- **Frontend**:
  - Transforms to React Flow format
  - dagre calculates layout
  - React Flow renders graph

---

### Scenario 2: Timeline Scrubbing

**User Action**: Drags timeline slider from step 10 → step 25

- **Frontend**:
  - `onChange` handler sets `currentStep = 25`
  - TanStack Query detects query key change: `['graph', 'abc123', 25]`
  - Automatically refetches `GET /api/graph/abc123?step=25`
- **Backend**:
  - Loads cached graph
  - Filters edges: only keep interactions where `step_index <= 25`
  - Recalculates edge weights
  - Returns filtered graph JSON
- **Frontend**:
  - React Flow transitions to new graph with animations
  - Edge labels update (e.g., "3 interactions" → "5 interactions")

**Performance**:
- Backend filtering takes ~10ms (no re-parsing)
- Network latency: ~20ms (localhost)
- React Flow renders in ~16ms (60fps)
- Total latency: ~50ms (feels instant)

---

### Scenario 3: Anomaly Detection

**User Action**: Clicks "Analyze" button

- **Frontend**:
  - Sends `POST /api/graph/abc123/analyze`
  - Shows loading indicator in Insight Engine panel
- **Backend**:
  - Runs loop detection algorithm (DFS for cycles)
  - Runs stagnation detection (repeated failed interactions)
  - Calculates centrality scores (PageRank)
  - Returns `{loops: [...], stagnation: [...], centrality: {...}}`
- **Frontend**:
  - Displays results in Insight Engine panel
  - Highlights loop nodes in red on graph
  - Adds stagnation markers to timeline

**Optional: WebSocket for Real-Time Updates**
- **Backend**: Streams partial results as they compute
  ```
  WS /ws/analysis/abc123
  → {type: "loop_found", agents: ["A", "B"]}
  → {type: "centrality_computed", scores: {...}}
  ```
- **Frontend**: Updates UI incrementally (no full page reload)

---

### Scenario 4: LLM Abstraction

**Pre-Flight Stage** (happens during upload):

- **Frontend**:
  - User enables "Semantic Abstraction" in PreFlightModal
  - Selects LLM model (GPT-4, Claude Sonnet)
- **Backend**:
  - After parsing logs, sends messages to LLM
  - Prompt: "Summarize this interaction in one sentence"
  - Caches abstractions in `Interaction` objects
  - Field: `Interaction.intent = "delegation" | "data_transfer" | "error_handling"`
- **Frontend**:
  - Receives graph with `.intent` labels on edges
  - Displays intent badges on edge labels
  - Enables intent-based filtering UI

**Why LLM Stays in Backend**:
1. API keys never exposed to browser (security)
2. Rate limiting and retries handled server-side
3. Caching prevents redundant LLM calls

---

## Technology Choices Rationale

### Why Not Put Graph Algorithms in Frontend?

**Option**: Use JavaScript graph libraries (e.g., Cytoscape.js, graphology)

**Rejected Because**:
- NetworkX has 15+ years of optimization for graph algorithms
- Python's scientific ecosystem (scipy, pandas) integrates seamlessly
- JavaScript graph libraries lack temporal graph primitives
- Centrality algorithms are CPU-bound (Python is faster with NumPy)

**Compromise**: Frontend only does **layout** (dagre for positioning), not graph analysis

---

### Why Not Use Server-Side Rendering (SSR)?

**Option**: Use Next.js to render React on server

**Rejected Because**:
- Graph visualization requires DOM manipulation (React Flow, D3.js)
- Interactive timeline needs requestAnimationFrame (browser API)
- No SEO benefit (internal tool, not public website)
- FastAPI backend is already async; no need for Node.js server

**Compromise**: Frontend is a static SPA; backend is a pure API

---

### Why Not Use GraphQL Instead of REST?

**Option**: Replace FastAPI REST with GraphQL API

**Rejected Because**:
- REST is simpler for CRUD operations (`GET /graph/{id}?step=N`)
- FastAPI auto-generates OpenAPI docs (GraphQL requires manual schema)
- No over-fetching problem (graphs are monolithic, not relational)
- WebSocket already handles real-time updates

**Future Consideration**: If mobile app or CLI tools need flexible queries, consider GraphQL

---

## Rules of Thumb

### When to Add Logic to Backend

1. **CPU-intensive computation** (graph algorithms, ML inference)
2. **Requires external APIs** (LLM calls, database queries)
3. **Needs to be reusable** (CLI tool, Jupyter notebook should use same logic)
4. **Security-sensitive** (API keys, authentication, rate limiting)
5. **Data transformation** (parsing, validation, normalization)

### When to Add Logic to Frontend

1. **UI state management** (selected node, panel sizes, form inputs)
2. **DOM manipulation** (animations, canvas rendering)
3. **User interaction handling** (clicks, drags, keyboard shortcuts)
4. **Client-side routing** (navigation between views)
5. **Formatting for display** (humanize timestamps, color mapping)

### Gray Areas (Require Discussion)

1. **Edge Filtering by Intent**:
   - Backend? Pre-filter before sending to frontend
   - Frontend? Filter in React Flow (avoids API calls)
   - **Decision**: Backend for consistency with step filtering

2. **Node Position Persistence**:
   - Backend? Store in session or database
   - Frontend? Store in localStorage
   - **Decision**: Frontend (user preference, not shared)

3. **Graph Export (PNG/SVG)**:
   - Backend? Use NetworkX/matplotlib to generate image
   - Frontend? Use React Flow's export API
   - **Decision**: Frontend (captures exact user viewport)

---

## Current Implementation Status

### Backend (Complete ✅)
- ✅ Log parsing (AutoGen parser)
- ✅ Graph construction (NetworkX)
- ✅ Temporal filtering (`filter_graph_by_step`)
- ✅ Session management (in-memory cache)
- ✅ REST API endpoints (upload, graph retrieval)
- ⏳ LLM abstraction service (planned)
- ⏳ Anomaly detection (planned)
- ⏳ WebSocket for live updates (planned)

### Frontend (Complete ✅)
- ✅ React + TypeScript + Vite setup
- ✅ React Flow graph visualization
- ✅ Timeline controls with play/pause
- ✅ PreFlightModal for uploads
- ✅ TanStack Query for API caching
- ✅ AppContext for global state
- ⏳ Resizable panels (planned)
- ⏳ Narrative Log panel (planned)
- ⏳ Insight Engine panel (planned)

---

## Future Architecture Considerations

### Scaling Beyond Current Assumptions

**If logs grow to >1000 messages**:
- Backend: Switch from in-memory to Redis/PostgreSQL for session storage
- Frontend: Implement virtualization for message list (react-window)

**If graphs exceed >500 nodes**:
- Backend: Use graph database (Neo4j) instead of NetworkX
- Frontend: Implement edge filtering UI (show only top-N edges by weight)

**If real-time collaboration is needed**:
- Backend: Add WebSocket for multi-user synchronization
- Frontend: Use CRDT (Conflict-Free Replicated Data Type) for shared state

---

## Appendix: API Contract Examples

### Upload Endpoint
```
POST /api/upload
Content-Type: multipart/form-data

Request Body:
- file: JSONL file
- framework: "autogen" | "crewai"
- abstraction_enabled: boolean

Response:
{
  "graph_id": "abc123",
  "total_steps": 42,
  "message_count": 38,
  "agent_count": 5
}
```

### Graph Retrieval Endpoint
```
GET /api/graph/{graph_id}?step=25

Response:
{
  "nodes": [
    {"id": "AgentA", "type": "agent", "label": "Agent A", "metadata": {...}},
    {"id": "AgentB", "type": "agent", "label": "Agent B", "metadata": {...}}
  ],
  "edges": [
    {
      "source": "AgentA",
      "target": "AgentB",
      "interactions": [
        {"timestamp": "2025-12-08T10:00:00Z", "step_index": 5, "content": "...", "intent": "delegation"},
        {"timestamp": "2025-12-08T10:01:00Z", "step_index": 15, "content": "...", "intent": "response"}
      ],
      "weight": 2
    }
  ],
  "current_step": 25,
  "total_steps": 42
}
```

### Metrics Endpoint
```
GET /api/graph/{graph_id}/metrics

Response:
{
  "centrality": {
    "AgentA": 0.85,
    "AgentB": 0.45,
    "AgentC": 0.30
  },
  "loops": [
    {"agents": ["AgentA", "AgentB"], "start_step": 10, "end_step": 20}
  ],
  "stagnation_periods": [
    {"start_step": 25, "end_step": 30, "reason": "repeated_failures"}
  ],
  "total_interactions": 38,
  "average_response_time_seconds": 2.5
}
```

---

## Summary Table

| Responsibility | Backend (Python/FastAPI) | Frontend (React/TypeScript) |
|----------------|--------------------------|------------------------------|
| **Log Parsing** | ✅ Owns (framework-specific parsers) | ❌ Never touches raw logs |
| **Graph Construction** | ✅ Owns (NetworkX) | ❌ Only receives serialized graphs |
| **Temporal Filtering** | ✅ Owns (`filter_graph_by_step`) | ❌ Requests via `?step=N` param |
| **Analytics** | ✅ Owns (centrality, anomaly detection) | ❌ Displays results |
| **LLM Calls** | ✅ Owns (API keys, abstraction) | ❌ Never sees API keys |
| **Session Caching** | ✅ Owns (in-memory graph store) | ❌ Uses `graph_id` as opaque handle |
| **Graph Rendering** | ❌ Doesn't render | ✅ Owns (React Flow, SVG) |
| **Timeline UI** | ❌ No concept of "slider" | ✅ Owns (play/pause, scrubbing) |
| **Layout Calculation** | ❌ Sends raw nodes/edges | ✅ Owns (dagre positions) |
| **User Interactions** | ❌ Stateless API | ✅ Owns (clicks, drags, keyboard) |
| **API Caching** | ❌ Responds per-request | ✅ Owns (TanStack Query cache) |
| **Type Definitions** | ✅ Source of truth (Pydantic) | ✅ Mirrors (TypeScript) |

---

**Key Takeaway**: Backend is the **data authority**, frontend is the **presentation authority**. They communicate via a well-defined REST API, with the backend doing all heavy lifting and the frontend providing a responsive, interactive UI.
