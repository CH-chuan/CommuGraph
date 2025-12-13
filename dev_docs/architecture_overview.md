# CommuGraph Architecture Overview

## Introduction

**CommuGraph** is a process mining and visualization tool for multi-agent systems. It parses logs from multi-agent frameworks and provides interactive visualizations to understand agent communication patterns and workflows.

Built with **Next.js 15** as a unified full-stack application where all frontend and backend logic runs in TypeScript.

---

## Supported Frameworks

CommuGraph supports two multi-agent frameworks with distinct visualization approaches:

| Framework | Log Format | Main Canvas View | Metrics Panel |
|-----------|------------|------------------|---------------|
| **Claude Code** | Multi-file JSONL (session + sub-agents) | Workflow View / Annotation View (tabbed) | Hidden (integrated) |
| **AutoGen** | Single JSONL/JSON | Graph View (topology) | Sidebar panel |

---

## Three-Panel Layout

The application uses a consistent three-panel structure for both frameworks:

```
┌─────────────────────────────────────────────────────────────┐
│                          Header                              │
├──────────────┬──────────────────────────────┬───────────────┤
│              │                              │               │
│   Chat Log   │       Main Canvas            │   Metrics     │
│    (Left)    │       (Center)               │   (Right)     │
│              │                              │               │
│   25% width  │   50-75% width               │   0-25% width │
│              │                              │               │
│              ├──────────────────────────────┤               │
│              │   Timeline Controls          │               │
└──────────────┴──────────────────────────────┴───────────────┘
```

### Panel Behavior by Framework

| Panel | Claude Code | AutoGen |
|-------|-------------|---------|
| **Chat Log** | Workflow nodes with type-based colors | Message interactions with agent colors |
| **Main Canvas** | Tabbed: Workflow View / Annotation View | Graph View (topology) |
| **Metrics** | Hidden (canvas takes 75%) | AutoGenMetricsPanel (25%) |
| **Timeline** | WorkflowTimelineControls (step-mapped) | TimelineControls (simple scrubber) |

---

## Component Architecture

### Shared Components (Both Frameworks)

These components work identically for both Claude Code and AutoGen:

```
src/components/
├── layout/
│   ├── Header.tsx            # App title, upload button, session selector
│   └── MainLayout.tsx        # Three-panel orchestration with react-resizable-panels
├── chat/
│   └── ChatLog.tsx           # Message list with cross-highlighting (adapts to framework)
├── upload/
│   └── PreFlightModal.tsx    # File upload dialog with framework selector
├── providers/
│   └── Providers.tsx         # QueryClient + AppProvider wrapper
└── ui/                       # shadcn/ui primitives (Button, Dialog, Slider, etc.)
```

### Claude Code Components

```
src/components/
├── workflow/                          # Workflow View
│   ├── WorkflowView.tsx               # Tree-based activity visualization
│   ├── WorkflowViewWrapper.tsx        # SSR-safe dynamic import
│   ├── WorkflowNode.tsx               # 6 node types (user/reasoning/tool/result/system)
│   ├── WorkflowEdge.tsx               # Duration-colored edges
│   ├── SessionStartNode.tsx           # Header card with session metadata
│   ├── SubAgentModal.tsx              # Modal displaying sub-agent workflow tree
│   ├── WorkflowTimelineControls.tsx   # Enhanced timeline with main-agent step mapping
│   └── MetricsDashboard.tsx           # Session metrics (duration, tokens, tools)
│
└── annotation/                        # Annotation View
    ├── AnnotationView.tsx             # Vertical conversation flow for annotation
    ├── AnnotationViewWrapper.tsx      # SSR-safe dynamic import
    └── AnnotationNode.tsx             # User/Assistant/System turn nodes
```

### AutoGen Components

```
src/components/
├── graph/                             # Graph View
│   ├── GraphView.tsx                  # React Flow graph container
│   ├── GraphViewWrapper.tsx           # SSR-safe dynamic import
│   ├── GraphCanvas.tsx                # Graph with fit-view and controls
│   ├── AgentNode.tsx                  # Rich card node (icon, status, message counts)
│   ├── GhostEdge.tsx                  # Temporal edge with opacity states
│   └── TimelineControls.tsx           # Simple play/pause/scrubber
│
└── insights/
    └── AutoGenMetricsPanel.tsx        # Graph metrics sidebar (density, centrality)
```

---

## Claude Code: Two Canvas Views

Claude Code's main canvas provides two views accessed via tabs:

### 1. Workflow View (Default)

**Purpose**: Tree-based visualization of agent activity with temporal flow.

**Layout**: Vertical DAG (Directed Acyclic Graph)
- Session Start Node at top (metadata card)
- Reasoning nodes in single column
- Tool calls branch horizontally for parallel execution
- Sub-agent cards as collapsed containers (click to expand)

**Node Types** (6 total):

| Type | Color | Icon | Content |
|------|-------|------|---------|
| Session Start | Blue | GitBranch | Duration, tokens, node count |
| User Input | Blue | User | User prompt text |
| Agent Reasoning | Purple | Brain | Thinking + response text |
| Tool Call | Emerald | Tool-specific | Tool name, input parameters |
| Result Success | Green | Check | Stdout, file preview |
| Result Failure | Red | X | Stderr, error message |

**Special Features**:
- Sub-agent containers: Task tool calls render as expandable cards
- Parallel grouping: Tool calls from same request show with count badge
- Duration-colored edges: Green (fast) → Yellow → Orange → Red (slow)
- Step filtering: Shows nodes up to current step

### 2. Annotation View

**Purpose**: Vertical conversation flow designed for human annotation tasks.

**Layout**: Row-based sequential flow
- Each conversation unit is a row
- User turns: Single centered node
- Assistant turns: Consecutive turns laid out horizontally
- Vertical edges connect rows (main flow)
- Horizontal edges connect within-row assistant turns

**Node Types** (3 total):

| Type | Color | Content |
|------|-------|---------|
| User Turn | Blue | User prompt with label slot |
| Assistant Turn | Purple | Thinking (collapsible), response, tool calls with label slot |
| System Turn | Grey | Context compaction summary |

**Special Features**:
- Label slots: Empty regions for annotation labels (future feature)
- Tool summary: Shows tool call count with success/failure status
- Expandable sections: Thinking and tool details collapse/expand

### View Switching

Tab component in MainLayout switches between views:
- **Workflow Tab**: GitBranch icon, blue accent
- **Annotation Tab**: Tag icon, purple accent
- State stored in `AppContext.viewMode`

---

## Backend Architecture

### Shared Backend Services

```
src/lib/
├── models/
│   └── types.ts              # Zod schemas + TypeScript types (Message, Session, etc.)
├── graph/
│   └── digraph.ts            # Custom DiGraph implementation
├── parsers/
│   └── base-parser.ts        # Abstract parser interface with error handling
└── services/
    ├── parser-service.ts     # Parser registry (delegates to framework-specific parsers)
    └── session-manager.ts    # In-memory session storage (Map<sessionId, SessionData>)
```

### Claude Code Backend

```
src/lib/
├── parsers/
│   └── claude-code-parser.ts    # Multi-file JSONL parser with chunking
├── services/
│   ├── workflow-graph-builder.ts # Builds DAG from ClaudeCodeMessages
│   └── sub-agent-loader.ts       # Lazy sub-agent file loading
└── annotation/
    └── preprocessor.ts           # Generates annotation-ready records
```

### AutoGen Backend

```
src/lib/
├── parsers/
│   └── autogen-parser.ts        # Simple JSONL/JSON parser
└── services/
    └── graph-builder.ts         # Builds DiGraph with temporal edges
```

---

## API Routes

### Shared Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload log files, returns session ID |
| `/api/frameworks` | GET | List supported parsers |
| `/api/sessions` | GET | List all active sessions |
| `/api/session/[id]` | DELETE | Delete a session |
| `/api/graph/[id]/info` | GET | Get session metadata |

### AutoGen-Specific Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/graph/[id]` | GET | Get graph snapshot (optional `?step=N`) |
| `/api/graph/[id]/metrics` | GET | Get graph metrics (density, centrality) |

### Claude Code-Specific Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/graph/[id]/workflow` | GET | Get workflow snapshot (optional `?step=N`) |
| `/api/graph/[id]/annotations` | GET | Get annotation records |

---

## Data Fetching Hooks

### Shared Hooks

```
src/hooks/
├── use-upload.ts              # File upload mutation
└── use-timeline-playback.ts   # Play/pause animation
```

### Claude Code Hooks

```
src/hooks/
├── use-workflow-data.ts       # Fetch workflow snapshot
└── use-annotation-data.ts     # Fetch annotation records
```

### AutoGen Hooks

```
src/hooks/
├── use-graph-data.ts          # Fetch graph snapshot
└── use-metrics-data.ts        # Fetch graph metrics
```

---

## State Management

### Global App Context (`src/context/app-context.tsx`)

```typescript
interface AppContextType {
  // Session (Both)
  graphId: string | null;
  framework: 'autogen' | 'claudecode' | null;

  // Timeline (Both)
  currentStep: number;
  totalSteps: number;

  // Highlighting (Both - cross-panel interaction)
  highlightedAgentId: string | null;
  highlightedStepIndex: number | null;
  focusStepIndex: number | null;

  // Claude Code Only
  viewMode: 'workflow' | 'annotation';
  mainAgentStepCount: number;
  showSubAgentMessages: boolean;
  selectedMetricsAgent: string;

  // AutoGen Only
  abstractionMode: string | null;
}
```

---

## Data Flow

### AutoGen Data Flow

```
Upload JSONL/JSON
    ↓
AutoGenParser.parse() → Message[]
    ↓
GraphBuilder.buildGraph() → DiGraph
    ↓
GraphBuilder.toGraphSnapshot(step) → GraphSnapshot
    ↓
SessionManager stores (graph + messages)
    ↓
API: GET /api/graph/:id → GraphSnapshot
    ↓
useGraphData hook → GraphView
    ↓
AgentNode + GhostEdge + ChatLog + AutoGenMetricsPanel
```

### Claude Code Data Flow (Workflow)

```
Upload JSONL (main session)
    ↓
Extract agentIds from Task tool results
    ↓
Load sub-agent files (agent-*.jsonl)
    ↓
ClaudeCodeParser.parseMultiFile() → ClaudeCodeParseResult
    ↓
WorkflowGraphBuilder.build() → WorkflowGraphSnapshot
    ↓
SessionManager stores (workflow + messages + subAgents)
    ↓
API: GET /api/graph/:id/workflow → WorkflowGraphSnapshot
    ↓
useWorkflowData hook → WorkflowView
    ↓
WorkflowNode + WorkflowEdge + ChatLog
```

### Claude Code Data Flow (Annotation)

```
ClaudeCodeParseResult
    ↓
AnnotationPreprocessor.generateAnnotationRecords()
    ↓
Group by requestId → assistant_turn
Filter user prompts → user_turn
Extract system events → system_turn
    ↓
AnnotationRecord[] (sorted by timestamp)
    ↓
API: GET /api/graph/:id/annotations
    ↓
useAnnotationData hook → AnnotationView
    ↓
AnnotationNode (UserTurn/AssistantTurn/SystemTurn)
```

---

## Parser Comparison

### Feature Matrix

| Feature | Claude Code Parser | AutoGen Parser |
|---------|-------------------|----------------|
| **Input** | Multi-file (session + agents) | Single file |
| **Format** | JSONL only | JSONL or JSON array |
| **Message Chunking** | Yes (requestId merging) | No |
| **Sub-agent Support** | Yes (agentId tracking) | No |
| **Workflow Node Types** | 6 types | N/A |
| **Context Compaction** | Yes | No |
| **Temporal Edges** | N/A | Yes (ghost trail) |
| **Token Tracking** | Per-message | Metadata only |

### Claude Code Parser Details

**Complexity**: High - handles multi-file sessions with complex chunking

Key capabilities:
- **Multi-file parsing**: Main session + sub-agent files (agent-*.jsonl)
- **LLM Response Chunking**: Thinking, text, and tool_use arrive in separate records
- **User Type Decomposition**: Distinguishes user_input, tool_result, system_notice
- **Temporal Ordering**: Uses parentUuid chains for message sequencing
- **Context Compaction**: Special handling for compact_boundary system records

### AutoGen Parser Details

**Complexity**: Low - simple format parsing

Key capabilities:
- **Format Flexibility**: Handles both JSONL and JSON array
- **Field Mapping**: Flexible extraction from various field names
- **Timestamp Inference**: Multiple fallback strategies
- **Message Type Inference**: Pattern matching in content

---

## Cross-Panel Interactions

### Highlighting Flow

```
User clicks message in ChatLog
    ↓
setHighlightedStepIndex(step)
    ↓
AppContext.highlightedStepIndex updates
    ↓
Canvas view highlights corresponding node
    ↓
Auto-scroll to message in ChatLog
```

### Focus Flow (Double-Click)

```
User double-clicks message in ChatLog
    ↓
setFocusStepIndex(step)
    ↓
Canvas view centers viewport on node
    ↓
Timeline jumps to that step
```

---

## Key Architectural Patterns

### Framework Detection

```typescript
// In MainLayout.tsx
const isClaudeCode = framework === 'claudecode';

{isClaudeCode ? (
  viewMode === 'annotation' ? <AnnotationViewWrapper /> : <WorkflowViewWrapper />
) : (
  <GraphViewWrapper />
)}
```

### SSR Safety

All React Flow components use dynamic imports to avoid SSR issues:

```typescript
const WorkflowView = dynamic(
  () => import('./WorkflowView').then(m => ({ default: m.WorkflowView })),
  { ssr: false }
);
```

### Step Mapping (Claude Code)

Main agent nodes use sequential numbering while internally tracking global stepIndex:

```typescript
// mainAgentStepMap: Map<stepIndex, sequentialNumber>
mainAgentStepMap.set(42, 1); // Node at stepIndex 42 is "Step 1"
mainAgentStepMap.set(45, 2); // Node at stepIndex 45 is "Step 2"

// Timeline uses sequential numbers
currentStep = 2;

// Convert to actual stepIndex for filtering
effectiveStepIndex = mainAgentStepMap.get(2); // → 45
```

---

## Directory Structure Summary

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Main page (client component)
│   ├── layout.tsx                # Root layout with providers
│   └── api/                      # API routes
│       ├── upload/               # POST /api/upload
│       ├── frameworks/           # GET /api/frameworks
│       ├── sessions/             # GET /api/sessions
│       ├── graph/[id]/           # Graph endpoints
│       │   ├── route.ts          # GET /api/graph/:id (AutoGen)
│       │   ├── workflow/         # GET /api/graph/:id/workflow (Claude Code)
│       │   ├── annotations/      # GET /api/graph/:id/annotations (Claude Code)
│       │   ├── metrics/          # GET /api/graph/:id/metrics (AutoGen)
│       │   └── info/             # GET /api/graph/:id/info
│       └── session/[id]/         # DELETE /api/session/:id
│
├── components/
│   ├── layout/                   # [SHARED] Layout components
│   ├── chat/                     # [SHARED] Chat log
│   ├── upload/                   # [SHARED] Upload modal
│   ├── providers/                # [SHARED] React providers
│   ├── ui/                       # [SHARED] shadcn/ui components
│   ├── workflow/                 # [CLAUDE CODE] Workflow view
│   ├── annotation/               # [CLAUDE CODE] Annotation view
│   ├── graph/                    # [AUTOGEN] Graph view
│   └── insights/                 # [AUTOGEN] Metrics panel
│
├── hooks/
│   ├── use-upload.ts             # [SHARED]
│   ├── use-timeline-playback.ts  # [SHARED]
│   ├── use-workflow-data.ts      # [CLAUDE CODE]
│   ├── use-annotation-data.ts    # [CLAUDE CODE]
│   ├── use-graph-data.ts         # [AUTOGEN]
│   └── use-metrics-data.ts       # [AUTOGEN]
│
├── lib/
│   ├── models/types.ts           # [SHARED] Type definitions
│   ├── graph/digraph.ts          # [SHARED] Graph data structure
│   ├── parsers/
│   │   ├── base-parser.ts        # [SHARED] Abstract parser
│   │   ├── claude-code-parser.ts # [CLAUDE CODE]
│   │   └── autogen-parser.ts     # [AUTOGEN]
│   ├── services/
│   │   ├── parser-service.ts     # [SHARED] Parser registry
│   │   ├── session-manager.ts    # [SHARED] Session storage
│   │   ├── workflow-graph-builder.ts  # [CLAUDE CODE]
│   │   ├── sub-agent-loader.ts   # [CLAUDE CODE]
│   │   └── graph-builder.ts      # [AUTOGEN]
│   └── annotation/
│       └── preprocessor.ts       # [CLAUDE CODE]
│
├── context/
│   └── app-context.tsx           # [SHARED] Global state
│
├── types/
│   ├── api.ts                    # API response types
│   ├── graph.ts                  # Graph data structures
│   └── index.ts                  # Re-exports
│
└── utils/
    ├── api-client.ts             # [SHARED] Fetch-based API client
    ├── workflow-layout.ts        # [CLAUDE CODE] Layout algorithm
    └── graph-adapters.ts         # [AUTOGEN] React Flow conversion
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Graph Visualization | React Flow (@xyflow/react) |
| State Management | TanStack Query + React Context |
| Validation | Zod |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui (Radix-based) |
| Layout | react-resizable-panels |

---

## Quick Reference

| Task | Location |
|------|----------|
| Add UI component | `src/components/` |
| Add API endpoint | `src/app/api/` |
| Add new parser | `src/lib/parsers/` + register in `parser-service.ts` |
| Modify graph visualization | `src/components/graph/` (AutoGen) |
| Modify workflow visualization | `src/components/workflow/` (Claude Code) |
| Modify annotation visualization | `src/components/annotation/` (Claude Code) |
| Add data model | `src/lib/models/types.ts` |
| Add API types | `src/types/api.ts` |
| Add shared hook | `src/hooks/` |
| Modify global state | `src/context/app-context.tsx` |
