# CommuGraph

CommuGraph is a analytics tool for **multi-agent chat logs**. It turns conversation traces (e.g. AutoGen, Claude Code) into an interactive, time-aware graph so you can review **agent-to-agent interactions**, **tool execution traces**, and **session-level metrics**.

At the current stage, CommuGraph focuses on **log ingestion + visualization + navigation** (not full process mining yet).

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

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Supported inputs

- **File types**: `.json` and `.jsonl`
- **Frameworks**:
  - AutoGen (single file)
  - Claude Code (main session + optional sub-agent logs)

### AutoGen schema (currently supported)

For AutoGen, CommuGraph currently supports a **JSON Lines** format where **each line is one message object**, shaped like the sample at `public/samples/autogen/mock_chat_history.jsonl`:

- **Required fields**:
  - `sender` (string): who sent the message (e.g. `"User"`, `"Manager"`, `"Coder"`)
  - `recipient` (string): who the message is directed to
  - `message` (string): message content (can include code blocks)
  - `timestamp` (number): UNIX timestamp (seconds)

If your AutoGen export differs from this structure, it may not parse correctly yet.

### Claude Code version note

Our Claude Code parsing is tested against **chat logs `2.0.64`**. If you hit parsing/visualization issues with other versions or log variants, please **open an issue** and include a minimal repro log (or a redacted snippet).

## Current capabilities (high level)

- Upload and parse supported log formats
- Explore a time-aware interaction graph
- Review chat messages alongside the graph
- Timeline-based navigation and playback
- Claude Code workflow-style visualization + basic session metrics

## What’s next (roadmap)

- **Process mining functions are pending**.

## Tech Stack (for contributors)

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

## Architecture (high level)

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

## Code Quality (for contributors)

```bash
npm run lint       # ESLint
npm run build      # TypeScript type checking
```

## License

MIT
