# CommuGraph Frontend

React + TypeScript frontend for CommuGraph - Process mining visualization for multi-agent chat logs.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Frontend: http://localhost:5173
```

**Backend Required**: Ensure backend is running on http://localhost:8001

```bash
# In separate terminal
cd ../backend
poetry run uvicorn app.main:app --reload --port 8001
```

## Features

- **File Upload**: Upload AutoGen JSONL/JSON conversation logs
- **Graph Visualization**: Interactive React Flow graph with automatic layout
- **Timeline Controls**: Scrub through conversation steps with play/pause animation
- **Real-time Filtering**: Graph updates based on timeline position (via backend API)

## Architecture

### Tech Stack

- **React 18+** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **React Flow** for graph visualization
- **TanStack Query** for API state management
- **Axios** for HTTP requests
- **dagre** for graph layout algorithm

### Project Structure

```
src/
├── components/
│   ├── graph/           # GraphView (React Flow), TimelineControls
│   ├── layout/          # Header, MainLayout
│   ├── upload/          # PreFlightModal (file upload)
│   └── ui/              # shadcn/ui components (Button, Dialog, Input, etc.)
├── hooks/
│   ├── useGraphData.ts         # TanStack Query hook for graph API
│   ├── useUpload.ts            # File upload mutation
│   └── useTimelinePlayback.ts  # Timeline animation logic
├── api/
│   ├── client.ts               # Axios instance with interceptors
│   ├── endpoints.ts            # API functions (uploadLogFile, getGraph, etc.)
│   └── queryClient.ts          # TanStack Query configuration
├── context/
│   └── AppContext.tsx          # Global state (graphId, currentStep, totalSteps)
├── types/
│   ├── graph.ts                # Graph types (NodeData, EdgeData, Interaction)
│   └── api.ts                  # API request/response types
├── utils/
│   └── graphAdapters.ts        # Backend data → React Flow conversion
├── lib/
│   └── utils.ts                # Utility functions (cn for Tailwind)
├── App.tsx                     # Root component
└── main.tsx                    # Entry point
```

## Development

### Environment Variables

Create `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8001
```

### API Integration

The frontend communicates with the FastAPI backend:

- `POST /api/upload` - Upload log file, get graph_id
- `GET /api/graph/{graph_id}?step=N` - Get graph filtered to step N
- `GET /api/graph/{graph_id}/metrics` - Get graph metrics

TanStack Query handles caching and refetching automatically.

### State Management

- **Global UI State**: React Context (`AppContext`) for graphId, currentStep, totalSteps
- **Server State**: TanStack Query for API data (graphs, metrics)
- **Local State**: useState for component-specific state (file selection, play/pause)

### Type Safety

TypeScript interfaces in `src/types/` mirror backend Pydantic models exactly:

- `NodeData` ↔ `backend/app/models/types.py::NodeData`
- `EdgeData` ↔ `backend/app/models/types.py::EdgeData`
- `GraphSnapshot` ↔ `backend/app/models/types.py::GraphSnapshot`

Keep these in sync when backend models change.

## Scripts

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build
npm run lint         # Run ESLint (when configured)
npm run tsc          # TypeScript type checking
```

## Testing

### Manual Testing Checklist

1. **Upload Flow**:
   - Open http://localhost:5173
   - PreFlightModal should appear
   - Select a JSONL/JSON file
   - Choose "AutoGen" framework
   - Click "Process & Launch"
   - Graph should render

2. **Graph Visualization**:
   - Nodes positioned automatically (dagre layout)
   - Edges show interaction counts
   - Zoom/pan with mouse

3. **Timeline Controls**:
   - Drag slider to change step
   - Click play ▶️ to animate (1 step/second)
   - Click pause ⏸ to stop
   - Click ⏮ to reset to step 0
   - Click ⏭ to jump to end

### Sample Data

Use backend test fixtures:

```bash
# From project root
curl -X POST http://localhost:8001/api/upload \
  -F "file=@backend/tests/fixtures/autogen_sample.jsonl" \
  -F "framework=autogen"
```

## Common Issues

### CORS Errors

Ensure backend CORS middleware allows `http://localhost:5173`:

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### React Flow Canvas Blank

Parent div needs explicit height. GraphView already has `h-full` applied.

### Timeline Scrubbing Lag

TanStack Query caches each step. If you experience lag, consider using `useDeferredValue` to debounce API calls.

## Next Steps (Phase 3)

- Add resizable panels (`react-resizable-panels`)
- Implement NarrativeLog panel (message list)
- Add InsightEngine panel (metrics display)
- Custom React Flow node styles
- Keyboard shortcuts (Space = play/pause, arrows = step)

## Contributing

See main project `CLAUDE.md` for architecture details and development guidelines.

## License

See root LICENSE file.
