# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CommuGraph** is a process mining and analytics tool for multi-agent chat logs. It transforms complex multi-agent conversations into interactive graph visualizations with temporal analysis capabilities.

**Architecture**: Hybrid monorepo with a **React frontend** (TypeScript + Vite) and **FastAPI backend** (Python). The Python backend handles all analytics, graph construction, and LLM orchestration, while React provides the sophisticated interactive UI required for resizable panels, smooth animations, and synchronized multi-component updates.

**Core Philosophy**: Leverage Python for what it's best at (data processing, graph algorithms, ML/LLM integration) and React for complex, interactive visualizations.

## Development Commands

### Initial Setup

**Backend (Python)**:
```bash
cd backend
poetry install              # Or: pip install -e .
```

**Frontend (Node.js)**:
```bash
cd frontend
npm install                 # Or: pnpm install
```

### Running Locally

**Option A: Separate Terminals**

Terminal 1 (Backend):
```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8001
# API will be available at http://localhost:8001
# Auto-generated docs at http://localhost:8001/docs
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
# Vite dev server at http://localhost:5173
```

**Option B: Docker Compose** (Recommended for full-stack testing)
```bash
docker-compose up
# Both services start with hot-reloading enabled
```

### Testing

**Backend Tests** (Python):
```bash
cd backend
pytest                           # Run all tests
pytest tests/test_parsers.py     # Specific test file
pytest --cov=app                 # With coverage
```

**Frontend Tests** (TypeScript):
```bash
cd frontend
npm run test                     # Vitest unit tests
npm run test:coverage            # With coverage
```

### Code Quality

**Backend (Python)**:
```bash
cd backend
ruff check .                     # Fast linting
black .                          # Code formatting
mypy app/                        # Type checking

# Run all checks before committing
ruff check . && black . && mypy app/ && pytest
```

**Frontend (TypeScript)**:
```bash
cd frontend
npm run lint                     # ESLint
npm run format                   # Prettier
npm run tsc                      # TypeScript compilation check

# Run all checks before committing
npm run lint && npm run tsc && npm run test
```

### Building for Production

**Frontend Build**:
```bash
cd frontend
npm run build
# Output: frontend/dist/ (static files)
```

**Backend Packaging**:
```bash
cd backend
docker build -t commugraph-backend:latest .
# Or: poetry build (for Python wheel distribution)
```

## Architecture

### Directory Structure
```
CommuGraph/                      # Monorepo root
│
├── frontend/                    # React Application (TypeScript)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── graph/           # GraphView (React Flow), TimelineControls
│   │   │   ├── layout/          # Header, MainLayout
│   │   │   ├── upload/          # PreFlightModal
│   │   │   └── ui/              # shadcn/ui components
│   │   ├── hooks/               # Custom React hooks (useGraphData, useUpload, useTimelinePlayback)
│   │   ├── api/                 # API client (Axios/TanStack Query)
│   │   ├── context/             # React Context (AppContext)
│   │   ├── types/               # TypeScript type definitions (graph.ts, api.ts)
│   │   ├── utils/               # Utility functions (graphAdapters)
│   │   ├── lib/                 # Shared utilities (utils.ts)
│   │   ├── App.tsx              # Main application component
│   │   └── main.tsx             # Entry point
│   ├── .env.local               # Environment variables
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── components.json          # shadcn/ui config
│
├── backend/                     # FastAPI Server (Python)
│   ├── app/
│   │   ├── api/                 # API route handlers
│   │   │   ├── endpoints/       # REST endpoints (upload, graph, analyze)
│   │   │   └── websockets/      # WebSocket for real-time updates
│   │   ├── core/                # Config, security, logging, middleware
│   │   ├── services/            # Business logic layer
│   │   │   ├── parser.py        # Log parsing orchestration
│   │   │   ├── graph_builder.py # Graph construction service
│   │   │   ├── analyzer.py      # Anomaly detection, metrics
│   │   │   └── llm_service.py   # LLM abstraction & report generation
│   │   ├── models/              # Pydantic models (Message, EdgeData, etc.)
│   │   ├── parsers/             # Framework-specific parsers
│   │   │   ├── base_parser.py
│   │   │   ├── autogen_parser.py
│   │   │   └── crewai_parser.py
│   │   ├── schemas/             # API request/response schemas
│   │   └── main.py              # FastAPI app entry point
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── notebooks/                   # Jupyter notebooks for experimentation
├── dev_docs/                    # Design documents
├── docker-compose.yml           # Local development orchestration
└── README.md
```

### Critical Architectural Concepts

#### Client-Server Separation

**Backend Responsibilities** (Python/FastAPI):
- Log parsing and validation
- Graph construction (NetworkX)
- Analytics algorithms (centrality, anomaly detection)
- LLM integration (OpenAI, Anthropic for abstractions)
- Data persistence (JSONL, session state)

**Frontend Responsibilities** (React/TypeScript):
- Interactive graph rendering (React Flow)
- Timeline visualization (Recharts)
- UI state management (React Context/Zustand)
- Real-time user interactions (resizable panels, playback controls)
- API communication (REST + WebSocket)

#### Temporal Edge Model

The core innovation is **time-aware edges**. Unlike traditional static graphs, edges store a list of `Interaction` objects with timestamps, step indices, and intent labels. This enables:
- Time-slider visualization (show graph state at step N)
- Intent-based filtering (show only "delegation" edges)
- Temporal pattern detection (loops, stagnation)

**Backend Implementation**: `backend/app/models/types.py` defines `EdgeData` and `Interaction` Pydantic models.

**Frontend Implementation**: TypeScript interfaces in `frontend/src/types/graph.ts` mirror these structures for type safety.

#### Parser Abstraction

All log parsers inherit from `BaseParser` and implement a `parse()` method that returns `List[Message]`.

**To add a new parser**:
1. Create `backend/app/parsers/<framework>_parser.py`
2. Inherit from `BaseParser`
3. Implement `parse(file_path) -> List[Message]`
4. Register in `backend/app/services/parser.py`
5. Add API endpoint in `backend/app/api/endpoints/upload.py`

#### Data Flow Pipeline

**Pre-Flight Stage** (Heavy Computation):
```
1. Frontend: User uploads JSONL file
2. POST /api/upload → Backend receives file
3. Backend: Parse logs → Build graph → Run LLM abstraction
4. Backend: Cache processed data in session
5. Return graph_id to frontend
```

**Visualization Stage** (Real-Time Interaction):
```
1. GET /api/graph/{graph_id}?step=25 → Backend filters graph to step 25
2. Backend returns JSON: {nodes: [...], edges: [...]}
3. Frontend: React Flow renders graph with animations
4. User scrubs timeline → Frontend requests new step → Repeat
```

**WebSocket for Live Updates** (Optional):
```
WS /ws/analysis/{graph_id}
- Backend streams anomaly detection results as they're computed
- Frontend updates UI in real-time
```

### Technology Stack

#### Backend (Python)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| API Framework | FastAPI | High performance, async support, auto-generated OpenAPI docs |
| Graph Library | NetworkX | Standard for graph algorithms, sufficient for <500 nodes |
| Data Validation | Pydantic | Strict typing for messy LLM logs, API schemas |
| Storage | Pandas/JSONL | In-memory processing for <1000 messages |
| LLM Integration | OpenAI SDK / Anthropic SDK | For semantic abstraction of messages |
| Testing | pytest | Comprehensive test suite with fixtures |
| Dependency Mgmt | Poetry | Modern Python packaging and dependency resolution |

#### Frontend (TypeScript)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | React 18+ | Component-based architecture, rich ecosystem |
| Build Tool | Vite | Fast HMR, optimal for dev experience |
| Language | TypeScript | Type safety for complex graph data structures |
| Graph Visualization | React Flow (@xyflow/react) | Purpose-built for interactive node-link diagrams |
| Charts | Recharts | Declarative charts for timeline/swimlanes |
| Layout Management | react-split or react-resizable-panels | Draggable column gutters |
| State Management | TanStack Query + React Context | API caching and global UI state |
| API Client | Axios | HTTP requests to FastAPI backend |
| Package Manager | npm or pnpm | Standard Node.js tooling |

## Design Constraints

### Scale Assumptions
- Chat logs typically contain <100 messages
- Graph will have <50 nodes (agents)
- No database needed; JSONL + Pandas is sufficient for backend
- React Flow can handle this scale with smooth animations

### Backend Performance
- FastAPI async endpoints prevent blocking during LLM calls
- Graph construction happens once during Pre-Flight, then cached
- Timeline scrubbing uses cheap filtering (no re-computation)

### Frontend Performance
- React Flow's built-in viewport optimization handles large graphs
- Memoization (React.memo, useMemo) prevents unnecessary re-renders
- Debounce timeline slider updates to avoid API spam

## Key Design Documents

Refer to these files in `dev_docs/` for comprehensive context:

1. **`requirement_use_cases.md`**: User personas (system architect, researcher, auditor), functional requirements, and core use cases
2. **`UI_design.md`**: Detailed UI specifications:
   - 3-column resizable layout (Log | Graph | Insights)
   - Pre-Flight modal for abstraction configuration
   - Swimlane timeline with precision navigation
   - Thought Stream for user annotations
   - Report generation workflow
3. **`build_process.md`**: Full-stack architecture, CI/CD pipeline, deployment strategy

**Architecture Status**: This project implements the React + FastAPI architecture described in build_process.md. The sophisticated UI requirements (resizable panels, smooth animations, synchronized components) necessitated React.

## Common Development Tasks

### Adding a New Backend Parser

1. **Create the parser**:
```python
# backend/app/parsers/langgraph_parser.py
from .base_parser import BaseParser
from app.models.types import Message
from typing import List
from pathlib import Path

class LangGraphParser(BaseParser):
    def parse(self, file_path: Path) -> List[Message]:
        # Parse LangGraph log format
        # Return List[Message]
        pass
```

2. **Register in parser service**:
```python
# backend/app/services/parser.py
from app.parsers.langgraph_parser import LangGraphParser

PARSER_REGISTRY = {
    "autogen": AutoGenParser,
    "crewai": CrewAIParser,
    "langgraph": LangGraphParser,  # Add here
}
```

3. **Add tests**:
```python
# backend/tests/test_parsers.py
def test_langgraph_parser():
    parser = LangGraphParser()
    messages = parser.parse("tests/fixtures/langgraph_log.jsonl")
    assert len(messages) > 0
    assert all(isinstance(m, Message) for m in messages)
```

4. **Update frontend types** (optional):
```typescript
// frontend/src/types/api.ts
export type FrameworkType = 'autogen' | 'crewai' | 'langgraph';
```

### Adding a New API Endpoint

**Backend**:
```python
# backend/app/api/endpoints/metrics.py
from fastapi import APIRouter, HTTPException
from app.schemas.metrics import MetricsResponse
from app.services.analyzer import compute_metrics

router = APIRouter()

@router.get("/metrics/{graph_id}", response_model=MetricsResponse)
async def get_metrics(graph_id: str):
    metrics = await compute_metrics(graph_id)
    if not metrics:
        raise HTTPException(status_code=404, detail="Graph not found")
    return metrics
```

**Register in main.py**:
```python
# backend/app/main.py
from app.api.endpoints import metrics

app.include_router(metrics.router, prefix="/api", tags=["metrics"])
```

**Frontend API Client**:
```typescript
// frontend/src/api/client.ts
export const getMetrics = async (graphId: string): Promise<MetricsResponse> => {
  const response = await axios.get(`/api/metrics/${graphId}`);
  return response.data;
};
```

**React Hook**:
```typescript
// frontend/src/hooks/useMetrics.ts
import { useQuery } from '@tanstack/react-query';
import { getMetrics } from '@/api/client';

export const useMetrics = (graphId: string) => {
  return useQuery({
    queryKey: ['metrics', graphId],
    queryFn: () => getMetrics(graphId),
  });
};
```

### Implementing Time-Sliced Graph Filtering

**Backend Service**:
```python
# backend/app/services/graph_builder.py
def filter_graph_by_step(G: nx.DiGraph, max_step: int) -> nx.DiGraph:
    """Return subgraph containing only interactions up to max_step."""
    filtered = G.copy()

    for u, v, data in G.edges(data=True):
        interactions = [
            i for i in data['interactions']
            if i.step_index <= max_step
        ]
        if interactions:
            filtered[u][v]['interactions'] = interactions
            filtered[u][v]['weight'] = len(interactions)
        else:
            filtered.remove_edge(u, v)

    return filtered
```

**API Endpoint**:
```python
@router.get("/graph/{graph_id}")
async def get_graph(graph_id: str, step: Optional[int] = None):
    G = load_graph_from_cache(graph_id)
    if step is not None:
        G = filter_graph_by_step(G, step)
    return serialize_graph(G)
```

### Frontend: Syncing Timeline with Graph

```typescript
// frontend/src/features/Graph/GraphView.tsx
const [currentStep, setCurrentStep] = useState(0);

const { data: graphData } = useQuery({
  queryKey: ['graph', graphId, currentStep],
  queryFn: () => getGraph(graphId, currentStep),
});

// Timeline slider in TimelinePanel.tsx
<Slider
  value={currentStep}
  onChange={(value) => setCurrentStep(value)}
  max={maxSteps}
/>
```

## Project Status

**Current State**: Phase 3 Complete - Advanced visualization with Rich Nodes, Ghost Trails, and Interactive Features!

**Last Updated**: 2025-12-09

**Servers Running**:
- Backend: http://localhost:8001 (FastAPI with auto-reload) ✅ Active
- Frontend: http://localhost:5173 (Vite dev server, configurable via PORT env var) ✅ Active

**Implementation Priority**:

**Phase 1: Backend Foundation** ✅ **COMPLETE**
1. ✅ Pydantic models (`backend/app/models/types.py`) - Temporal edge model with Interaction objects
2. ✅ AutoGen parser implementation - JSONL/JSON parsing with robust error handling
3. ✅ Graph builder service with NetworkX - Time-based filtering, metrics calculation
4. ✅ FastAPI endpoints (upload, graph retrieval, session management)
5. ✅ Session management service - In-memory session storage
6. ✅ Full message content storage in interaction metadata (not just 100-char preview)
7. ✅ Comprehensive test suite - 19 tests passing, including parsers and graph logic
8. ✅ API documentation - Auto-generated OpenAPI docs at `/docs`

**Phase 2: Frontend MVP** ✅ **COMPLETE**
1. ✅ Vite + React + TypeScript setup with Tailwind CSS
2. ✅ API client with Axios and TanStack Query
3. ✅ React Flow graph visualization with dagre auto-layout
4. ✅ Timeline controls with play/pause/scrubbing (1 step/second animation)
5. ✅ PreFlightModal file upload UI
6. ✅ TypeScript types mirroring backend Pydantic models
7. ✅ AppContext for global state management (with highlighting support)
8. ✅ Custom hooks (useGraphData, useUpload, useTimelinePlayback)
9. ✅ 3-column layout (Chat Log | Graph + Timeline | Insights placeholder)
10. ✅ Full backend integration via API

**Phase 3: Advanced Visualization** ✅ **COMPLETE** (Based on `dev_docs/graph_visual_design.md`)
1. ✅ **Rich Card Nodes** (`AgentNode.tsx`) - Rectangular cards with role-based icons, names, status pills (idle/generating/waiting/tool_use), agent color coding, tool drawer for active tools
2. ✅ **Ghost Trail Edges** (`GhostEdge.tsx`) - Smart edge routing with temporal states:
   - Current (t): 100% opacity, 5px, Orange (#f97316), dashed flow animation
   - Recent (t-1): 100% opacity, 4px, Source Color (agent-specific)
   - History (t-n): 40% opacity, 2px, Slate (#94a3b8)
3. ✅ **Gantt-Style Timeline** (`TimelineControls.tsx`) - Agent tracks with colored activity blocks, click-to-navigate to step, hover highlights agent, collapsible panel
4. ✅ **Chat Log with Cross-Highlighting** (`ChatLog.tsx`) - Displays full messages with sender→receiver, hover highlights agents and step, auto-scroll to current step
5. ✅ **Interactive Message Cards** - Expandable for long messages (>80 chars, line-clamp-2 with max-h-64 scroll), double-click to jump and highlight sender, single-click to navigate
6. ✅ **Bidirectional Edge Handling** - Smart handle routing with multiple connection points (left/right/top/bottom handles) to prevent overlap, offset edges for A→B and B→A
7. ✅ **Agent Color Palette** - Consistent 8-color palette across nodes, edges, timeline, and chat log
8. ✅ **Edge Focus Mode** (`GraphView.tsx`) - Double-click node to highlight its outgoing edges, single-click to clear focus
9. ✅ **Configurable Ports** - Frontend port via PORT env var (defaults to 5173), CORS supports multiple frontend ports (5173, 3000)

**What's Working End-to-End**:
- ✅ Upload JSONL/JSON log files through UI
- ✅ Backend parses and builds temporal graph with full message content
- ✅ Rich Card nodes with role-based icons, status indicators, and agent color-coded borders
- ✅ Ghost Trail edges with temporal states (Current: Orange 5px dashed, Recent: Agent Color 4px, History: Slate 2px 40% opacity)
- ✅ Smart edge routing with bidirectional support and multiple connection handles
- ✅ Gantt timeline with agent tracks - hover highlights agent, click block navigates to step, collapsible panel
- ✅ Chat log with full messages - hover highlights sender and step, single-click navigates, double-click jumps and highlights sender
- ✅ Expandable message cards (>80 chars show "Show more" button with line-clamp, max-h-64 with scroll)
- ✅ Edge focus mode - double-click node to highlight outgoing edges, single-click to clear
- ✅ Cross-highlighting between all components (Chat Log ↔ Graph ↔ Timeline)
- ✅ Play/pause animation through conversation steps (1 step/second)
- ✅ Loading states and error handling
- ✅ Type-safe communication between frontend and backend

**What's Tested**:
- Backend: 19 passing tests (parsers, graph builder, API endpoints)
- Frontend: Manual testing complete (upload → graph → timeline → interactions)

**Phase 4: Polish & Advanced Features** 📋 **NEXT**
1. Resizable panels (react-resizable-panels)
2. InsightEngine panel - Display metrics from `/api/graph/{id}/metrics`
3. Keyboard shortcuts (Space = play/pause, arrows = step navigation)
4. LLM abstraction service integration
5. Anomaly detection UI (loops, stagnation markers)
6. WebSocket for real-time updates
7. Report generation modal
8. Export graph as PNG/SVG
9. Dark mode support

**Phase 5: Deployment** 📋 **PLANNED**
1. Docker Compose setup
2. CI/CD pipeline (GitHub Actions)
3. Production build and deployment
4. Performance optimization (code splitting)

## Important Notes for Future Development

### Backend (Python)

1. **Temporal Data is Critical**: Always ensure `Interaction` objects include `timestamp` and `step_index` when building edges
2. **Parser Robustness**: LLM logs are messy - use Pydantic validation, handle missing fields gracefully, provide clear error messages
3. **API Response Schemas**: Every endpoint must have a Pydantic response model for auto-generated OpenAPI docs
4. **Async Best Practices**: Use `async def` for I/O-bound operations (file reads, LLM calls); regular `def` for CPU-bound (graph algorithms)
5. **Testing Strategy**:
   - Mock parsers with sample JSONL files in `backend/tests/fixtures/`
   - Use pytest fixtures for common test data (sample graphs, messages)
   - Test both valid and malformed input

### Frontend (TypeScript)

1. **Type Safety**: Mirror backend Pydantic models as TypeScript interfaces in `frontend/src/types/`
2. **API Error Handling**: Always handle loading/error states in components using TanStack Query
3. **Graph Performance**:
   - Use React Flow's `nodesDraggable={false}` if performance is sluggish
   - Implement virtualization for large graphs (React Flow handles this automatically)
   - Avoid hairball effect: implement edge filtering UI (threshold by interaction count)
4. **State Management**:
   - Use TanStack Query for server state (graphs, metrics)
   - Use React Context for UI state (selected step, panel sizes)
   - Avoid prop drilling - colocate state with components that need it
5. **Accessibility**: Ensure timeline controls are keyboard-navigable (important for presentations/demos)

### Cross-Cutting Concerns

1. **API Contract**: Keep `backend/app/schemas/` and `frontend/src/types/` in sync. Consider using OpenAPI code generation tools.
2. **CORS Configuration**: Backend allows multiple frontend ports via `.env`:
   ```
   CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:3000
   ```
   Backend runs on port 8001 (8000 reserved for vllm).
3. **Environment Variables**:
   - Backend: Use `.env` for API keys (OpenAI, Anthropic), CORS origins, loaded via Pydantic Settings
   - Frontend: Use `.env` for:
     - `VITE_API_BASE_URL=http://localhost:8001` (backend API URL)
     - `PORT=5173` (dev server port, optional, defaults to 5173)
4. **Documentation**: Update OpenAPI descriptions in FastAPI route decorators - they auto-generate the /docs page
5. **Visualization Design**: Follow `dev_docs/graph_visual_design.md` for UI/UX guidelines
6. **User Interactions**: See `dev_docs/USER_INTERACTIONS.md` for complete interaction reference
