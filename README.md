# CommuGraph

CommuGraph is an analytics tool for **multi-agent chat logs**. It turns conversation traces (e.g. AutoGen, Claude Code) into interactive visualizations so you can review **agent-to-agent interactions**, **tool execution traces**, and **session-level metrics**.

At the current stage, CommuGraph focuses on **log ingestion + visualization + navigation** (not full process mining yet).

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/CH-chuan/CommuGraph.git
cd CommuGraph
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

## Supported Inputs

- **File types**: `.json` and `.jsonl`
- **Frameworks**:
  - AutoGen (single file)
  - Claude Code (main session + optional sub-agent logs)

### AutoGen Schema

For AutoGen, CommuGraph supports a **JSON Lines** format where **each line is one message object**, shaped like the sample at `public/samples/autogen/mock_chat_history.jsonl`:

- **Required fields**:
  - `sender` (string): who sent the message (e.g. `"User"`, `"Manager"`, `"Coder"`)
  - `recipient` (string): who the message is directed to
  - `message` (string): message content (can include code blocks)
  - `timestamp` (number): UNIX timestamp (seconds)

If your AutoGen export differs from this structure, it may not parse correctly yet.

### Claude Code Logs

Our Claude Code parsing is tested against **chat logs from version `2.0.64`**. Key features:

- **Topological ordering** via UUID parent-child chain (not timestamp sorting)
- **Phantom branch pruning** - Handles Claude Code's logging bug where user messages with images are logged multiple times
- **Sub-agent support** - Upload sub-agent logs alongside the main session
- **Context compaction** - Tracks conversation continuity across context boundaries

**Deduplication**: Claude Code sometimes logs the same user message multiple times (especially with images), creating duplicate branches. CommuGraph uses timestamp-based deduplication to remove these phantom branches automatically.

If you hit parsing/visualization issues with other versions, please **open an issue** with a minimal repro log.

## View Modes

CommuGraph offers multiple ways to explore your chat logs:

| View | Description |
|------|-------------|
| **Workflow View** | Swim-lane diagram showing agent interactions over time |
| **Annotation View** | Linear conversation with collapsible assistant turns |
| **Chat Log** | Traditional message list with syntax highlighting |
| **Graph View** | Interactive node-link diagram (AutoGen) |

## Current Capabilities

- Upload and parse supported log formats
- Multiple visualization modes (workflow, annotation, chat log, graph)
- Timeline-based navigation and playback
- Sub-agent exploration via modal views
- Image display for user messages with screenshots
- Session metrics dashboard
- Cross-view highlighting and navigation

## What's Next (Roadmap)

- Process mining functions (pending)

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
| `/api/graph/[id]/annotations` | GET | Get annotation records for annotation view |
| `/api/graph/[id]/workflow` | GET | Get workflow data for workflow view |
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
