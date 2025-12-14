# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CommuGraph** is a process mining and analytics tool for multi-agent chat logs. It transforms complex multi-agent conversations into interactive graph visualizations with temporal analysis capabilities.

**Architecture**: Unified **Next.js 15** monolith with all frontend and backend logic in TypeScript. No Python, no FastAPI - everything runs in a single Next.js application with API routes.

**Core Philosophy**: Leverage TypeScript throughout the stack for type safety and developer experience. Use Next.js App Router for both UI rendering and API endpoints.

## Development Commands

### Initial Setup

```bash
npm install
```

### Running Locally

```bash
npm run dev
# Server runs at http://localhost:3000
# API endpoints at http://localhost:3000/api/*
```

### Building for Production

```bash
npm run build
npm start
```

### Code Quality

```bash
npm run lint       # ESLint
npm run build      # TypeScript type checking via Next.js
```

## Architecture

### Directory Structure
```
CommuGraph/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── page.tsx                  # Main page (client component)
│   │   ├── globals.css               # Global styles + Tailwind
│   │   └── api/                      # API Routes (replaces FastAPI)
│   │       ├── upload/route.ts       # POST /api/upload
│   │       ├── frameworks/route.ts   # GET /api/frameworks
│   │       ├── sessions/route.ts     # GET /api/sessions
│   │       ├── graph/[id]/
│   │       │   ├── route.ts          # GET /api/graph/:id
│   │       │   ├── metrics/route.ts  # GET /api/graph/:id/metrics
│   │       │   └── info/route.ts     # GET /api/graph/:id/info
│   │       └── session/[id]/route.ts # DELETE /api/session/:id
│   │
│   ├── components/                   # React components
│   │   ├── graph/
│   │   │   ├── GraphView.tsx         # React Flow graph (uses 'use client')
│   │   │   ├── GraphViewWrapper.tsx  # Dynamic import for SSR safety
│   │   │   ├── GraphCanvas.tsx       # Graph container
│   │   │   ├── AgentNode.tsx         # Rich Card node component
│   │   │   ├── GhostEdge.tsx         # Temporal edge component
│   │   │   └── TimelineControls.tsx  # Gantt-style timeline
│   │   ├── chat/ChatLog.tsx          # Message list with highlighting
│   │   ├── upload/PreFlightModal.tsx # File upload dialog
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── providers/Providers.tsx   # QueryClient + AppProvider
│   │   └── ui/                       # shadcn/ui components
│   │
│   ├── lib/                          # Backend logic (TypeScript)
│   │   ├── models/types.ts           # Zod schemas + TypeScript types
│   │   ├── graph/digraph.ts          # Custom DiGraph (replaces NetworkX)
│   │   ├── parsers/
│   │   │   ├── base-parser.ts        # Abstract parser interface
│   │   │   └── autogen-parser.ts     # AutoGen JSONL/JSON parser
│   │   └── services/
│   │       ├── parser-service.ts     # Parser registry
│   │       ├── graph-builder.ts      # Graph construction + filtering
│   │       └── session-manager.ts    # In-memory session storage
│   │
│   ├── hooks/                        # React hooks
│   │   ├── use-graph-data.ts         # TanStack Query for graph fetching
│   │   ├── use-upload.ts             # TanStack Query mutation
│   │   └── use-timeline-playback.ts  # Play/pause animation
│   │
│   ├── context/app-context.tsx       # Global UI state
│   ├── types/                        # TypeScript types
│   │   ├── graph.ts                  # Graph data structures
│   │   ├── api.ts                    # API response types
│   │   └── index.ts                  # Re-exports
│   └── utils/
│       ├── graph-adapters.ts         # React Flow conversion
│       └── api-client.ts             # Fetch-based API client
│
├── public/
│   └── mock_chat_history.jsonl       # Sample data for testing
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── components.json                   # shadcn/ui config
```

### Critical Architectural Concepts

#### Unified Full-Stack Architecture

All backend logic runs in Next.js API routes:
- **API Routes** (`src/app/api/`): Handle HTTP requests, parse files, build graphs
- **Services** (`src/lib/services/`): Business logic for graph construction, session management
- **Custom DiGraph** (`src/lib/graph/digraph.ts`): TypeScript implementation replacing Python NetworkX
- **Zod Validation** (`src/lib/models/types.ts`): Runtime validation replacing Pydantic

#### Temporal Edge Model

The core innovation is **time-aware edges**. Unlike traditional static graphs, edges store a list of `Interaction` objects with timestamps, step indices, and intent labels. This enables:
- Time-slider visualization (show graph state at step N)
- Intent-based filtering (show only "delegation" edges)
- Temporal pattern detection (loops, stagnation)

**Implementation**: `src/lib/models/types.ts` defines Zod schemas for `EdgeData` and `Interaction`.

#### Session Management

Sessions are stored in a module-level `Map<string, Session>`:
- Persists across requests within the same server instance
- Clears on server restart (acceptable for dev/demo use)
- No database required for current scale

```typescript
// src/lib/services/session-manager.ts
const sessions = new Map<string, SessionData>();
```

#### React Flow SSR Handling

React Flow requires browser APIs that aren't available during SSR. Use dynamic imports:

```typescript
// src/components/graph/GraphViewWrapper.tsx
const GraphCanvas = dynamic(
  () => import('./GraphCanvas').then((mod) => ({ default: mod.GraphCanvas })),
  { ssr: false }
);
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 15/16 | Unified full-stack, App Router, API routes |
| Language | TypeScript | Type safety throughout |
| Graph Visualization | React Flow (@xyflow/react) | Interactive node-link diagrams |
| State Management | TanStack Query + React Context | API caching and UI state |
| Validation | Zod | Runtime type checking |
| Graph Algorithms | Custom DiGraph | TypeScript implementation |
| Styling | Tailwind CSS | Utility-first CSS |
| UI Components | shadcn/ui | Radix-based components |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload JSONL/JSON file, returns graph_id |
| `/api/frameworks` | GET | List supported parsers |
| `/api/sessions` | GET | List all sessions |
| `/api/graph/[id]` | GET | Get graph snapshot (optional ?step=N) |
| `/api/graph/[id]/metrics` | GET | Get graph metrics (density, centrality) |
| `/api/graph/[id]/info` | GET | Get session info |
| `/api/session/[id]` | DELETE | Delete session |

## Common Development Tasks

### Adding a New Parser

1. **Create the parser** in `src/lib/parsers/`:
```typescript
// src/lib/parsers/langgraph-parser.ts
import { BaseParser, type Message } from './base-parser';

export class LangGraphParser extends BaseParser {
  parse(content: string): Message[] {
    // Parse LangGraph log format
    return messages;
  }
}
```

2. **Register in parser service**:
```typescript
// src/lib/services/parser-service.ts
import { LangGraphParser } from '../parsers/langgraph-parser';

export const parserRegistry: Record<string, BaseParser> = {
  autogen: new AutoGenParser(),
  langgraph: new LangGraphParser(),  // Add here
};
```

3. **Update frameworks endpoint** (automatic - reads from registry)

### Adding a New API Endpoint

```typescript
// src/app/api/my-endpoint/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: 'hello' });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ received: body });
}
```

### Implementing Time-Sliced Graph Filtering

The `GraphBuilder.toGraphSnapshot(maxStep)` method handles filtering:

```typescript
// Already implemented in src/lib/services/graph-builder.ts
const snapshot = graphBuilder.toGraphSnapshot(step);
// Returns only interactions with step_index <= step
```

## Project Status

**Current State**: Next.js 15 Migration Complete!

**Last Updated**: 2025-12-14

**Server Running**: http://localhost:3000 (Next.js dev server)

**What's Working**:
- Upload JSONL/JSON log files through UI
- Parse and build temporal graph with full message content
- Rich Card nodes with role-based icons, status indicators, agent colors
- Ghost Trail edges with temporal states (Current/Recent/History)
- Smart edge routing with bidirectional support
- Gantt timeline with agent tracks
- Chat log with cross-highlighting
- Edge focus mode
- Play/pause animation (1 step/second)
- All API endpoints tested and working

### Claude Code Parsing: Phantom Branch Handling

Claude Code has a logging bug where user messages (especially with images) create phantom branches - multiple records at the same timestamp with the same parent but different UUIDs. The parser handles this with:

1. **User record pruning** (`prunePhantomBranches`): Groups user records by timestamp, keeps the "richest" record (most content blocks), prunes others and their descendants via BFS.

2. **Assistant record deduplication** (`mergeAssistantRecords`): When merging chunked assistant records by `requestId`, deduplicates by `messageId` (Claude API message ID) to prevent duplicate thinking/text/tool_use content from phantom branches.

Key implementation in `src/lib/parsers/claude-code-parser.ts`:
- `processedMessageIds` Set tracks which messageIds have been processed
- `seenToolUseIds` Set provides additional safety for tool_use deduplication

## Important Notes for Development

### TypeScript Backend

1. **Zod for Validation**: Use Zod schemas for runtime validation
2. **Custom DiGraph**: The `DiGraph` class in `src/lib/graph/digraph.ts` implements graph operations
3. **Session Storage**: Module-level Map - no database needed for current scale
4. **Error Handling**: API routes return proper HTTP status codes

### React Components

1. **'use client'**: All interactive components need the `'use client'` directive
2. **SSR Safety**: Use dynamic imports for React Flow components
3. **Type Safety**: Use types from `src/types/` to match API responses
4. **TanStack Query**: Use for data fetching with caching

### File Naming

- Use kebab-case for file names: `graph-builder.ts`, `use-graph-data.ts`
- Match import paths exactly (case-sensitive on Linux)

### Testing Locally

```bash
# Start dev server
npm run dev

# Test API endpoints
curl http://localhost:3000/api/frameworks
curl http://localhost:3000/api/sessions
curl -X POST -F "file=@public/mock_chat_history.jsonl" -F "framework=autogen" http://localhost:3000/api/upload
```
