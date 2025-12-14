# Claude Code Annotation View: Unit Grouping Logic

This document explains how CommuGraph groups raw JSONL records from Claude Code sessions into annotation units for the **Annotation View** (labeling interface).

## Overview

The Annotation View transforms parsed messages into **turn-based units** suitable for human labeling tasks. Unlike the Workflow View (which shows a DAG of individual actions), the Annotation View groups content into logical conversation turns.

## Data Flow

```
Raw JSONL Lines (1 line = 1 event)
    ↓
ClaudeCodeParser.parseClaudeCodeLog()
    └─ ClaudeCodeMessage[]
        ↓
AnnotationPreprocessor.generateAnnotationRecords()
    ├─ groupAssistantTurns() → assistant_turn units
    ├─ extractUserTurns() → user_turn units
    ├─ extractSystemTurns() → system_turn units
    └─ linkToolResults() → populate tool_summary
        ↓
AnnotationRecord[] (API response)
```

## API Endpoint

```
GET /api/graph/[id]/annotations
```

---

## Unit Types

### 1. assistant_turn

Groups all content from one LLM response into a single annotation unit.

**Grouping Key**: `(requestId, messageId)`

```typescript
interface AssistantTurn {
  unit_type: 'assistant_turn';
  unit_id: string;
  timestamp: string;

  // Merged content from all JSONL lines with same requestId
  thinking: string | null;        // All thinking blocks concatenated
  text_response: string | null;   // All text blocks concatenated

  // Tool calls with their results
  tool_summary: ToolSummary;      // tool_use_id → {call, result}

  // Metadata
  token_usage: TokenUsage | null;
  model: string | null;
}
```

**What gets merged:**
- All `thinking` content blocks from the response
- All `text` content blocks from the response
- All `tool_use` blocks collected into `tool_summary`
- Corresponding `tool_result` records linked by `tool_use_id`

### 2. user_turn

Direct user prompts only (excludes tool results and system messages).

**Filtering criteria:**
- Content is a string (not structured tool_result)
- Minimum 5 character length
- Not a slash command or meta message

```typescript
interface UserTurn {
  unit_type: 'user_turn';
  unit_id: string;
  timestamp: string;
  content: string;  // The user's prompt text
}
```

### 3. system_turn

Context compaction events and system notifications.

```typescript
interface SystemTurn {
  unit_type: 'system_turn';
  unit_id: string;
  timestamp: string;
  event_type: 'context_compaction' | 'notification';
  summary: string | null;  // Optional compact_summary content
}
```

**Grouping behavior:**
- `compact_boundary` system record merged with optional `compact_summary`
- Other system notices (bash notifications, etc.) as separate units

---

## Tool Result Linking

**Location**: `src/lib/annotation/preprocessor.ts`

Tool results are linked back to their originating tool calls:

### Step 1: Build Result Index

```typescript
// Index: tool_use_id → ToolResultInfo[]
const resultIndex = new Map<string, ToolResultInfo[]>();

// Each tool_result record is indexed by its tool_use_id
for (const msg of messages) {
  if (msg.workflowNodeType === 'RESULT_SUCCESS' || 'RESULT_FAILURE') {
    resultIndex.get(msg.toolUseId).push({
      success: msg.workflowNodeType === 'RESULT_SUCCESS',
      content: msg.content,
      timestamp: msg.timestamp
    });
  }
}
```

### Step 2: Populate tool_summary

```typescript
// Each assistant_turn gets its tool_summary populated
assistantTurn.tool_summary = {
  "toolu_abc123": {
    call: {
      name: "Read",
      input: { file_path: "/src/main.ts" }
    },
    results: [{
      success: true,
      content: "file contents..."
    }]
  },
  "toolu_def456": {
    call: {
      name: "Bash",
      input: { command: "npm test" }
    },
    results: [{
      success: false,
      content: "Error: test failed"
    }]
  }
}
```

---

## Main Chain Filtering

**Important**: Annotation units only include messages from the **main conversation chain**.

Sub-agent messages are filtered out:
```typescript
// Filter: isSidechain === false
const mainChainMessages = messages.filter(m => !m.isSidechain);
```

Sub-agent activity is visible through:
- Task tool calls in `tool_summary`
- Task tool results containing sub-agent output

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
                    Group by (requestId, messageId)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ANNOTATION UNITS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Unit 1: user_turn                                        │   │
│  │   content: "Find the bug"                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Unit 2: assistant_turn                                   │   │
│  │   thinking: "I should look at the code..."               │   │
│  │   text_response: "Let me check the file."                │   │
│  │   tool_summary:                                          │   │
│  │     Read → { success: true, content: "..." }             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Unit 3: assistant_turn                                   │   │
│  │   thinking: null                                         │   │
│  │   text_response: "Found it! The bug is..."               │   │
│  │   tool_summary: {}                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Comparison: Workflow View vs Annotation View

| Aspect | Workflow View | Annotation View |
|--------|---------------|-----------------|
| Granularity | Individual nodes (THOUGHT, ACTION, OBSERVATION) | Conversation turns |
| Tool handling | Separate ACTION and OBSERVATION nodes | Merged into `tool_summary` |
| Structure | DAG with edges | Flat list of units |
| Sub-agents | Separate lanes | Filtered out (main chain only) |
| Use case | Process visualization | Human labeling |

---

## Grouping Keys Summary

| Element | Grouping Key | Result |
|---------|--------------|--------|
| Assistant content | `(requestId, messageId)` | One assistant_turn per LLM response |
| Tool results | `tool_use_id` | Linked into tool_summary |
| Context compaction | `compact_boundary` + `compact_summary` | One system_turn |

---

## Record Ordering

Annotation units are ordered using **topological sort** via the parent-child UUID chain, not timestamps.

See **[record_ordering.md](./record_ordering.md)** for the full algorithm covering:
- Why timestamp sorting is insufficient
- The topological sort algorithm
- Handling siblings, orphans, and context compaction

---

## Key Files Reference

| File | Role |
|------|------|
| `src/lib/annotation/preprocessor.ts` | Turn grouping, tool linking, unit generation, **topological sort** |
| `src/lib/annotation/types.ts` | AnnotationRecord, AssistantTurn, UserTurn types |
| `src/lib/parsers/claude-code-parser.ts` | Initial parsing (provides ClaudeCodeMessage[]) |
| `src/app/api/graph/[id]/annotations/route.ts` | API endpoint returning AnnotationRecord[] |
