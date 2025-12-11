# Process Mining Implementation Plan for Claude Code Chat Logs

## Executive Summary

This document outlines the implementation strategy for adding process mining capabilities to CommuGraph, specifically designed for analyzing Claude Code multi-agent chat logs. The goal is to transform raw chat logs into actionable insights about agent workflow patterns, tool usage efficiency, and bottleneck detection.

---

## Part 1: Key Discoveries We Should Unlock

### 1.1 Workflow Pattern Analysis

**What we want to discover:**
- **Dominant workflow sequences**: What is the "happy path" of a coding task? (e.g., `Read → Plan → Edit → Bash → Verify`)
- **Workflow variants**: How many distinct patterns exist? Which are efficient vs. problematic?
- **Task decomposition patterns**: When does the agent spawn sub-agents vs. handle inline?

**Why it matters:**
Understanding common patterns helps identify best practices and detect anomalies.

### 1.2 Tool Usage Patterns

**What we want to discover:**
- **Tool frequency distribution**: Which tools are most used? (Read, Write, Edit, Bash, etc.)
- **Tool sequences**: Common tool chains (e.g., `Glob → Read → Edit` for file modifications)
- **Tool effectiveness**: Success/failure rates per tool
- **Redundant tool calls**: Multiple Reads of the same file, failed Bash retries

**Metrics to compute:**
| Metric | Description |
|--------|-------------|
| Tool frequency | Count per tool type |
| Tool transition matrix | P(tool_B | tool_A) |
| Tool retry rate | Same tool called consecutively |
| Tool failure rate | Error results / total calls |

### 1.3 Temporal Performance Analysis

**What we want to discover:**
- **Activity duration**: Time spent in thinking vs. tool execution vs. waiting
- **Bottleneck identification**: Which activities/transitions take longest?
- **Throughput analysis**: Messages per minute, tokens per task
- **User wait time**: How long between user message and actionable response?

**Key performance indicators:**
| KPI | Calculation |
|-----|-------------|
| Mean thinking time | Avg duration of `thinking` content blocks |
| Tool latency | Time from tool_use to tool_result |
| Task completion time | First user message to final response |
| Token efficiency | Tokens used / lines of code changed |

### 1.4 Multi-Agent Orchestration Analysis

**What we want to discover:**
- **Sub-agent spawn patterns**: What triggers Task tool usage?
- **Sub-agent effectiveness**: Duration, token cost, tool count per sub-agent
- **Agent interaction topology**: Who communicates with whom?
- **Parallel vs. sequential execution**: When are multiple agents used concurrently?

**Sub-agent metrics:**
| Metric | Source |
|--------|--------|
| Spawn count | `tool_use.name === 'Task'` |
| Sub-agent duration | `toolUseResult.totalDurationMs` |
| Sub-agent tokens | `toolUseResult.totalTokens` |
| Sub-agent tool count | `toolUseResult.totalToolUseCount` |

### 1.5 Debugging Loop Detection

**What we want to discover:**
- **Edit-Bash-Edit cycles**: Repeated modification attempts indicating bugs
- **Read loops**: Same file read multiple times (possibly missing context)
- **Error recovery patterns**: How agent responds to failures
- **Stagnation detection**: Long periods without progress

**Pattern signatures:**
```
Debugging loop: Edit → Bash(fail) → Read → Edit → Bash(fail) → ...
Exploration loop: Glob → Read → Grep → Read → Grep → ...
Successful completion: Edit → Bash(success) → Write(test) → Bash(pass)
```

### 1.6 User Interaction Analysis

**What we want to discover:**
- **User intervention points**: When do users provide feedback/clarification?
- **User satisfaction signals**: Task completion vs. abandonment
- **Prompt quality impact**: How initial prompt affects workflow complexity

---

## Part 2: Data Model Changes

### 2.1 Core Node Types for Agent Activity View

The visualization needs to distinguish different types of workflow nodes:

```typescript
// Core node types for Agent Activity View (View B)
const WorkflowNodeType = {
  // User-originated
  USER_INPUT: 'user_input',           // Real human input
  TOOL_RESULT: 'tool_result',         // Response from tool execution
  SYSTEM_NOTICE: 'system_notice',     // System injections, queue notifications

  // Agent-originated
  AGENT_REASONING: 'agent_reasoning', // Thinking + text from same LLM response
  TOOL_CALL: 'tool_call',             // Individual tool invocation

  // Results
  RESULT_SUCCESS: 'result_success',
  RESULT_FAILURE: 'result_failure',
} as const;
```

### 2.2 "User" Type Decomposition

The `type: "user"` in Claude Code logs is **overloaded**. We decompose it into three distinct categories:

| Original | Condition | New Classification |
|----------|-----------|-------------------|
| `type: "user"` | Real human prompt/feedback | `user_input` |
| `type: "user"` | `content` is array with `tool_result` | `tool_result` |
| `type: "user"` | `isMeta: true` or system injection | `system_notice` |

**Detection logic:**
```typescript
function classifyUserMessage(record: RawLogRecord): WorkflowNodeType {
  // Tool result check
  if (Array.isArray(record.message?.content)) {
    const hasToolResult = record.message.content.some(
      c => c.type === 'tool_result'
    );
    if (hasToolResult) return 'tool_result';
  }

  // System notice check
  if (record.isMeta) return 'system_notice';
  if (record.message?.content?.includes('<local-command-')) return 'system_notice';
  if (record.message?.content?.includes('<bash-notification>')) return 'system_notice';

  // Default: real user input
  return 'user_input';
}
```

### 2.3 Activity Taxonomy — TBD (Placeholder)

> **Note**: The detailed activity labeling scheme (for Process View / View A) is currently being defined separately. The taxonomy below is a **placeholder** and will be refined based on further analysis.

**Preliminary structure:**

```typescript
// PLACEHOLDER - Activity taxonomy TBD
// This will be defined based on process mining requirements
const ActivityType = {
  // User activities (TBD: may need finer granularity)
  USER_PROMPT: 'user:prompt',
  USER_FEEDBACK: 'user:feedback',

  // Agent activities (TBD: may need finer granularity)
  AGENT_THINK: 'agent:think',
  AGENT_EXPLAIN: 'agent:explain',

  // Tool activities - one per tool type
  TOOL_READ: 'tool:read',
  TOOL_WRITE: 'tool:write',
  TOOL_EDIT: 'tool:edit',
  TOOL_BASH: 'tool:bash',
  TOOL_GLOB: 'tool:glob',
  TOOL_GREP: 'tool:grep',
  TOOL_TASK: 'tool:task',
  // ... other tools as discovered

  // Results
  RESULT_SUCCESS: 'result:success',
  RESULT_FAILURE: 'result:failure',

  // System (TBD: may filter these out)
  SYSTEM_NOTICE: 'system:notice',
} as const;
```

**Status**: Awaiting final taxonomy definition before implementation.

### 2.4 Extended Interaction Schema

Current `Interaction` schema needs enrichment for process mining:

```typescript
// Extended interaction for process mining
interface ProcessMiningInteraction extends Interaction {
  activity_type: ActivityType;

  // Duration metrics
  duration_ms?: number;
  thinking_time_ms?: number;

  // Token metrics
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;

  // Tool-specific data
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result_status?: 'success' | 'failure' | 'partial';

  // Linking
  request_id?: string;  // Groups LLM response chunks
  message_api_id?: string;  // Claude API message ID
  parent_activity_id?: string;  // For hierarchical activities

  // Sub-agent context
  is_sidechain?: boolean;
  agent_id?: string;
  subagent_type?: string;
}
```

### 2.5 New Process Mining Types

```typescript
// Event log record (Disco-compatible)
interface EventLogRecord {
  case_id: string;          // Session or task identifier
  event_id: string;         // UUID of the event
  activity: ActivityType;   // Activity label
  timestamp: string;        // ISO timestamp
  resource: string;         // 'user' | 'assistant' | 'agent-{id}'

  // Optional enrichments
  tool_name?: string;
  duration_ms?: number;
  tokens?: number;
  is_sidechain?: boolean;
  parent_uuid?: string;
}

// Process metrics
interface ProcessMetrics {
  // Frequency metrics
  activity_frequency: Record<ActivityType, number>;
  transition_frequency: Record<string, number>;  // "activity_A→activity_B"
  variant_frequency: Record<string, number>;     // Full path hash → count

  // Performance metrics
  activity_duration: Record<ActivityType, {
    mean: number;
    median: number;
    p95: number;
    min: number;
    max: number;
  }>;

  transition_duration: Record<string, {
    mean: number;
    median: number;
  }>;

  // Case-level metrics
  case_duration_ms: number;
  total_tokens: number;
  total_tool_calls: number;
  tool_success_rate: number;

  // Sub-agent metrics
  subagent_count: number;
  subagent_total_tokens: number;
  subagent_total_duration_ms: number;
}

// Process variant (unique execution path)
interface ProcessVariant {
  id: string;
  activity_sequence: ActivityType[];
  frequency: number;
  avg_duration_ms: number;
  avg_tokens: number;
}

// Detected pattern/anomaly
interface ProcessAnomaly {
  type: 'loop' | 'stagnation' | 'excessive_retry' | 'long_wait';
  start_step: number;
  end_step: number;
  activities_involved: string[];
  severity: number;
  description: string;
}
```

---

## Part 3: Parser Implementation

### 3.1 Claude Code Parser Architecture

The parser needs to handle:
1. **Multi-file sessions**: Main session + multiple sub-agent files
2. **Message chunking**: Single LLM response split into multiple lines
3. **Async ordering**: Timestamps may not match logical order
4. **Context compaction**: New logical threads within same session

**Key parsing challenges:**

| Challenge | Solution |
|-----------|----------|
| Multi-file | Accept folder path, auto-discover agent-*.jsonl |
| Chunk merging | Group by `requestId` + `message.id` |
| Async ordering | Use `parentUuid` for logical ordering |
| Compaction | Track `logicalParentUuid` for continuity |

### 3.2 Parser Output Structure

```typescript
interface ClaudeCodeParseResult {
  sessionId: string;
  messages: Message[];  // Unified message list

  // Process mining additions
  eventLog: EventLogRecord[];

  // Metadata
  mainAgentFile: string;
  subAgentFiles: string[];
  totalTokens: number;
  timeRange: { start: string; end: string };

  // Sub-agent index
  subAgents: Map<string, {
    agentId: string;
    subagentType: string;
    prompt: string;
    totalDuration: number;
    totalTokens: number;
  }>;
}
```

### 3.3 Activity Classification Logic

```typescript
function classifyActivity(record: RawLogRecord): ActivityType {
  if (record.type === 'user') {
    // Check for tool results
    if (Array.isArray(record.message?.content)) {
      const hasToolResult = record.message.content.some(
        c => c.type === 'tool_result'
      );
      if (hasToolResult) {
        const status = record.toolUseResult?.status ||
                      (record.toolUseResult?.stderr ? 'failure' : 'success');
        return status === 'failure' ? 'result:failure' : 'result:success';
      }
    }

    // Check for slash commands
    if (record.message?.content?.includes('<command-name>')) {
      return 'user:clarify';
    }

    // Check for meta messages
    if (record.isMeta) return 'system:queue_operation';

    // Default user input
    return 'user:provide_task';
  }

  if (record.type === 'assistant') {
    const content = record.message?.content?.[0];
    if (!content) return 'agent:explain';

    if (content.type === 'thinking') return 'agent:think';
    if (content.type === 'text') return 'agent:explain';
    if (content.type === 'tool_use') {
      const toolMap: Record<string, ActivityType> = {
        'Read': 'tool:read',
        'Write': 'tool:write',
        'Edit': 'tool:edit',
        'Bash': 'tool:bash',
        'Glob': 'tool:glob',
        'Grep': 'tool:grep',
        'Task': 'tool:task',
        'TodoWrite': 'tool:todo',
        'AskUserQuestion': 'tool:ask_user',
      };
      return toolMap[content.name] || 'agent:explain';
    }
  }

  if (record.type === 'system') return 'system:context_compact';
  if (record.type === 'file-history-snapshot') return 'system:file_snapshot';
  if (record.type === 'queue-operation') return 'system:queue_operation';

  return 'agent:explain';
}
```

---

## Part 4: Graph Builder Changes

### 4.1 New Graph Building Mode: Process Flow

Current graph: **Agent-to-Agent communication topology**
New mode: **Activity-to-Activity process flow**

```typescript
interface ProcessFlowGraphOptions {
  mode: 'process_flow' | 'agent_topology';

  // For process flow mode
  collapseConsecutive?: boolean;  // Merge Read→Read→Read into single node
  minFrequencyThreshold?: number;  // Hide rare transitions

  // Shared options
  includeSubAgents?: boolean;
  maxStep?: number;
}
```

### 4.2 Process Flow Node Types

In process flow mode, nodes represent **activities** not agents:

```typescript
interface ProcessFlowNode {
  id: string;  // Activity type
  label: string;  // Human-readable label
  frequency: number;  // Total occurrences
  avg_duration_ms: number;
  total_tokens: number;

  // Visual properties
  category: 'user' | 'agent' | 'tool' | 'system';
  color: string;
}
```

### 4.3 Process Flow Edge Types

Edges represent **transitions** between activities:

```typescript
interface ProcessFlowEdge {
  source: string;  // Source activity
  target: string;  // Target activity

  frequency: number;  // Transition count
  probability: number;  // P(target | source)
  avg_duration_ms: number;  // Time between activities

  // For bottleneck detection
  is_bottleneck: boolean;  // Duration > 2x average
}
```

---

## Part 5: Metrics Service

### 5.1 New Metrics API Endpoint

```
GET /api/graph/{id}/process-metrics
```

**Response:**
```typescript
interface ProcessMetricsResponse {
  // Summary stats
  total_events: number;
  unique_activities: number;
  total_duration_ms: number;
  total_tokens: number;

  // Frequency analysis
  activity_frequency: Record<string, number>;
  top_transitions: Array<{
    from: string;
    to: string;
    count: number;
    probability: number;
  }>;

  // Performance analysis
  bottlenecks: Array<{
    activity: string;
    avg_duration_ms: number;
    impact_score: number;
  }>;

  // Pattern detection
  detected_loops: ProcessAnomaly[];
  variants: ProcessVariant[];

  // Tool analysis
  tool_stats: Record<string, {
    call_count: number;
    success_rate: number;
    avg_duration_ms: number;
    total_tokens: number;
  }>;

  // Sub-agent analysis
  subagent_stats: {
    total_spawned: number;
    total_tokens: number;
    total_duration_ms: number;
    by_type: Record<string, {
      count: number;
      avg_tokens: number;
      avg_duration_ms: number;
    }>;
  };
}
```

### 5.2 Metrics Computation Service

```typescript
class ProcessMetricsService {
  // Frequency metrics
  computeActivityFrequency(events: EventLogRecord[]): Record<string, number>;
  computeTransitionMatrix(events: EventLogRecord[]): Map<string, Map<string, number>>;

  // Performance metrics
  computeActivityDurations(events: EventLogRecord[]): Record<string, DurationStats>;
  detectBottlenecks(events: EventLogRecord[], threshold?: number): Bottleneck[];

  // Pattern detection
  extractVariants(events: EventLogRecord[]): ProcessVariant[];
  detectLoops(events: EventLogRecord[]): ProcessAnomaly[];

  // Tool analysis
  computeToolStats(events: EventLogRecord[]): ToolStats;

  // Sub-agent analysis
  computeSubAgentStats(events: EventLogRecord[]): SubAgentStats;
}
```

---

## Part 6: Visualization Design (Revised)

### 6.1 Core Philosophy: Sequential Workflow, Not Conversation Graph

**Key insight**: Claude Code workflow is NOT a conversation graph. It's a **process execution trace**.

The visualization should answer:
- What did the agent do, in what order?
- Where did it spend time?
- Where did it loop/retry?
- What tools succeeded/failed?

**Deprecate**: Agent-to-agent topology view (not relevant for single-agent workflows)
**New focus**: Sequential workflow with temporal growth

---

### 6.2 Two View Modes

#### View A: Agent Activity View (Granular) — DEFAULT, IMPLEMENT FIRST

The default view. Real-time workflow visualization where:

| Element | Represents |
|---------|------------|
| **Agent Reasoning Node** | Thinking + text from same LLM response (grouped by `message.id` or `requestId`) |
| **Tool Call Node** | Each individual `tool_use` (e.g., `tool:read`, `tool:bash`) |
| **Tool Result Node** | Success or failure response from tool execution |
| **User Input Node** | Real human input |
| **System Notice Node** | System injections, queue notifications |

**Node generation from one LLM response:**

If one API response contains `thinking + text + tool_use(Read) + tool_use(Glob)`:

```
Creates 3 nodes:
  [Agent Reasoning] ← thinking + text merged
  [tool:read]       ← separate node
  [tool:glob]       ← separate node
```

#### View B: Process View (Summarized) — DEFERRED, CLICK TO ACCESS

Secondary view accessible via toggle button. Abstract view where each "process" (grouped activities) is a node.

**Status**: Postponed until activity taxonomy is finalized.

**Requirements before implementation:**
- Definition of what constitutes a "process"
- Final activity labeling/classification scheme
- Aggregation rules for collapsing activities

---

### 6.3 Graph Structure: DAG with Fork/Join

The workflow is a **Directed Acyclic Graph (DAG)**, not a linear sequence.

#### Fork Pattern (Parallel Tool Calls)

When multiple tool calls originate from the same reasoning node:

```
         [Agent Reasoning]
                │
          ┌─────┴─────┐
          ▼           ▼
     [tool:read]  [tool:glob]
          │           │
          ▼           ▼
      [success]   [success]
          │           │
          └─────┬─────┘
                ▼
         [Agent Reasoning]
```

#### Join Pattern (Results Converge)

Tool results converge before the next agent reasoning step. The next reasoning node waits for all parallel results.

---

### 6.4 Sub-Agent Visualization: Parallel Lanes

When the main agent spawns a sub-agent via `tool:task`:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Main Agent Lane                         │ Sub-agent Lane            │
├─────────────────────────────────────────┼───────────────────────────┤
│                                         │                           │
│ [Agent Reasoning]                       │                           │
│        │                                │                           │
│        ▼                                │                           │
│   [tool:task] ──────────────────────────┼──► [Start]                │
│        │                                │        │                  │
│        │ (waiting)                      │        ▼                  │
│        │                                │   [Reasoning]             │
│        │                                │        │                  │
│        │                                │        ▼                  │
│        │                                │   [tool:read]             │
│        │                                │        │                  │
│        │                                │        ▼                  │
│        │                                │    [success]              │
│        │                                │        │                  │
│        ▼                                │        ▼                  │
│  [task_result] ◄────────────────────────┼─── [End]                  │
│        │                                │                           │
│        ▼                                │                           │
│ [Agent Reasoning]                       │                           │
│                                         │                           │
└─────────────────────────────────────────┴───────────────────────────┘
```

**Sub-agent metadata to display:**
- On `[tool:task]` node: Sub-agent **prompt** (what it was asked to do)
- On `[task_result]` node or sub-agent lane header:
  - Status: success / failure
  - Tokens used
  - Duration (ms)
  - Tool call count

**Failure handling:**
- If sub-agent succeeds: Connect `[End]` → `[task_result]`
- If sub-agent fails: Connect `[End]` → `[task_result:failure]` (styled differently)

---

### 6.5 Edge Design

#### Semantic

Edges represent **"followed by"** in temporal sequence. Direction matters.

#### Visual Encoding

| Property | Encoding |
|----------|----------|
| Direction | Arrow head |
| Duration | Color gradient (green → yellow → red) |
| Sequence | Optional step number label |

**Duration color scale:**
- Green (#22C55E): Fast (< 500ms)
- Yellow (#EAB308): Medium (500ms - 2s)
- Orange (#F97316): Slow (2s - 5s)
- Red (#EF4444): Very slow (> 5s)

**Interaction:**
- Hover: Show exact duration (e.g., "1,234 ms")
- Click: Highlight path, show details in sidebar

---

### 6.6 Timestamp Axis: Vertical Time Ruler

Add a **vertical time axis** on the left side of the graph canvas:

```
Time (s) │  Main Lane              │ Sub-agent Lane
─────────┼─────────────────────────┼──────────────────
   0.0   │ [User Input]            │
         │      │                  │
   1.2   │ [Agent Reasoning]       │
         │      │                  │
   3.5   │ [tool:read]             │
         │      │                  │
   3.8   │ [success]               │
         │      │                  │
   4.1   │ [Agent Reasoning]       │
         │      │                  │
   5.0   │ [tool:task] ────────────┼──► [Start]
         │      │                  │       │
   5.5   │      │                  │  [Reasoning]
         │      │                  │       │
   7.2   │      │                  │  [tool:glob]
         │      │                  │       │
   7.4   │      │                  │  [success]
         │      │                  │       │
   8.1   │ [task_result] ◄─────────┼─── [End]
         │      │                  │
   8.5   │ [Agent Reasoning]       │
```

**Features:**
- Timestamps relative to session start (or absolute, toggle-able)
- Tick marks at regular intervals (auto-scaled based on total duration)
- Clickable to jump to that point in time

---

### 6.7 Integration with Bottom Timeline Controls

The existing `TimelineControls` component (Gantt-style) should coordinate with the new vertical time axis:

#### Dual-Axis Coordination

| Component | Axis | Controls |
|-----------|------|----------|
| **Vertical Time Ruler** (left of graph) | Y-axis = time | Scroll position synced with playback |
| **Bottom Timeline** (Gantt) | X-axis = time | Play/pause, step slider, step counter |

#### Playback Behavior

When user clicks "Play" or scrubs the bottom timeline:
1. `currentStep` updates in app context
2. Graph viewport scrolls vertically to keep current step visible
3. Nodes before `currentStep` are fully visible
4. Nodes after `currentStep` are dimmed or hidden
5. Bottom timeline indicator and vertical time ruler stay synced

#### Visual Consistency

- Bottom timeline shows **compressed overview** (all steps in horizontal space)
- Vertical time axis shows **detailed view** (proportional to actual time elapsed)
- Both use the same color coding for activity types

#### Layout Suggestion

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header: Session info, View toggle, Metrics button                  │
├────────┬────────────────────────────────────────────────────────────┤
│ Time   │                                                            │
│ Axis   │              Main Graph Canvas                             │
│        │     (Vertical flow, grows downward with time)              │
│ 0.0s   │                                                            │
│ 1.0s   │    [User Input]                                            │
│ 2.0s   │         │                                                  │
│ 3.0s   │    [Reasoning]                                             │
│ 4.0s   │         │                                                  │
│  ...   │    [tool:read]                                             │
│        │         │                                                  │
├────────┴────────────────────────────────────────────────────────────┤
│  Bottom Timeline: [◀][▶]  ═══════●═══════════════  Step 15/120      │
│  Gantt tracks:    User ████░░░░░░░░░░░░░░░░░░░░░░                   │
│                   Agent ░░░████████░░░░████████░░░                   │
│                   Tools ░░░░░░░░░░██░░░░░░░░░░██░                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 6.8 Node Visual Design

#### Node Types and Styles

| Node Type | Shape | Color | Icon | Content Preview |
|-----------|-------|-------|------|-----------------|
| User Input | Rounded rect | Blue (#3B82F6) | 👤 | First 100 chars of prompt |
| Agent Reasoning | Rounded rect | Purple (#8B5CF6) | 🧠 | First 100 chars of text |
| tool:read | Pill | Emerald (#10B981) | 📖 | File path |
| tool:write | Pill | Emerald (#10B981) | ✏️ | File path |
| tool:edit | Pill | Emerald (#10B981) | 🔧 | File path |
| tool:bash | Pill | Orange (#F97316) | ⚡ | Command preview |
| tool:glob | Pill | Teal (#14B8A6) | 🔍 | Pattern |
| tool:grep | Pill | Teal (#14B8A6) | 🔎 | Search pattern |
| tool:task | Pill | Pink (#EC4899) | 🚀 | Sub-agent type |
| Success | Small circle | Green (#22C55E) | ✓ | — |
| Failure | Small circle | Red (#EF4444) | ✗ | Error preview |
| System Notice | Rounded rect (dashed) | Slate (#64748B) | ⚙️ | Notice type |

#### Node Size

- **Full nodes** (User, Reasoning): ~200px wide, height varies with content
- **Tool nodes**: ~150px wide, fixed height
- **Result nodes**: ~40px diameter circle

---

### 6.9 Metrics Dashboard (Sidebar)

Collapsible right sidebar showing real-time metrics:

```
┌─────────────────────────┐
│ 📊 Session Metrics      │
├─────────────────────────┤
│ Duration: 2m 34s        │
│ Tokens: 45,230          │
│ Tool calls: 47          │
│ Success rate: 91%       │
├─────────────────────────┤
│ 📈 Activity Breakdown   │
│ ████████ Read (23)      │
│ ██████ Edit (15)        │
│ ████ Bash (9)           │
│ ██ Task (3)             │
├─────────────────────────┤
│ ⚠️ Detected Patterns    │
│ • Edit→Bash loop (x3)   │
│ • Long wait at step 45  │
├─────────────────────────┤
│ 🤖 Sub-agents           │
│ • Explore: 12s, 8k tok  │
│ • Plan: 25s, 15k tok    │
└─────────────────────────┘
```

---

### 6.10 Enhanced Chat Log (Right Panel)

Existing chat log enhanced with:

| Enhancement | Description |
|-------------|-------------|
| Activity badges | Color-coded pill showing node type |
| Duration annotations | "↳ +1.2s" between messages |
| Loop highlighting | Yellow background for messages in detected loops |
| Sub-agent collapsing | Expandable sections for sub-agent conversations |
| Click-to-focus | Clicking a message scrolls graph to that node |

---

## Part 7: Implementation Phases (Revised)

### Phase 1: Parser Foundation (Priority: High)

**Goal**: Parse Claude Code logs into workflow nodes

**Files to create/modify:**
- `src/lib/parsers/claude-code-parser.ts` - New parser
- `src/lib/models/types.ts` - Add WorkflowNodeType, workflow node types
- `src/lib/services/parser-service.ts` - Register parser

**Deliverables:**
1. Parse main session + sub-agent files (auto-discover `agent-*.jsonl`)
2. Merge chunked LLM responses by `requestId` / `message.id`
3. Decompose "user" type into: `user_input`, `tool_result`, `system_notice`
4. Generate workflow nodes:
   - Agent Reasoning nodes (thinking + text merged)
   - Tool Call nodes (one per `tool_use`)
   - Tool Result nodes (success/failure)
5. Establish parent-child relationships using `parentUuid`
6. Extract sub-agent metadata (prompt, tokens, duration)

### Phase 2: Workflow Graph Builder (Priority: High)

**Goal**: Build DAG structure with fork/join support

**Files to create/modify:**
- `src/lib/services/workflow-graph-builder.ts` - New service (separate from existing graph-builder)
- `src/lib/models/types.ts` - Add WorkflowNode, WorkflowEdge types

**Deliverables:**
1. Build DAG from parsed workflow nodes
2. Handle fork pattern (parallel tool calls from one reasoning node)
3. Handle join pattern (results converge before next reasoning)
4. Track sub-agent lanes (parallel execution)
5. Calculate edge durations (timestamp differences)
6. Assign lane IDs (main agent vs sub-agents)

### Phase 3: Agent Activity View - Core (Priority: High)

**Goal**: Implement View A visualization (default, granular workflow)

**Files to create/modify:**
- `src/components/workflow/WorkflowView.tsx` - Main component
- `src/components/workflow/WorkflowNode.tsx` - Node components (User, Reasoning, Tool, Result)
- `src/components/workflow/WorkflowEdge.tsx` - Duration-colored edges
- `src/components/workflow/TimeAxis.tsx` - Vertical timestamp ruler
- `src/utils/workflow-layout.ts` - DAG layout algorithm

**Deliverables:**
1. Vertical DAG layout (grows top-to-bottom with time)
2. Node components with type-specific styling
3. Fork/join edge rendering
4. Vertical time axis (left side)
5. Duration-based edge coloring (green → red)
6. Node content preview (file paths, commands, prompts)

### Phase 4: Sub-Agent Lanes (Priority: Medium)

**Goal**: Visualize sub-agent execution in parallel lanes

**Files to modify:**
- `src/components/workflow/WorkflowView.tsx`
- `src/utils/workflow-layout.ts`

**Deliverables:**
1. Lane separation (main agent left, sub-agents right)
2. Lane headers with sub-agent metadata (type, tokens, duration)
3. Cross-lane edges (`tool:task` → sub-agent start, sub-agent end → `task_result`)
4. Lane collapse/expand functionality

### Phase 5: Timeline Integration (Priority: Medium)

**Goal**: Sync vertical time axis with bottom timeline controls

**Files to modify:**
- `src/components/workflow/TimeAxis.tsx`
- `src/components/graph/TimelineControls.tsx`
- `src/context/app-context.tsx`

**Deliverables:**
1. Dual-axis coordination (vertical + horizontal)
2. Playback sync (scroll to current step)
3. Click-to-jump on time axis
4. Dim/hide nodes after current step

### Phase 6: Metrics Dashboard (Priority: Medium)

**Goal**: Real-time session metrics sidebar

**Files to create:**
- `src/components/metrics/MetricsDashboard.tsx`
- `src/lib/services/process-metrics-service.ts`
- `src/app/api/graph/[id]/process-metrics/route.ts`

**Deliverables:**
1. Summary cards (duration, tokens, tool calls, success rate)
2. Activity breakdown bar chart
3. Detected patterns list (loops, long waits)
4. Sub-agent summary

### Phase 7: Process View (View B) — DEFERRED

**Goal**: Summarized process visualization (click to access)

**Status**: Postponed until activity taxonomy is finalized

**Prerequisites:**
- Final activity labeling scheme
- Definition of "process" boundaries
- Aggregation rules

### Phase 8: Advanced Analytics — DEFERRED

**Files to create (future):**
- `src/lib/services/variant-analyzer.ts`
- `src/components/metrics/VariantExplorer.tsx`

**Deliverables (future):**
1. Process variant extraction
2. Variant comparison view
3. Anomaly detection refinement
4. Token efficiency analysis

---

## Part 8: API Changes Summary

### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/graph/{id}/process-metrics` | GET | Get process mining metrics |
| `/api/graph/{id}/variants` | GET | Get process variants |
| `/api/graph/{id}/event-log` | GET | Export event log (CSV/JSON) |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `/api/upload` | Accept folder path for multi-file sessions |
| `/api/graph/{id}` | Add `mode` query param (`topology`/`process_flow`) |
| `/api/frameworks` | Add `claudecode` framework |

---

## Part 9: Testing Strategy

### Unit Tests

1. **Parser tests**: Verify correct activity classification for all message types
2. **Metrics tests**: Verify frequency/duration calculations
3. **Loop detection tests**: Test edge cases (nested loops, cross-agent loops)

### Integration Tests

1. **Full pipeline test**: Upload → Parse → Build Graph → Get Metrics
2. **Multi-file test**: Session with 3+ sub-agents
3. **Large file test**: Session with 500+ messages

### Sample Data

Use the provided `claude_code_chatlog_example/` folder as the primary test case:
- Main session: `ab51623b-c26d-45f5-b98e-f9d0cfa17018.jsonl`
- Sub-agents: `agent-*.jsonl` files

---

## Part 10: Success Criteria (Revised)

### Must-Have (Phase 1-3)

- [ ] Parse Claude Code chat logs (main + sub-agents)
- [ ] Decompose "user" type correctly (user_input, tool_result, system_notice)
- [ ] Merge LLM response chunks by requestId/message.id
- [ ] Generate workflow nodes (Reasoning, Tool Call, Tool Result)
- [ ] Build DAG with fork/join for parallel tool calls
- [ ] Display Agent Activity View (View A, default) with vertical timeline

### Should-Have (Phase 4-6)

- [ ] Sub-agent parallel lanes visualization
- [ ] Duration-colored edges (green → red scale)
- [ ] Vertical time axis synced with bottom timeline
- [ ] Metrics dashboard sidebar
- [ ] Click-to-navigate between chat log and graph

### Nice-to-Have (Phase 7-8) — DEFERRED

- [ ] Process View (View B) with aggregated processes (click to access)
- [ ] Process variant extraction
- [ ] Anomaly detection (loops, stagnation)
- [ ] CSV/JSON event log export
- [ ] Session comparison mode

---

## Appendix A: Activity Color Palette

| Category | Activities | Color |
|----------|-----------|-------|
| User | user:* | Blue (#3B82F6) |
| Reasoning | agent:think, agent:plan | Purple (#8B5CF6) |
| Explanation | agent:explain | Indigo (#6366F1) |
| File Tools | tool:read, tool:write, tool:edit | Emerald (#10B981) |
| Search Tools | tool:glob, tool:grep | Teal (#14B8A6) |
| Execution | tool:bash | Orange (#F97316) |
| Orchestration | tool:task | Pink (#EC4899) |
| Meta | tool:todo, tool:ask_user | Amber (#F59E0B) |
| System | system:* | Slate (#64748B) |
| Success | result:success | Green (#22C55E) |
| Failure | result:failure | Red (#EF4444) |

---

## Appendix B: Example Event Log Output

```csv
case_id,event_id,activity,timestamp,resource,tool_name,duration_ms,tokens,is_sidechain
nodejs_refactor,uuid-001,user:provide_task,2025-12-10T22:19:50Z,user,,,0,false
nodejs_refactor,uuid-002,agent:think,2025-12-10T22:19:51Z,assistant,,1500,2340,false
nodejs_refactor,uuid-003,tool:glob,2025-12-10T22:19:53Z,assistant,Glob,200,50,false
nodejs_refactor,uuid-004,result:success,2025-12-10T22:19:53Z,assistant,,0,100,false
nodejs_refactor,uuid-005,tool:read,2025-12-10T22:19:54Z,assistant,Read,500,200,false
nodejs_refactor,uuid-006,result:success,2025-12-10T22:19:54Z,assistant,,0,3000,false
nodejs_refactor,uuid-007,agent:explain,2025-12-10T22:19:56Z,assistant,,800,500,false
nodejs_refactor,uuid-008,tool:task,2025-12-10T22:19:58Z,assistant,Task,,100,false
nodejs_refactor,uuid-009,agent:think,2025-12-10T22:19:59Z,agent-80f146b4,,1200,1800,true
...
```

---

## Appendix C: Transition Matrix Example

```
                → user  → think → read  → edit  → bash  → task
From user       |  0.0  |  0.8   | 0.1   | 0.0   | 0.0   | 0.1
From think      |  0.1  |  0.0   | 0.5   | 0.2   | 0.1   | 0.1
From read       |  0.05 |  0.3   | 0.2   | 0.35  | 0.05  | 0.05
From edit       |  0.1  |  0.1   | 0.2   | 0.1   | 0.5   | 0.0
From bash       |  0.3  |  0.2   | 0.1   | 0.3   | 0.1   | 0.0
From task       |  0.4  |  0.3   | 0.1   | 0.1   | 0.1   | 0.0
```

This matrix reveals patterns like:
- After `edit`, 50% probability of `bash` (testing changes)
- After `bash`, 30% probability back to `edit` (debugging loop indicator)
- After `user`, 80% probability of `think` (agent starts reasoning)

---

## Revision History

| Date | Changes |
|------|---------|
| 2025-12-11 | Initial document |
| 2025-12-11 | **Major revision**: Shifted from agent-topology to sequential workflow focus. Added: (1) Two-view architecture (View A = Agent Activity, View B = Process), (2) Fork/join DAG structure, (3) Sub-agent parallel lanes, (4) Vertical time axis design, (5) Duration-colored edges, (6) "User" type decomposition. View A is default; View B deferred pending taxonomy. |

---

*Document created: 2025-12-11*
*Last updated: 2025-12-11*
*Author: CommuGraph Team*
