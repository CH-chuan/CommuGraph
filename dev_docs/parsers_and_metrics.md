# Parsers and Metrics Reference

This document summarizes the parsing methods and metrics calculations for both supported frameworks: **AutoGen** and **Claude Code**.

---

## 1. Parsing Methods

### 1.1 AutoGen Parser

**File**: `src/lib/parsers/autogen-parser.ts`

**Supported Formats**:
- **JSON Array**: A single JSON array containing log entries
- **JSONL**: One JSON object per line

**Parsing Flow**:
1. Detect format (array vs JSONL) by checking first character (`[` = array)
2. Parse each entry into a `Message` object
3. Skip empty messages

**Field Extraction**:

| Field | Source (priority order) |
|-------|------------------------|
| `sender` | `sender` → `name` → `from` → `'unknown'` |
| `receiver` | `recipient` → `to` (null if `'all'`) |
| `content` | `message.content` → `message.text` → `content` → `text` |
| `timestamp` | `timestamp` → `time` → `created_at` → `date` → inferred from step |

**Message Type Inference**:

```
1. Explicit type field → use if matches MessageType enum
2. role === 'system' → SYSTEM
3. function_call present → ACTION
4. Content contains delegation keywords → DELEGATION
   (please, can you, could you, implement, create, build)
5. Content contains thought keywords → THOUGHT
   (thinking, analyzing, considering, let me think)
6. Content contains action keywords → ACTION
   (executing, running, calling, function_call)
7. Default → RESPONSE
```

**Timestamp Handling**:
- Unix timestamp (seconds or milliseconds) → ISO string
- String timestamp → normalize and parse
- No timestamp → generate from base time + step_index

---

### 1.2 Claude Code Parser

**File**: `src/lib/parsers/claude-code-parser.ts`

**Supported Format**: JSONL (Claude Code log format)

**Key Concepts**:
- **Multi-file sessions**: Main session file + separate sub-agent files
- **Chunked responses**: LLM responses split across multiple records (thinking, text, tool_use)
- **Request grouping**: Records with same `requestId` belong to one LLM response

**Parsing Flow**:
1. Parse JSONL into raw records
2. Categorize records by type (`assistant`, `user`, `system`)
3. Group assistant records by `requestId`
4. Merge chunked assistant records into unified responses
5. Convert all records to `ClaudeCodeMessage` objects
6. Extract sub-agent metadata from tool results

**Record Types**:

| Type | Description |
|------|-------------|
| `user` | User input, tool results, system notices |
| `assistant` | LLM responses (thinking, text, tool calls) |
| `system` | System events, context compaction |
| `file-history-snapshot` | File state snapshots (skipped) |
| `queue-operation` | Internal queue ops (skipped) |

**Assistant Record Merging** (by `requestId`):

```typescript
MergedLLMResponse {
  thinking: string      // Combined from all thinking chunks
  text: string          // Combined from all text chunks
  toolCalls: []         // All tool_use objects
  inputTokens: number   // Summed from all chunks
  outputTokens: number  // Summed from all chunks
}
```

**Workflow Node Type Classification**:

| Raw Record Type | Workflow Node Type |
|-----------------|-------------------|
| User message (string content) | `USER_INPUT` |
| User message (tool_result array) | `TOOL_RESULT` / `RESULT_SUCCESS` / `RESULT_FAILURE` |
| User message (meta/internal) | `SYSTEM_NOTICE` |
| Assistant thinking/text | `AGENT_REASONING` |
| Assistant tool_use | `TOOL_CALL` |
| System record | `SYSTEM_NOTICE` |

**User Message Sub-classification**:

```
1. Array content with tool_result → TOOL_RESULT
2. isMeta === true → SYSTEM_NOTICE
3. Content contains <local-command-*> → SYSTEM_NOTICE
4. Content contains <bash-notification> → SYSTEM_NOTICE
5. Content contains <command-name> → SYSTEM_NOTICE
6. Default → USER_INPUT
```

**Tool Result Status Detection**:
- `failure`: toolUseResult.status === 'failed' OR stderr present OR is_error flag
- `success`: all other tool results

**Sub-Agent Extraction**:
- Extracted from tool results with `agentId` in `toolUseResult`
- Keyed by `tool_use_id` for matching with Task tool calls
- Captures: prompt, duration, token count, tool use count, status

---

## 2. Metrics Calculations

### 2.1 Communication Graph Metrics (Both Frameworks)

**File**: `src/lib/services/graph-builder.ts` + `src/lib/graph/digraph.ts`

**API Endpoint**: `GET /api/graph/[id]/metrics`

**Basic Metrics**:

| Metric | Formula | Description |
|--------|---------|-------------|
| `node_count` | `graph.numberOfNodes()` | Number of agents in conversation |
| `edge_count` | `graph.numberOfEdges()` | Number of directed communication channels |
| `density` | `edges / (nodes * (nodes - 1))` | Graph density (0-1 for directed graph) |

**Centrality Metrics**:

| Metric | Formula | Description |
|--------|---------|-------------|
| `degree_centrality` | `degree(n) / (2 * (N - 1))` | Overall connectivity of each node |
| `in_degree_centrality` | `in_degree(n) / (N - 1)` | How much each node receives messages |
| `out_degree_centrality` | `out_degree(n) / (N - 1)` | How much each node sends messages |

Where:
- `N` = total number of nodes
- `degree(n)` = in_degree + out_degree for node n

**Per-Node Tracking**:

| Field | Description |
|-------|-------------|
| `message_count` | Total messages sent by node |
| `messages_sent` | Outgoing message count |
| `messages_received` | Incoming message count |
| `first_appearance` | Timestamp of first activity |
| `last_activity` | Timestamp of last activity |

**Edge Data**:
- `weight`: Number of interactions on this edge
- `interactions[]`: List of temporal interactions with step_index, timestamp, intent, content

---

### 2.2 Workflow Graph Metrics (Claude Code Only)

**File**: `src/lib/services/workflow-graph-builder.ts`

**Session-Level Metrics**:

| Metric | Description |
|--------|-------------|
| `totalSteps` | Total number of workflow nodes |
| `totalDurationMs` | Time from first to last message |
| `totalTokens` | Sum of input + output tokens |
| `totalToolCalls` | Count of TOOL_CALL nodes |
| `toolSuccessRate` | `success_count / (success_count + failure_count)` |

**Duration Classification** (per edge):

| Class | Threshold | Typical Use |
|-------|-----------|-------------|
| `FAST` | < 500ms | Quick operations (reads, small edits) |
| `MEDIUM` | 500ms - 2s | Normal tool execution |
| `SLOW` | 2s - 5s | Complex operations |
| `VERY_SLOW` | > 5s | Long-running tasks, sub-agents |

**Sub-Agent Metrics** (per lane):

| Metric | Description |
|--------|-------------|
| `totalDurationMs` | Total execution time of sub-agent |
| `totalTokens` | Tokens consumed by sub-agent |
| `totalToolUseCount` | Number of tools called within sub-agent |
| `status` | `'completed'` or `'failed'` |

**Node-Level Metrics**:

| Field | Node Types | Description |
|-------|------------|-------------|
| `inputTokens` | AGENT_REASONING | Input tokens for LLM call |
| `outputTokens` | AGENT_REASONING | Output tokens from LLM |
| `durationMs` | TOOL_RESULT | Execution time from toolUseResult |

**Parallel Execution Tracking**:

| Field | Description |
|-------|-------------|
| `parallelGroupId` | requestId grouping parallel tool calls |
| `parallelIndex` | Position within parallel group (0-based) |
| `parallelCount` | Total tools in parallel group |

---

## 3. Intent Labels

Both parsers classify message intents for edge coloring and filtering:

| Intent | Description | AutoGen Mapping | Claude Code Mapping |
|--------|-------------|-----------------|---------------------|
| `DELEGATION` | Task assignment | DELEGATION type | USER_INPUT |
| `INFORMATION_REQUEST` | Asking for data | - | TOOL_CALL |
| `INFORMATION_RESPONSE` | Providing data | RESPONSE, OBSERVATION | TOOL_RESULT, RESULT_* |
| `COORDINATION` | Meta-communication | ACTION type | AGENT_REASONING |
| `FEEDBACK` | Evaluation/status | - | SYSTEM_NOTICE |
| `UNKNOWN` | Unclassified | THOUGHT, SYSTEM | Default |

---

## 4. API Response Structures

### MetricsResponse (Communication Graph)

```typescript
interface MetricsResponse {
  node_count: number;
  edge_count: number;
  density: number;
  centrality?: Record<string, number>;      // degree centrality
  in_degree_centrality?: Record<string, number>;
  out_degree_centrality?: Record<string, number>;
}
```

### WorkflowGraphSnapshot (Claude Code)

```typescript
interface WorkflowGraphSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  lanes: WorkflowLane[];

  sessionId: string;
  currentStep: number | null;
  totalSteps: number;

  startTime: string;
  endTime: string;
  totalDurationMs: number;

  totalTokens: number;
  totalToolCalls: number;
  toolSuccessRate: number;
}
```
