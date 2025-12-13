# Claude Code Graph Nodes and Edges

This document describes how Claude Code chat logs are transformed into graph nodes and edges by the `ClaudeCodeParser`.

## Overview

The Claude Code parser (`src/lib/parsers/claude-code-parser.ts`) converts JSONL chat logs into `Message` objects that are then used to build a communication graph. Due to the nature of Claude Code logs (transcript-style rather than explicit message passing), the current implementation creates **nodes only** with **no edges**.

---

## Records Excluded from Graph

The following record types are **skipped entirely** and do not appear in the graph:

| Record Type | Reason | Parser Location |
|-------------|--------|-----------------|
| `file-history-snapshot` | File backup tracking, not conversation data | Line 367-374 |
| `queue-operation` | Async queue operations (enqueue/dequeue), not conversation | Line 367-374 |
| Empty JSONL lines | No content to parse | Line 328 |
| `isMeta = true` records | System-injected context, not actual conversation | Line 643 |
| Records with empty content | No displayable message content | Line 643 |
| `assistant` records without `message` field | Malformed record | Line 462 |
| `user` records without `message` field | Malformed record | Line 608 |

---

## Records Included in Graph

### Node Types (Senders)

The graph creates nodes for these sender types:

| Sender | Source | Description |
|--------|--------|-------------|
| `assistant` | Main agent responses | Primary Claude Code agent |
| `user` | User input and tool results | Human user interactions |
| `system` | System events | Context compaction, notifications |
| `agent-{agentId}` | Sub-agent responses | Task-spawned sub-agents (e.g., `agent-80f146b4`) |

### Message Transformations

#### 1. Assistant Messages (`type: "assistant"`)

Assistant records are **merged by `requestId`** before conversion. A single LLM API response (which may span multiple JSONL lines) becomes:

| Content Type | Workflow Node Type | Message Type | Description |
|--------------|-------------------|--------------|-------------|
| `thinking` + `text` | `AGENT_REASONING` | `THOUGHT` | Combined reasoning and response text |
| `tool_use` | `TOOL_CALL` | `ACTION` | Each tool invocation becomes a separate message |

**Merging Logic**: Records sharing the same `requestId` are aggregated:
- All `thinking` content is concatenated
- All `text` content is concatenated
- Each `tool_use` becomes a separate `TOOL_CALL` message

#### 2. User Messages (`type: "user"`)

User messages are classified by content structure:

| Classification | Workflow Node Type | Message Type | Detection |
|----------------|-------------------|--------------|-----------|
| Direct user input | `USER_INPUT` | `DELEGATION` | Plain string content |
| Tool result (success) | `RESULT_SUCCESS` | `OBSERVATION` | Array with `tool_result` type |
| Tool result (failure) | `RESULT_FAILURE` | `OBSERVATION` | `is_error: true` or `stderr` present |
| System notice | `SYSTEM_NOTICE` | `SYSTEM` | Contains `<local-command-*>`, `<bash-notification>`, or `<command-name>` |

#### 3. System Messages (`type: "system"`)

| Workflow Node Type | Message Type | Description |
|-------------------|--------------|-------------|
| `SYSTEM_NOTICE` | `SYSTEM` | Context compaction, system events |

---

## Edge Behavior (Current Limitation)

### No Edges Created

All messages have **`receiver: null`**. This means:

- ✅ Nodes are created for each unique sender
- ❌ No edges connect nodes in the graph
- ❌ No communication flow is visualized

**Why?** Claude Code logs are a transcript format:
- Messages don't have explicit `recipient` or `to` fields
- The conversation is sequential, not a message-passing protocol
- Tool calls and results are linked via `tool_use_id`, not sender/receiver

### Potential Edge Inference (Not Yet Implemented)

To create meaningful edges, the parser could infer relationships:

| Inferred Edge | From | To | Condition |
|---------------|------|-----|-----------|
| User → Assistant | `user` | `assistant` | User input followed by assistant response |
| Assistant → User (tool) | `assistant` | `user` | `TOOL_CALL` followed by `TOOL_RESULT` |
| Main → Sub-agent | `assistant` | `agent-{id}` | `Task` tool call with matching `agentId` |
| Sub-agent → Main | `agent-{id}` | `assistant` | Sub-agent result returned to main agent |

---

## Message Fields for Claude Code

Each `ClaudeCodeMessage` includes standard fields plus Claude Code specific fields:

### Standard Message Fields

| Field | Type | Description |
|-------|------|-------------|
| `step_index` | number | Sequential order in conversation |
| `timestamp` | string | ISO timestamp |
| `sender` | string | Node identifier (`assistant`, `user`, `agent-{id}`, `system`) |
| `receiver` | string \| null | Always `null` for Claude Code |
| `message_type` | MessageType | `THOUGHT`, `ACTION`, `DELEGATION`, `OBSERVATION`, `SYSTEM` |
| `content` | string | Message text content |
| `metadata` | object | Additional context |

### Claude Code Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Unique record identifier |
| `parentUuid` | string \| null | Link to parent message |
| `logicalParentUuid` | string \| null | Used for context compaction continuity |
| `requestId` | string | Groups assistant response chunks |
| `messageApiId` | string | Claude API message ID (`msg_xxx`) |
| `workflowNodeType` | WorkflowNodeType | Fine-grained node classification |
| `isSidechain` | boolean | `true` for sub-agent messages |
| `agentId` | string | Sub-agent identifier (if applicable) |
| `toolName` | string | Tool name for `TOOL_CALL` messages |
| `toolInput` | object | Tool input parameters |
| `toolUseId` | string | Tool use ID for linking call → result |
| `inputTokens` | number | Input tokens used |
| `outputTokens` | number | Output tokens generated |
| `durationMs` | number | Execution duration (for tool results) |

---

## Workflow Node Types

The `workflowNodeType` field provides fine-grained classification:

| WorkflowNodeType | Description | Source |
|------------------|-------------|--------|
| `USER_INPUT` | Direct user prompt | User message (string content) |
| `AGENT_REASONING` | LLM thinking and response | Assistant `thinking` + `text` |
| `TOOL_CALL` | Tool invocation | Assistant `tool_use` |
| `TOOL_RESULT` | Generic tool result | User message with `tool_result` |
| `RESULT_SUCCESS` | Successful tool execution | Tool result without errors |
| `RESULT_FAILURE` | Failed tool execution | Tool result with `is_error` or `stderr` |
| `SYSTEM_NOTICE` | System event | System messages, meta messages |

---

## Sub-Agent Information

When a `Task` tool spawns a sub-agent, metadata is extracted from the tool result:

```typescript
interface SubAgentInfo {
  agentId: string;           // e.g., "80f146b4"
  toolUseId?: string;        // Links to the Task tool_use that spawned it
  subagentType?: string;     // e.g., "Explore", "Plan"
  prompt: string;            // Task prompt given to sub-agent
  totalDurationMs?: number;  // Execution time
  totalTokens?: number;      // Tokens consumed
  totalToolUseCount?: number;// Number of tool calls made
  status?: 'completed' | 'failed';
}
```

Sub-agents are keyed by `toolUseId` in the `subAgents` Map for linking with the originating `Task` tool call.

---

## Content Extraction

### Tool Call Descriptions

Tool calls are converted to human-readable descriptions:

| Tool | Format |
|------|--------|
| `Read` | `Read file: {file_path}` |
| `Write` | `Write file: {file_path}` |
| `Edit` | `Edit file: {file_path}` |
| `Bash` | `Bash: {command (first 100 chars)}` |
| `Glob` | `Glob: {pattern}` |
| `Grep` | `Grep: {pattern}` |
| `Task` | `Task ({subagent_type}): {description (first 100 chars)}` |
| `TodoWrite` | `TodoWrite: {todos JSON (first 100 chars)}` |
| Others | `{name}: {input JSON (first 100 chars)}` |

### User Content Extraction

For tool results with array content:
1. Extract `content` from each `tool_result` item
2. Append `stdout` from `toolUseResult` if present
3. Append `stderr` with `[stderr]` prefix if present
4. Append file content with `[file: {path}]` prefix if present
5. Truncate total content to 10,000 characters

---

## Example: Message Flow

Given this sequence in the JSONL:

```
1. user: "Create a hello.txt file"           → USER_INPUT node
2. assistant: [thinking] "I'll use Write"    → AGENT_REASONING node
3. assistant: [tool_use] Write(hello.txt)    → TOOL_CALL node
4. user: [tool_result] "File created"        → RESULT_SUCCESS node
5. assistant: [text] "Done!"                 → AGENT_REASONING node
```

**Resulting Graph:**
- Nodes: `user`, `assistant`
- Edges: None (receiver is always null)
- Messages: 5 messages with workflow context

To visualize the actual flow, the Workflow Graph Builder (`workflow-graph-builder.ts`) should be used instead, which creates a process-mining style graph based on `parentUuid` chains.
