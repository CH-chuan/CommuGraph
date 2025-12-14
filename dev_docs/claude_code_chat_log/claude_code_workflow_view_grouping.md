# Claude Code Workflow View: Node Grouping Logic

This document explains how CommuGraph groups raw JSONL records from Claude Code sessions into graph nodes for the **Workflow View** (DAG visualization).

## Overview

Claude Code sessions are stored as `.jsonl` files where each line represents a discrete event (user message, assistant chunk, tool result, etc.). A single LLM API response can span **multiple JSONL lines** sharing the same `requestId`. The parser and workflow builder transform these raw records into a DAG for visualization.

## Data Flow

```
Raw JSONL Lines (1 line = 1 event)
    ↓
ClaudeCodeParser.parseClaudeCodeLog()
    ├─ parseJsonl() → RawLogRecord[]
    ├─ processRecords() → group by requestId
    ├─ mergeAssistantRecords() → MergedLLMResponse[]
    └─ convertMergedResponse() → ClaudeCodeMessage[]
        ↓
WorkflowGraphBuilder.build()
    ├─ createLanes() → agent swimlanes
    ├─ createNodes() → WorkflowNode[]
    └─ createEdges() → DAG with fork/join
        ↓
WorkflowGraphSnapshot (API response)
```

## API Endpoint

```
GET /api/graph/[id]/workflow
```

---

## Stage 1: Parser-Level Grouping (requestId)

**Location**: `src/lib/parsers/claude-code-parser.ts`

### Problem

A single LLM response is split across multiple JSONL lines:

```jsonl
{"type":"assistant","requestId":"abc123","message":{"content":[{"type":"thinking","thinking":"..."}]}}
{"type":"assistant","requestId":"abc123","message":{"content":[{"type":"text","text":"Let me..."}]}}
{"type":"assistant","requestId":"abc123","message":{"content":[{"type":"tool_use","id":"tool_1",...}]}}
```

### Solution: Merge by requestId

The parser groups all records with the same `requestId` and merges them:

```typescript
// mergeAssistantRecords() aggregates:
interface MergedLLMResponse {
  requestId: string;
  thinking: string[];      // All thinking blocks concatenated
  text: string[];          // All text blocks concatenated
  toolCalls: ToolUse[];    // All tool_use blocks collected
  tokenUsage: TokenUsage;  // Aggregated across chunks
}
```

### Output Messages

From one merged response, the parser creates:

1. **AGENT_REASONING message** - Combined thinking + text content
2. **TOOL_CALL messages** - One per `tool_use` (separate from reasoning)

---

## Stage 2: User Message Classification

**Location**: `src/lib/parsers/claude-code-parser.ts`

Raw `user` type records are decomposed into specific types:

| Classified Type | Workflow Node Type | Detection Logic |
|-----------------|-------------------|-----------------|
| `USER_INPUT` | USER_INPUT | Direct user prompt (string content) |
| `TOOL_RESULT` | RESULT_SUCCESS/RESULT_FAILURE | Has `tool_result` content array |
| `SYSTEM_NOTICE` | SYSTEM | Matches patterns: `<local-command-*>`, `<bash-notification>` |

### Tool Result Classification

```typescript
// A tool_result becomes RESULT_FAILURE if:
// 1. is_error === true in content block
// 2. Content contains "stderr:" or similar error markers
// Otherwise: RESULT_SUCCESS
```

---

## Stage 3: Workflow Node Creation

**Location**: `src/lib/services/workflow-graph-builder.ts`

### Node Types

| WorkflowNodeType | Source | Description |
|------------------|--------|-------------|
| `USER_INPUT` | User prompt | User's direct input |
| `THOUGHT` | Merged thinking+text | Agent reasoning (no tool calls) |
| `ACTION` | tool_use block | Tool invocation |
| `OBSERVATION` | tool_result | Tool execution result |
| `SYSTEM` | System notice | Context compaction, notifications |

### Grouping Rules

1. **Thinking + Text → Single THOUGHT node**
   - Merged by `message.id`
   - Represents agent's reasoning before/without tool use

2. **Each tool_use → Separate ACTION node**
   - Not merged with reasoning
   - Links to subsequent OBSERVATION via `tool_use_id`

3. **Parallel tool calls → Fork pattern**
   - Multiple ACTION nodes from same response
   - All link back to same parent THOUGHT node

### Edge Creation

Edges represent the flow between nodes:

- `USER_INPUT → THOUGHT` - User prompt triggers agent reasoning
- `THOUGHT → ACTION` - Reasoning leads to tool call
- `ACTION → OBSERVATION` - Tool call produces result (linked by `tool_use_id`)
- `OBSERVATION → THOUGHT` - Result feeds back into reasoning
- Fork/join patterns for parallel tool calls

---

## Multi-File (Sub-Agent) Processing

**Location**: `src/lib/parsers/claude-code-parser.ts`

### File Discovery

```
session_dir/
├── abc12345-6789-...jsonl    # Main session (UUID format)
├── agent-xyz789.jsonl        # Sub-agent 1
└── agent-def456.jsonl        # Sub-agent 2
```

### Sub-Agent Metadata

Extracted from Task tool results and stored by `toolUseId`:

```typescript
interface SubAgentInfo {
  agentId: string;
  subagentType: string;     // e.g., "Explore", "claude-code-guide"
  prompt: string;
  duration?: number;
  tokenUsage?: TokenUsage;
  status: 'completed' | 'error';
}
```

### Lane Assignment

Each agent (main + sub-agents) gets its own swimlane in the workflow view.

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAW JSONL RECORDS                           │
├─────────────────────────────────────────────────────────────────┤
│ Line 1: {type:"user", content:"Find the bug"}                   │
│ Line 2: {type:"assistant", requestId:"r1", thinking:"..."}      │
│ Line 3: {type:"assistant", requestId:"r1", text:"Let me..."}    │
│ Line 4: {type:"assistant", requestId:"r1", tool_use:{Read...}}  │
│ Line 5: {type:"user", tool_result:{id:"t1", content:"..."}}     │
│ Line 6: {type:"assistant", requestId:"r2", text:"Found it!"}    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Group by requestId
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW GRAPH NODES                         │
├─────────────────────────────────────────────────────────────────┤
│ [USER_INPUT] ──→ [THOUGHT] ──→ [ACTION:Read] ──→ [OBSERVATION]  │
│       │              │                               │          │
│       │              └───────────────────────────────┘          │
│       │                           ↓                             │
│       │                   [THOUGHT: Found it!]                  │
│       │                           │                             │
│       └───────────────────────────┘                             │
│              (edges show conversation flow)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Grouping Keys Summary

| Stage | Grouping Key | What Gets Grouped |
|-------|--------------|-------------------|
| Parser | `requestId` | All assistant JSONL lines from one API call |
| Workflow | `message.id` | Thinking + text from same message |
| Tool Linking | `tool_use_id` | Tool call + result |

---

## Record Ordering

Workflow messages are ordered using **topological sort** via the parent-child UUID chain, not timestamps.

See **[record_ordering.md](./record_ordering.md)** for the full algorithm covering:
- Why timestamp sorting is insufficient
- The topological sort algorithm
- Handling siblings, orphans, and context compaction

---

## Key Files Reference

| File | Role |
|------|------|
| `src/lib/parsers/claude-code-parser.ts` | JSONL parsing, requestId grouping, sub-agent extraction, **topological sort** |
| `src/lib/models/types.ts` | Type definitions (WorkflowNodeType, MessageType) |
| `src/lib/services/workflow-graph-builder.ts` | DAG construction, fork/join patterns, lane generation |
| `src/app/api/graph/[id]/workflow/route.ts` | API endpoint returning WorkflowGraphSnapshot |
