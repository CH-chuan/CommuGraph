# CommuGraph

A process mining and analytics tool for multi-agent chat logs. CommuGraph transforms complex multi-agent conversations into interactive graph visualizations with temporal analysis capabilities.

## Features

- **Upload & Parse**: Import JSONL/JSON chat log files from various multi-agent frameworks
- **Temporal Graph Visualization**: Interactive node-link diagrams with time-aware edges
- **Rich Card Nodes**: Role-based icons, status indicators, and agent color coding
- **Ghost Trail Edges**: Temporal edge states (Current/Recent/History) with smart routing
- **Gantt Timeline**: Agent activity tracks with play/pause animation
- **Chat Log View**: Message list with cross-highlighting to graph elements
- **Edge Focus Mode**: Isolate and inspect specific agent interactions

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Graph Visualization | React Flow (@xyflow/react) |
| State Management | TanStack Query + React Context |
| Validation | Zod |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui (Radix-based) |
| Graph Algorithms | Custom DiGraph implementation |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
npm run build
npm start
```

### Code Quality

```bash
npm run lint       # ESLint
npm run build      # TypeScript type checking
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload JSONL/JSON file |
| `/api/frameworks` | GET | List supported parsers |
| `/api/sessions` | GET | List all sessions |
| `/api/graph/[id]` | GET | Get graph snapshot (optional `?step=N`) |
| `/api/graph/[id]/metrics` | GET | Get graph metrics |
| `/api/graph/[id]/info` | GET | Get session info |
| `/api/session/[id]` | DELETE | Delete session |

## Architecture

CommuGraph is a unified **Next.js 15 monolith** with all frontend and backend logic in TypeScript. The core innovation is **time-aware edges** - unlike traditional static graphs, edges store interaction objects with timestamps and step indices, enabling temporal playback and pattern detection.

```
src/
├── app/           # Next.js App Router + API Routes
├── components/    # React components (graph, chat, upload, ui)
├── lib/           # Backend logic (parsers, services, graph algorithms)
├── hooks/         # React hooks (data fetching, timeline playback)
├── context/       # Global UI state
├── types/         # TypeScript type definitions
└── utils/         # Helpers and adapters
```

## Supported Frameworks

- AutoGen (JSONL/JSON)
- Claude Code (conversation logs)
- More parsers can be added via the parser registry

## License

MIT
