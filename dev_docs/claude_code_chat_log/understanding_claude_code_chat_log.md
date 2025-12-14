# Claude Code Chat Log Structure Documentation

## Overview

- Each session of Claude Code is identified by a `sessionId` (UUID format)
- Each session has one main agent, whose logs are stored in a file named `{sessionId}.jsonl`
- Sub-agents (spawned via Task tool) are stored in separate files: `agent-{agentId}.jsonl`
- Sub-agents have `isSidechain = true` for all their chat log entries
- Each line in a `.jsonl` file represents one "chat" record
- Claude Code is async, so timestamp order may not match logical conversation order
- `uuid` is the primary key for each chat record

## Message Linking (parentUuid and logicalParentUuid)

The order and sequence of chats are connected via `uuid` and `parentUuid`:

### Cases when `parentUuid` is null:
1. **Root message** - The first message in a session or sub-agent
2. **After context compaction** - When context limit is reached, creates a new "virtual" conversation start
   - Uses `logicalParentUuid` to track its actual last message for continuity

### Example of context compaction:
```json
{
  "parentUuid": null,
  "logicalParentUuid": "93afe794-a075-4256-b517-21129d55f835",
  "type": "system",
  "subtype": "compact_boundary",
  "content": "Conversation compacted",
  "compactMetadata": {"trigger": "auto", "preTokens": 156953}
}
```

### Record Ordering Algorithm

CommuGraph uses **topological sort** via the parent-child UUID chain (not timestamps) to order records.

See **[record_ordering.md](./record_ordering.md)** for the full algorithm covering:
- Why timestamp sorting is insufficient
- Handling siblings (same parent) via timestamp tiebreaker
- Handling orphans (parent not in set)
- Context compaction continuity via `logicalParentUuid`

---

## Line-Level Types (`type` field at root level)

Each JSONL line has a `type` field indicating its category:

| Type | Count (sample) | Description |
|------|-------|-------------|
| `user` | 268 | User messages, tool results, and system-injected content |
| `assistant` | 438 | LLM responses (may be split into multiple lines by content type) |
| `file-history-snapshot` | 56 | File backup tracking for undo/redo functionality |
| `queue-operation` | 4 | Async message queue operations (enqueue/dequeue) |
| `system` | 1 | System-level events (e.g., context compaction) |

---

## Assistant Message Structure

### Key Identifying Fields

For assistant messages with `type: "assistant"`:

| Field | Description |
|-------|-------------|
| `requestId` | Groups multiple response chunks from the same API call (e.g., `req_011CVyo6UsvYWSZmXQU6RMQx`) |
| `message.id` | The Claude API message ID (e.g., `msg_01AyooYikXy4kNkDdMXR67aq`) |
| `message.model` | The model used (e.g., `claude-opus-4-5-20251101`, `claude-haiku-4-5-20251001`) |

### Important: Single LLM Response = Multiple Lines

One single LLM API response is split into multiple JSONL lines, each containing different parts of the response. They share the same `message.id` and `requestId`.

### Content Types in `message.content[]`

| Content Type | Description |
|--------------|-------------|
| `thinking` | Extended thinking/reasoning (when thinking mode enabled) |
| `text` | Regular text output to the user |
| `tool_use` | Tool invocation request with `name`, `id`, and `input` |

### Example: Same response, different content parts
```json
// Line 1: Thinking
{"requestId": "req_xxx", "message": {"id": "msg_yyy", "content": [{"type": "thinking", "thinking": "..."}]}}

// Line 2: Text
{"requestId": "req_xxx", "message": {"id": "msg_yyy", "content": [{"type": "text", "text": "..."}]}}

// Line 3: Tool use
{"requestId": "req_xxx", "message": {"id": "msg_yyy", "content": [{"type": "tool_use", "name": "Read", "id": "toolu_xxx", "input": {...}}]}}
```

### Stop Reasons (`message.stop_reason`)

| Value | Description |
|-------|-------------|
| `tool_use` | Stopped to execute a tool |
| `stop_sequence` | Stopped due to reaching a stop sequence |
| `null` | Streaming in progress (intermediate chunks) |

---

## User Role Messages

Messages with `type: "user"` contain various subtypes based on content format:

### 1. Direct User Input
Plain text message from the user:
```json
{
  "type": "user",
  "message": {"role": "user", "content": "Your prompt text here"},
  "thinkingMetadata": {"level": "high", "disabled": false, "triggers": []}
}
```

### 2. Slash Command Execution
Commands like `/clear`, `/rate-limit-options`:
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>"
  }
}
```

### 3. Local Command Output
Output from local command execution:
```json
{
  "type": "user",
  "message": {"role": "user", "content": "<local-command-stdout>Login successful</local-command-stdout>"}
}
```

### 4. Tool Results
Response to tool_use requests (content is an array):
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01Bq52j3mc4A2fEbfxMZTcDa",
      "type": "tool_result",
      "content": [{"type": "text", "text": "Tool output here"}]
    }]
  },
  "toolUseResult": {
    "status": "completed",
    "prompt": "Original task prompt",
    "agentId": "80f146b4",
    "content": [...],
    "totalDurationMs": 72723,
    "totalTokens": 56775,
    "totalToolUseCount": 32,
    "usage": {...}
  }
}
```

### 5. Meta Messages
System-injected context messages (not for LLM to respond to):
```json
{
  "type": "user",
  "isMeta": true,
  "message": {
    "role": "user",
    "content": "Caveat: The messages below were generated by the user while running local commands..."
  }
}
```

---

## Tool Names Found

All tools available for the assistant to use:

| Tool | Usage Count | Description |
|------|-------------|-------------|
| `Read` | 122 | Read file contents |
| `Write` | 52 | Write content to file |
| `Bash` | 41 | Execute shell commands |
| `Glob` | 13 | Pattern-based file search |
| `Edit` | 9 | Edit existing files |
| `TodoWrite` | 7 | Manage task list |
| `Task` | 4 | Spawn sub-agents |
| `BashOutput` | 2 | Read background bash output |
| `Grep` | 1 | Search file contents |
| `KillShell` | 1 | Terminate background shell |
| `ExitPlanMode` | 1 | Exit planning mode |
| `AskUserQuestion` | 1 | Ask user for input |

---

## Sub-agent Types (`subagent_type`)

When using the Task tool, different agent types can be spawned:

| Type | Count | Description |
|------|-------|-------------|
| `Explore` | 3 | Fast codebase exploration agent |
| `Plan` | 1 | Software architect for implementation planning |

Other possible types (from system prompt, not seen in sample):
- `general-purpose` - Multi-step autonomous tasks
- `statusline-setup` - Configure status line settings
- `claude-code-guide` - Answer questions about Claude Code

---

## Models Used

| Model | Count | Description |
|-------|-------|-------------|
| `claude-opus-4-5-20251101` | 328 | Main model (Opus) |
| `claude-haiku-4-5-20251001` | 109 | Faster model for sub-agents |
| `<synthetic>` | 1 | Internal/synthetic message |

---

## File History Snapshots

Tracks file changes for undo/redo:
```json
{
  "type": "file-history-snapshot",
  "messageId": "79d5ca74-36d0-4336-9c5a-3cee1a21b6e1",
  "snapshot": {
    "messageId": "79d5ca74-36d0-4336-9c5a-3cee1a21b6e1",
    "trackedFileBackups": {
      "/path/to/file.md": {
        "backupFileName": "d0121d27e7e3bd96@v1",
        "version": 1,
        "backupTime": "2025-12-10T22:36:17.753Z"
      }
    },
    "timestamp": "2025-12-10T22:28:33.041Z"
  },
  "isSnapshotUpdate": false
}
```

---

## Queue Operations

For async message handling:
```json
{
  "type": "queue-operation",
  "operation": "enqueue",  // or "dequeue"
  "timestamp": "2025-12-10T22:54:08.852Z",
  "sessionId": "ab51623b-c26d-45f5-b98e-f9d0cfa17018",
  "content": "/rate-limit-options"  // or bash-notification, etc.
}
```

### Bash Notifications in Queue
```json
{
  "type": "queue-operation",
  "operation": "enqueue",
  "content": "<bash-notification>\n<shell-id>79aef2</shell-id>\n<status>failed</status>\n<summary>Background command failed with exit code 137.</summary>\n</bash-notification>"
}
```

---

## System Messages

For system-level events like context compaction:
```json
{
  "type": "system",
  "subtype": "compact_boundary",
  "content": "Conversation compacted",
  "level": "info",
  "compactMetadata": {
    "trigger": "auto",
    "preTokens": 156953
  }
}
```

---

## Common Fields Across All Records

### For `type: "user"` records:
| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Unique identifier for this record |
| `parentUuid` | string/null | Link to parent message |
| `sessionId` | string | Session identifier |
| `timestamp` | string | ISO timestamp |
| `type` | string | Always "user" |
| `userType` | string | Always "external" |
| `isSidechain` | boolean | True for sub-agent conversations |
| `cwd` | string | Current working directory |
| `version` | string | Claude Code version (e.g., "2.0.64") |
| `gitBranch` | string | Current git branch |
| `message` | object | The actual message content |
| `isMeta` | boolean | True for system-injected context |
| `slug` | string | Session slug name |
| `thinkingMetadata` | object | Thinking mode settings |
| `toolUseResult` | object | For tool result messages |

### For `type: "assistant"` records:
| Field | Type | Description |
|-------|------|-------------|
| `uuid` | string | Unique identifier |
| `parentUuid` | string | Link to parent message |
| `requestId` | string | Groups chunks from same API call |
| `sessionId` | string | Session identifier |
| `timestamp` | string | ISO timestamp |
| `type` | string | Always "assistant" |
| `message` | object | Contains model, id, content, usage, etc. |

---

## Usage Statistics (`message.usage`)

Token usage tracking for cost estimation:
```json
{
  "input_tokens": 10,
  "cache_creation_input_tokens": 26284,
  "cache_read_input_tokens": 0,
  "cache_creation": {
    "ephemeral_5m_input_tokens": 26284,
    "ephemeral_1h_input_tokens": 0
  },
  "output_tokens": 3,
  "service_tier": "standard"
}
```

---

## Thinking Metadata

Controls extended thinking mode:
```json
{
  "thinkingMetadata": {
    "level": "high",    // thinking depth level
    "disabled": false,  // whether thinking is disabled
    "triggers": []      // what triggered thinking mode
  }
}
```

---

## Tool Result Structure (`toolUseResult`)

Extended metadata for tool execution results:
```json
{
  "toolUseResult": {
    "status": "completed",
    "prompt": "Original task prompt...",
    "agentId": "80f146b4",
    "content": [{"type": "text", "text": "..."}],
    "totalDurationMs": 72723,
    "totalTokens": 56775,
    "totalToolUseCount": 32,
    "usage": {...}
  }
}
```

For simpler tool results (Bash):
```json
{
  "toolUseResult": {
    "stdout": "command output",
    "stderr": "",
    "interrupted": false,
    "isImage": false
  }
}
```

For file reads:
```json
{
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/path/to/file",
      "content": "file content...",
      "numLines": 76,
      "startLine": 1,
      "totalLines": 76
    }
  }
}
```

---

## TodoWrite Input Structure

For task management:
```json
{
  "todos": [
    {
      "content": "Phase 1: Initialize project",
      "status": "completed",      // "pending", "in_progress", "completed"
      "activeForm": "Setting up project"
    }
  ]
}
```
