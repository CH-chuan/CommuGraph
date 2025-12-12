# CommuGraph Architecture Overview

## Introduction

This document explains the CommuGraph codebase architecture for developers familiar with traditional split frontend/backend applications. CommuGraph is built with **Next.js 16**, a full-stack framework that unifies both frontend and backend in a single Node.js application.

**CommuGraph** is a process mining and visualization tool for multi-agent systems. It parses logs from multi-agent frameworks (like AutoGen and Claude Code) and provides interactive visualizations to understand agent communication patterns and workflows.

## What is Next.js?

Next.js is a React-based framework that runs on Node.js. Think of it as combining:
- **React** (for frontend UI)
- **Express.js** (for backend API routes)
- **Built-in routing** (file-based)
- **TypeScript** support throughout

### Key Difference from Traditional Split Architecture

| Traditional Architecture | Next.js (This Codebase) |
|-------------------------|-------------------------|
| Separate frontend repo (React) | Combined in `src/` directory |
| Separate backend repo (Node/Express) | API routes in `src/app/api/` |
| Two servers (e.g., :3000 and :8000) | Single server on :3000 |
| CORS configuration needed | No CORS - same origin |
| Separate deployments | Single deployment |
| Manual API client setup | Built-in fetch with type safety |

## Directory Structure & Responsibilities

```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── api/               # 🔧 BACKEND: API endpoints
│   ├── page.tsx           # 🎨 FRONTEND: Main page component
│   ├── layout.tsx         # 🎨 FRONTEND: Root layout
│   ├── globals.css        # 🎨 FRONTEND: Global styles
│   └── favicon.ico        # 🎨 FRONTEND: App icon
│
├── components/            # 🎨 FRONTEND: React components
│   ├── graph/            # Graph visualization
│   ├── workflow/         # Workflow timeline views
│   ├── chat/             # Chat log display
│   ├── layout/           # Header, layouts
│   ├── providers/        # React providers (React Query, etc.)
│   ├── ui/              # Reusable UI components (shadcn/ui)
│   └── upload/          # File upload modal
│
├── hooks/                # 🎨 FRONTEND: React hooks
│   ├── use-graph-data.ts      # Fetch graph data
│   ├── use-workflow-data.ts   # Fetch workflow data
│   ├── use-timeline-playback.ts
│   └── use-upload.ts
│
├── context/              # 🎨 FRONTEND: React Context (global state)
│   └── app-context.tsx
│
├── lib/                  # 🔧 BACKEND: Business logic layer
│   ├── parsers/         # Parse log files (AutoGen, Claude Code)
│   ├── services/        # Core business logic
│   ├── graph/           # Graph data structures
│   ├── models/          # Data models & types
│   └── utils.ts         # Shared backend utilities
│
├── types/               # 🔀 SHARED: TypeScript types
│   ├── api.ts           # API request/response types
│   ├── graph.ts         # Graph data types
│   └── index.ts         # Main type exports
│
└── utils/               # 🔀 SHARED: Utility functions
    ├── api-client.ts    # 🌉 BRIDGE: Frontend → Backend
    ├── agent-naming.ts  # Agent name formatting utilities
    ├── graph-adapters.ts
    └── workflow-layout.ts

public/                   # 🎨 FRONTEND: Static assets
└── samples/             # Sample data files
```

## Static Assets

### Location: `public/`

Static files that are served directly without processing. Accessible via root URL path.

- **`public/samples/`**: Sample log files for demonstration and testing

Next.js automatically serves files in `public/` at the root path. For example, `public/samples/data.json` is accessible at `/samples/data.json`.

## Frontend Components (Client-Side)

### Location: `src/components/`, `src/app/page.tsx`, `src/hooks/`, `src/context/`

These files run in the **browser** and handle the user interface.

### Key Frontend Pieces:

#### 1. **Pages** (`src/app/page.tsx`)
- The main application page
- Uses `'use client'` directive (required for client-side React)
- Entry point for the UI

#### 2. **Components** (`src/components/`)
- **`components/graph/`**: Graph visualization (React Flow-based)
  - `GraphView.tsx`, `GraphViewWrapper.tsx` - Main graph view
  - `GraphCanvas.tsx` - Canvas component for graph rendering
  - `AgentNode.tsx` - Node component for agents
  - `GhostEdge.tsx` - Edge visualization for ghost/preview states
  - `TimelineControls.tsx` - Timeline playback controls
- **`components/workflow/`**: Workflow timeline visualization (swimlane view)
  - `WorkflowView.tsx`, `WorkflowViewWrapper.tsx` - Main workflow view
  - `WorkflowNode.tsx` - Workflow event nodes
  - `WorkflowEdge.tsx` - Workflow edges between nodes
  - `SessionStartNode.tsx` - Special node for session start
  - `LaneHeader.tsx` - Swimlane headers (agent names)
  - `TimeAxis.tsx` - Time axis display
  - `WorkflowTimelineControls.tsx` - Timeline controls for workflow
  - `MetricsDashboard.tsx` - Metrics panel with statistics
  - `SubAgentModal.tsx` - Modal for viewing sub-agent details
  - `index.ts` - Barrel export file
- **`components/chat/`**: Chat log display
  - `ChatLog.tsx` - Display conversation logs
- **`components/layout/`**: Layout components
  - `Header.tsx` - Application header
  - `MainLayout.tsx` - Main layout wrapper
- **`components/providers/`**: React providers
  - `Providers.tsx` - TanStack Query provider setup
- **`components/ui/`**: Reusable UI components (shadcn/ui)
  - `button.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `slider.tsx`
- **`components/upload/`**: File upload
  - `PreFlightModal.tsx` - File upload and framework selection modal

#### 3. **Hooks** (`src/hooks/`)
Custom React hooks that fetch data from the backend:
- `use-graph-data.ts`: Fetches graph data via API
- `use-workflow-data.ts`: Fetches workflow data via API
- `use-timeline-playback.ts`: Controls timeline playback
- `use-upload.ts`: Handles file upload flow

#### 4. **Context** (`src/context/app-context.tsx`)
React Context for managing global application state (current graph ID, view mode, etc.)

#### 5. **Utilities** (`src/utils/`)
Shared utilities used by both frontend and backend:

**API Client Bridge** (`api-client.ts`)
- The **bridge** between frontend and backend
- Contains functions like:
  - `uploadLogFiles(files, framework)` → calls `/api/upload`
  - `getGraph(graphId, step)` → calls `/api/graph/${id}`
  - `getWorkflow(graphId, step)` → calls `/api/graph/${id}/workflow`
  - `getMetrics(graphId)` → calls `/api/graph/${id}/metrics`
  - `getFrameworks()` → calls `/api/frameworks`
  - `deleteSession(sessionId)` → calls `/api/session/${id}`

**Other Utilities**:
- `agent-naming.ts`: Format and extract agent names (e.g., "Explore-773d7508")
- `graph-adapters.ts`: Data transformation utilities for graph structures
- `workflow-layout.ts`: Layout algorithms for workflow swimlane positioning

## Backend Components (Server-Side)

### Location: `src/app/api/`, `src/lib/`

These files run on the **Node.js server** and handle business logic, data processing, and API endpoints.

### Key Backend Pieces:

#### 1. **API Routes** (`src/app/api/`)
REST API endpoints (equivalent to Express.js routes):

```
src/app/api/
├── upload/route.ts           → POST /api/upload
│                                 Upload log files and create session
│
├── sessions/route.ts         → GET /api/sessions
│                                 List all active sessions
│
├── frameworks/route.ts       → GET /api/frameworks
│                                 Get available framework parsers
│
├── graph/
│   └── [id]/
│       ├── route.ts         → GET /api/graph/{id}?step={step}
│       │                        Get graph data for a session
│       │
│       ├── workflow/route.ts → GET /api/graph/{id}/workflow?step={step}
│       │                        Get workflow timeline data (swimlane view)
│       │
│       ├── metrics/route.ts  → GET /api/graph/{id}/metrics
│       │                        Get graph metrics and statistics
│       │
│       └── info/route.ts    → GET /api/graph/{id}/info
│                                Get session metadata
│
└── session/
    └── [id]/route.ts        → DELETE /api/session/{id}
                                 Delete a session
```

**File-based routing**: The file path determines the URL:
- `api/upload/route.ts` → `/api/upload`
- `api/graph/[id]/route.ts` → `/api/graph/:id` (dynamic route with parameter)

**HTTP Methods**: Each route file exports functions like:
- `export async function GET(request)` → Handle GET requests
- `export async function POST(request)` → Handle POST requests
- `export async function DELETE(request)` → Handle DELETE requests

**Dynamic Routes**: Folder names in `[brackets]` are dynamic parameters:
- `[id]` in the path becomes `params.id` in the handler

#### 2. **Business Logic Layer** (`src/lib/`)

##### **Parsers** (`src/lib/parsers/`)
Parse different multi-agent framework log formats into a unified Message structure:
- `base-parser.ts`: Abstract parser interface with error handling
- `autogen-parser.ts`: Parse AutoGen framework logs (single JSONL file)
- `claude-code-parser.ts`: Parse Claude Code logs (multi-file JSONL)
  - Main session file + multiple agent-*.jsonl files
  - Extracts sub-agent information and relationships
  - Builds workflow graph with timing information

##### **Services** (`src/lib/services/`)
Core business logic (equivalent to service layer in traditional backend):
- `parser-service.ts`: Entry point for parsing logs, delegates to framework-specific parsers
- `graph-builder.ts`: Build directed graph structures from parsed messages
- `workflow-graph-builder.ts`: Build workflow timeline graphs (swimlane view data)
- `session-manager.ts`: In-memory session storage (acts as "database"), manages active sessions

##### **Data Structures** (`src/lib/graph/`)
- `digraph.ts`: Directed graph implementation (nodes, edges, graph traversal algorithms)

##### **Models** (`src/lib/models/`)
- `types.ts`: Core data models (Message, Agent, Session, WorkflowGraph, WorkflowNode, etc.)

##### **Utilities** (`src/lib/`)
- `utils.ts`: Shared utility functions for backend processing

#### 3. **Session Storage** (In-Memory Database)
`src/lib/services/session-manager.ts` maintains sessions in memory:
- Stores parsed messages
- Stores built graphs
- Stores workflow graphs
- Acts as a simple in-memory database

**Note**: Data is lost when the server restarts (not persistent).

## Data Flow: Request → Response

### Example: User Uploads Log File

```
┌─────────────────┐
│  1. User Action │  User selects file in PreFlightModal
└────────┬────────┘
         │
┌────────▼────────┐
│  2. Frontend    │  uploadLogFiles(files, 'claudecode')
│     Hook        │  (src/hooks/use-upload.ts)
└────────┬────────┘
         │
┌────────▼────────┐
│  3. API Client  │  fetch('/api/upload', { method: 'POST', body: formData })
│     Bridge      │  (src/utils/api-client.ts)
└────────┬────────┘
         │ HTTP POST
         │
┌────────▼────────┐
│  4. API Route   │  POST handler in api/upload/route.ts
│    (Backend)    │  - Receives request
└────────┬────────┘  - Validates input
         │           - Extracts files
┌────────▼────────┐
│  5. Parser      │  ClaudeCodeParser.parseMultiFile()
│    Service      │  (src/lib/parsers/claude-code-parser.ts)
└────────┬────────┘
         │
┌────────▼────────┐
│  6. Graph       │  GraphBuilder.buildGraph(messages)
│    Builder      │  WorkflowGraphBuilder.build(parseResult)
└────────┬────────┘  (src/lib/services/)
         │
┌────────▼────────┐
│  7. Session     │  createSession(messages, framework, graph, workflow)
│    Manager      │  Stores in memory, generates session ID
└────────┬────────┘
         │
┌────────▼────────┐
│  8. Response    │  { graph_id, message_count, node_count, ... }
│     (JSON)      │
└────────┬────────┘
         │ HTTP Response
         │
┌────────▼────────┐
│  9. Frontend    │  Receives data, updates UI
│     Updates     │  Sets graphId in context
└─────────────────┘  Navigates to graph view
```

### Example: User Views Graph

```
Frontend Hook (use-graph-data.ts)
  ↓
API Client (api-client.ts): getGraph(graphId, step)
  ↓
HTTP GET /api/graph/{id}?step={step}
  ↓
API Route (api/graph/[id]/route.ts)
  ↓
Session Manager: getSession(id)
  ↓
Graph Builder: getGraph(), getNodesAtStep()
  ↓
Response: { nodes, edges, messages, framework }
  ↓
Frontend: Renders GraphView with data
```

## Communication Between Frontend & Backend

### The Bridge: `src/utils/api-client.ts`

This file is the **only place** where frontend makes HTTP calls to backend:

```typescript
// Frontend components/hooks call these functions
import { uploadLogFiles, getGraph, getWorkflow } from '@/utils/api-client';

// These functions make fetch() calls to API routes
export async function uploadLogFiles(files: File[], framework: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('framework', framework);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
}

export async function getGraph(graphId: string, step?: number) {
  const url = step !== undefined 
    ? `/api/graph/${graphId}?step=${step}`
    : `/api/graph/${graphId}`;
    
  const response = await fetch(url);
  return response.json();
}
```

### Type Safety Across the Stack

TypeScript types are **shared** between frontend and backend:

```typescript
// src/types/api.ts - Shared type definitions
export interface UploadResponse {
  graph_id: string;
  message_count: number;
  node_count: number;
  edge_count: number;
  total_steps: number;
  framework: string;
}

// Backend (api/upload/route.ts) returns this type
export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  // ...
  const response: UploadResponse = {
    graph_id: sessionId,
    message_count: messages.length,
    // ...
  };
  return NextResponse.json(response);
}

// Frontend (api-client.ts) receives this type
export async function uploadLogFiles(files: File[], framework: string): Promise<UploadResponse> {
  const response = await fetch('/api/upload', { /* ... */ });
  return response.json(); // TypeScript knows this is UploadResponse
}
```

## Running the Application

### Development

```bash
npm run dev
```

This single command starts:
- Frontend dev server (React with hot reload)
- Backend API routes (Node.js)
- Both accessible at `http://localhost:3000`

### Production

```bash
npm run build  # Builds both frontend and backend
npm start      # Starts production server
```

### Key Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Key Technologies

### Frontend Stack
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Flow** (@xyflow/react) - Graph visualization
- **TanStack Query** - Data fetching and caching
- **Radix UI** - Headless UI components

### Backend Stack
- **Next.js 16** - Full-stack framework
- **Node.js** - JavaScript runtime
- **TypeScript** - Type safety
- **Zod** - Runtime validation

### Shared Libraries
- **Dagre** - Graph layout algorithms
- **Lucide React** - Icons

## Important Conventions

### 1. File Naming
- API routes: `route.ts` (not `index.ts`)
- Components: PascalCase (e.g., `GraphView.tsx`)
- Utilities: kebab-case (e.g., `api-client.ts`)
- Hooks: kebab-case with `use-` prefix (e.g., `use-graph-data.ts`)

### 2. Client vs Server Components
- **Client components**: Use `'use client'` directive (most components)
- **Server components**: No directive needed (rare in this app)
- **API routes**: Always server-side (no directive needed)

### 3. Import Aliases
Use `@/` for imports from `src/`:
```typescript
import { GraphView } from '@/components/graph/GraphView';
import { getGraph } from '@/utils/api-client';
import type { Message } from '@/lib/models/types';
```

Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 4. Dynamic Routes
Use `[param]` for dynamic segments:
- `api/graph/[id]/route.ts` → `/api/graph/:id`
- Access param: `params.id` in route handler

### 5. Type Imports
Use `type` keyword for type-only imports (better for tree-shaking):
```typescript
import type { Message, Agent } from '@/lib/models/types';
import type { GraphResponse } from '@/types/api';
```

## Data Storage

### Current: In-Memory Storage
- Sessions stored in `src/lib/services/session-manager.ts`
- Data persists only while server is running
- Lost on server restart

### Future: Persistent Storage
To add database persistence:
1. Add database client (e.g., Prisma, Drizzle)
2. Update `session-manager.ts` to use database instead of Map
3. Store messages, graphs, and workflow data in database tables

## Debugging Tips

### Frontend Debugging
- Use browser DevTools Console
- React DevTools for component inspection
- Network tab to see API calls

### Backend Debugging
- Check terminal output (where `npm run dev` runs)
- Add `console.log()` in API routes or services
- Logs appear in terminal, not browser console

### Finding the Flow
1. **Start at UI**: Find the component (e.g., `PreFlightModal.tsx`)
2. **Find the Hook**: Look for data fetching (e.g., `use-upload.ts`)
3. **Find API Client**: See the fetch call (e.g., `uploadLogFiles()` in `api-client.ts`)
4. **Find API Route**: Locate the endpoint (e.g., `api/upload/route.ts`)
5. **Find Business Logic**: Follow the service calls (e.g., `parser-service.ts`)

## Common Patterns

### Pattern 1: Adding a New API Endpoint

**Step 1**: Create API route
```typescript
// src/app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Business logic here
  return NextResponse.json({ data: 'hello' });
}
```

**Step 2**: Add type definition
```typescript
// src/types/api.ts
export interface MyResponse {
  data: string;
}
```

**Step 3**: Add API client function
```typescript
// src/utils/api-client.ts
export async function getMyData(): Promise<MyResponse> {
  const response = await fetch('/api/my-endpoint');
  return response.json();
}
```

**Step 4**: Use in frontend
```typescript
// src/hooks/use-my-data.ts
import { useQuery } from '@tanstack/react-query';
import { getMyData } from '@/utils/api-client';

export function useMyData() {
  return useQuery({
    queryKey: ['myData'],
    queryFn: getMyData,
  });
}
```

### Pattern 2: Adding a New Component

```typescript
// src/components/my-feature/MyComponent.tsx
'use client';

import { useMyData } from '@/hooks/use-my-data';

export function MyComponent() {
  const { data, isLoading } = useMyData();
  
  if (isLoading) return <div>Loading...</div>;
  
  return <div>{data?.message}</div>;
}
```

## Comparison: Traditional vs Next.js

### Traditional Split Architecture

```
Frontend Repo (React)          Backend Repo (Express)
├── src/                       ├── src/
│   ├── components/           │   ├── routes/
│   ├── hooks/                │   ├── controllers/
│   ├── services/             │   ├── services/
│   │   └── api.js            │   ├── models/
│   └── utils/                │   └── utils/
├── package.json              ├── package.json
└── webpack.config.js         └── server.js

Run: npm start (port 3000)    Run: npm start (port 8000)
Deploy: CDN/Static hosting    Deploy: Node.js server
```

### Next.js (This Codebase)

```
Single Repo (Next.js)
├── src/
│   ├── app/
│   │   ├── page.tsx          ← Frontend: UI
│   │   └── api/              ← Backend: API routes
│   ├── components/           ← Frontend: React components
│   ├── hooks/                ← Frontend: React hooks
│   ├── lib/                  ← Backend: Business logic
│   │   ├── services/
│   │   ├── parsers/
│   │   └── models/
│   └── utils/
│       └── api-client.ts     ← Bridge between frontend/backend
└── package.json

Run: npm run dev (port 3000 for both)
Deploy: Vercel, Node.js server, or Docker
```

## Advantages of This Architecture

1. **Single Codebase**: Easier to maintain, one repo to manage
2. **Type Safety**: Shared TypeScript types across frontend/backend
3. **No CORS**: Frontend and backend on same origin
4. **Simplified Deployment**: Deploy once, runs everywhere
5. **Better DX**: Hot reload for both frontend and backend
6. **Code Sharing**: Reuse utilities, types, and logic

## When You Need to Know Frontend vs Backend

### Making Changes to UI → Frontend
- Modify components, hooks, or pages
- Files in: `components/`, `hooks/`, `app/page.tsx`

### Making Changes to Data/Logic → Backend
- Modify API routes, services, or parsers
- Files in: `app/api/`, `lib/services/`, `lib/parsers/`

### Making Changes to API Contract → Both
- Update types in `types/api.ts`
- Update API route handler
- Update API client function
- TypeScript will catch mismatches

## Key Application Features

### 1. **Multi-Framework Support**
CommuGraph can parse and visualize logs from multiple multi-agent frameworks:
- **AutoGen**: Single JSONL log file
- **Claude Code**: Multi-file logs (main session + sub-agents)

### 2. **Two Visualization Modes**

**Graph View** (`components/graph/`):
- Traditional directed graph visualization using React Flow
- Shows agents as nodes, messages as edges
- Timeline playback to see communication evolution
- Step-by-step replay of agent interactions

**Workflow View** (`components/workflow/`):
- Swimlane timeline visualization (process mining style)
- Each agent gets its own lane (horizontal swimlane)
- Events positioned chronologically on time axis
- Shows concurrent agent activities
- Includes metrics dashboard with statistics

### 3. **Timeline Playback**
- Scrub through agent interactions step-by-step
- See how the communication graph evolves over time
- Pause, play, and navigate to specific steps

### 4. **Metrics & Analytics**
- Message count per agent
- Edge counts (communication frequency)
- Timeline statistics
- Sub-agent relationship tracking

## Application Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│         (React Components in Browser)                    │
│  • GraphView, WorkflowView                              │
│  • TimelineControls, MetricsDashboard                   │
│  • PreFlightModal (file upload)                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ React Hooks + API Client
                     │ (use-graph-data, api-client.ts)
                     │
┌────────────────────▼────────────────────────────────────┐
│                      API LAYER                           │
│         (Next.js API Routes on Server)                   │
│  • POST /api/upload                                      │
│  • GET /api/graph/:id                                    │
│  • GET /api/graph/:id/workflow                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Service Layer
                     │
┌────────────────────▼────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                   │
│         (Services in src/lib/services/)                  │
│  • ParserService (parse logs)                           │
│  • GraphBuilder (build graph structure)                 │
│  • WorkflowGraphBuilder (build swimlane data)           │
│  • SessionManager (manage sessions)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Data Structures
                     │
┌────────────────────▼────────────────────────────────────┐
│                    DATA LAYER                            │
│         (In-Memory Storage)                              │
│  • Sessions (Map<sessionId, SessionData>)               │
│  • Messages, Graphs, WorkflowGraphs                     │
└─────────────────────────────────────────────────────────┘
```

## Summary

**CommuGraph uses Next.js**, which combines frontend (React) and backend (Node.js API) in one codebase:

- **Frontend (Browser)**: `src/components/`, `src/app/page.tsx`, `src/hooks/`, `src/context/`
- **Backend (Server)**: `src/app/api/`, `src/lib/`
- **Bridge**: `src/utils/api-client.ts` (fetch calls to API routes)
- **Shared**: `src/types/` (TypeScript types for both sides)
- **Static Assets**: `public/` (served at root path)

The key difference from traditional split architecture is that everything runs from **one server** on **one port**, with file-based routing for both pages and API endpoints.

## Quick Reference: Where to Find Things

| Looking for... | Location |
|---------------|----------|
| Add a new UI component | `src/components/` |
| Add a new API endpoint | `src/app/api/` |
| Modify graph visualization | `src/components/graph/` |
| Modify workflow/swimlane view | `src/components/workflow/` |
| Add a new parser | `src/lib/parsers/` |
| Change business logic | `src/lib/services/` |
| Add new API types | `src/types/api.ts` |
| Add data models | `src/lib/models/types.ts` |
| Modify API client | `src/utils/api-client.ts` |
| Add custom hooks | `src/hooks/` |
| Modify global state | `src/context/app-context.tsx` |
| Add static files | `public/` |
| Configure routing | File-based (no config needed) |
| Configure TypeScript | `tsconfig.json` |
| Configure Next.js | `next.config.ts` |
| Configure Tailwind | `postcss.config.mjs` |

## Related Documentation

- **`USAGE_GUIDE.md`**: User guide for using the application
- **`PROCESS_MINING_IMPLEMENTATION_PLAN.md`**: Implementation plan and design decisions
- **`understanding_claude_code_chat_log.md`**: Claude Code log format documentation
- **`graph_system_implementation.md`**: Graph system technical details
- **`UI_design.md`**: UI design specifications
- **`requirement_use_cases.md`**: Requirements and use cases
