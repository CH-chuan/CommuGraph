# Claude Code Chat Logs — Single-Session Schema (JSONL)

This document is used for: **Understand and reconstruct one Claude Code session end-to-end** from the files under `claude_code_chatlog_example/`.

In this sample folder, **all `.jsonl` files belong to a single `sessionId`** (the main session plus any spawned sub-agents / sidechains).

---

## What files belong to one session?

Claude Code uses a **session-centric** log layout:

- **Main session log**: `{sessionId}.jsonl`
- **Sub-agent logs (sidechains)**: `agent-{agentId}.jsonl`

### Practical rule for this repository’s sample

For `claude_code_chatlog_example/`, load:

1. `ab51623b-c26d-45f5-b98e-f9d0cfa17018.jsonl` (main agent)
2. Every `agent-*.jsonl` in the folder (sub-agents)

All records across these files share:

- the same **`sessionId`**
- but *may* have different **`agentId`** (sidechains) and independent `uuid` chains.

---

## JSONL fundamentals (important constraints)

- **Format**: JSON Lines — **one JSON object per line**.
- **Append-only mindset**: treat logs as immutable event streams; build indices rather than relying on file order.
- **Async reality**: **timestamp order is not guaranteed** to match logical conversation order.

---

## Core identifiers and how they link

### Record identity: `uuid` and `parentUuid`

Many conversational records (mostly `type: "user"` and `type: "assistant"`) include:

- **`uuid: string`**: unique id for *this JSONL line* (one record/event)
- **`parentUuid: string | null`**: pointer to the previous record in a *logical chain*

Interpretation:

- A record with `parentUuid = X` is logically “after” record `uuid = X` (within the same chain).
- `parentUuid: null` starts a new chain root.

### Why `parentUuid` can be `null`

Common reasons:

- **True root**: first record of a file/sidechain thread
- **Context compaction boundary**: Claude Code can compact context and start a new root while retaining continuity via `logicalParentUuid` (see `system.compact_boundary`)

### Session grouping: `sessionId`

- **`sessionId: string`** is the **primary grouping key** across main + sub-agent files.
- Sidechains use the same `sessionId` as the main session.

### Sidechain markers: `isSidechain` and `agentId`

In `agent-*.jsonl` files, records typically have:

- **`isSidechain: true`**
- **`agentId: string`** (matches the filename’s `agent-{agentId}.jsonl`)

In the main file, records typically have `isSidechain: false` (or may omit it in other versions).

---

## Identifier glossary (IDs) and how to join them

Claude Code logs contain **multiple, unrelated ID namespaces**. Keeping these separate is the key to correctly reconstructing a session.

### 1) Conversation record IDs (`uuid` / `parentUuid`)

- **`uuid: string`** (UUID)
  - Present on most conversational records (`type: "user"`, `type: "assistant"`, `type: "system"`).
  - Identifies the **JSONL record/event**, not the API response and not a tool call.
- **`parentUuid: string | null`**
  - Points to another record’s `uuid`.
  - Defines the **primary conversation/thread graph edges**: `parentUuid → uuid`.
- **`logicalParentUuid: string`** (only on some system events)
  - Used to stitch across context-compaction boundaries (see `system.subtype = "compact_boundary"`).

**Join rule**:

- **Thread edge**: `records[parentUuid] -> records[uuid]`
- **Compaction continuity edge** (optional): `records[logicalParentUuid] -> records[compact_boundary.uuid]`

### 2) API request/response IDs (`requestId` + `message.id`)

These live on `type: "assistant"` records:

- **`requestId: string`** (e.g., `req_...`)
  - Correlates a single API request; in practice, multiple assistant JSONL records may share it.
  - Useful for grouping assistant chunks emitted “together”.
- **`message.id: string`** (e.g., `msg_...`)
  - The Anthropic message id (the “model message” identity).
  - Multiple assistant JSONL records can reference the same `message.id` (chunking/tool-use streaming).

**Join rule** (recommended grouping key for “one model turn”):

- Primary: `(requestId, message.id)`
- Fallback when `requestId` is absent: `(message.id)`

### 3) Tool call IDs (`tool_use.id`) and tool result references (`tool_result.tool_use_id`)

Tool calls and tool results use a separate ID namespace:

- **`tool_use.id: string`** (e.g., `toolu_...`)
  - Lives inside `assistant.message.content[]` where `type == "tool_use"`.
  - Identifies a **single tool invocation**.
- **`tool_result.tool_use_id: string`**
  - Lives inside `user.message.content[]` blocks where `type == "tool_result"`.
  - References the corresponding `tool_use.id`.

**Join rule** (critical):

- `assistant.message.content[i].id (tool_use)` == `user.message.content[j].tool_use_id (tool_result)`

**Cardinality**:

- One `tool_use.id` → zero or more tool results (errors/retries/partial results can exist).

### 4) “messageId” fields (name collision — treat as different concepts)

The string `"messageId"` appears in non-conversational records and is **not** the same as `message.id`.

#### `file-history-snapshot.messageId` and `file-history-snapshot.snapshot.messageId`

Observed shapes:

- Initial snapshot: `messageId == snapshot.messageId` (both look like a UUID)
- Update snapshot: `messageId` changes, but `snapshot.messageId` stays constant

**Interpretation (practical)**:

- Treat **`snapshot.messageId`** as the **anchor** (stable identifier of the snapshot “thread”).
- Treat **top-level `messageId`** as the **snapshot event id** (unique per snapshot record).

**Join hint**:

- In this sample, the initial snapshot’s `messageId` often equals a nearby conversational `uuid` (suggesting “snapshot taken at/for that message”), but do not hard-require that invariant across versions.

---

## Top-level record types (`type`)

Every JSONL line has a root-level **`type`**. In the sample session you will see:

- **`"user"`**: user prompts *and* tool results *and* various injected/meta payloads
- **`"assistant"`**: model outputs (text, thinking, tool calls), sometimes split across multiple records
- **`"system"`**: system-level events (notably context compaction boundaries)
- **`"file-history-snapshot"`**: file backup/snapshot tracking (undo/redo support)
- **`"queue-operation"`**: async queue events (enqueue/dequeue/remove notifications)

---

## Common envelope fields (conversational records)

Most `type: "user"` and `type: "assistant"` records share an “envelope” of metadata fields. Observed in the sample:

- **`uuid: string`**
- **`parentUuid: string | null`**
- **`sessionId: string`**
- **`timestamp: string`** (ISO 8601)
- **`cwd: string`**
- **`version: string`** (Claude Code version)
- **`gitBranch: string`** (optional; present in sample)
- **`slug: string`** (session slug; present in sample)
- **`userType: "external"`** (observed in sample)
- **`isSidechain: boolean`** (true for sub-agent logs)
- **`agentId: string`** (present when `isSidechain: true`)

Also observed (less frequent / context-dependent):

- **`thinkingMetadata`**: on some `type: "user"` records (user prompt settings)
  - `thinkingMetadata.level: "high" | "medium" | "low"`
  - `thinkingMetadata.disabled: boolean`
  - `thinkingMetadata.triggers: any[]`
- **`todos`**: on some `type: "user"` records (current todo list snapshot)
  - `todos[]: { content: string; status: string; activeForm?: string }`
- **`isMeta: boolean`**: marks system-injected “user” messages that should not be treated as user intent

Non-conversational record types (`file-history-snapshot`, `queue-operation`) may omit most of these.

---

## `assistant` records (model output chunks)

### Key idea: one model response can span multiple JSONL lines

Claude Code may split a single model response into multiple `assistant` records (e.g., a text chunk, then tool calls, etc.). Those related chunks usually share:

- **`requestId: string`** (API request correlation)
- **`message.id: string`** (API message id)

### Shape (typical)

```json
{
  "type": "assistant",
  "uuid": "...",
  "parentUuid": "...",
  "sessionId": "...",
  "timestamp": "...",
  "cwd": "...",
  "version": "...",

  "requestId": "req_...",
  "message": {
    "model": "claude-...",
    "id": "msg_...",
    "container": null,
    "type": "message",
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "...", "signature": "..." },
      { "type": "text", "text": "..." },
      { "type": "tool_use", "id": "toolu_...", "name": "Read|Write|Bash|Glob|Task|...", "input": { } }
    ],
    "stop_reason": "tool_use" | "stop_sequence" | null,
    "stop_sequence": null | "...",
    "usage": { "...": "..." },
    "context_management": null
  }
}
```

### `message.content[]` block types

- **`thinking`**
  - `thinking: string`
  - `signature?: string` (observed in schema docs; may be absent in other versions)
- **`text`**
  - `text: string`
- **`tool_use`**
  - `id: string` (**tool call id**, e.g. `toolu_...`)
  - `name: string` (tool name, e.g. `Read`, `Bash`, `Task`, …)
  - `input: object` (tool parameters)

### Important behavior: non-blocking tool queuing

In the sample session, the assistant can emit **multiple `tool_use` blocks across consecutive assistant records** before any tool result arrives. Do **not** assume strict alternation (`assistant tool_use` → `user tool_result` → next tool_use).

### Synthetic / error assistant messages

The sample includes assistant messages with:

- `message.model: "<synthetic>"`
- root-level `error` (e.g. `"rate_limit"`)
- root-level `isApiErrorMessage` (present but may be truncated in some viewers)

Treat these as assistant events that can interrupt tool flows (e.g., explain missing tool results).

---

## `user` records (overloaded: prompts, tool results, meta/injected content)

Root `type: "user"` does not mean “user typed text”. You must inspect `message.content`.

### Shape (typical)

```json
{
  "type": "user",
  "uuid": "...",
  "parentUuid": "...",
  "sessionId": "...",
  "timestamp": "...",
  "message": {
    "role": "user",
    "content": "..." | [ ... ]
  }
}
```

### Case A: direct user prompt

Observed shape:

```json
{
  "type": "user",
  "message": { "role": "user", "content": "User’s prompt text..." },
  "thinkingMetadata": { "level": "high|medium|low", "disabled": false, "triggers": [] },
  "todos": [ { "content": "...", "status": "in_progress|completed|pending", "activeForm": "..." } ]
}
```

### Case B: tool results (responses to `tool_use`)

Tool results appear as `type: "user"` where `message.content` is an array containing one or more `tool_result` blocks:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_...",
        "content": "... or structured blocks ...",
        "is_error": false
      }
    ]
  },
  "toolUseResult": { "... tool-specific metadata ..." }
}
```

#### Tool correlation rule (critical join)

- **Tool call id** = `assistant.message.content[i].id` where `type == "tool_use"`
- **Tool result reference** = `user.message.content[j].tool_use_id` where `type == "tool_result"`

This join works across main + sidechain logs.

#### Be defensive about `tool_result.content`

In real logs (including this sample), `tool_result.content` can vary:

- a **string**
- an **array of structured blocks** (e.g. `{ "type": "text", "text": "..." }`)
- other tool-specific shapes

Likewise, `toolUseResult` is tool-specific (examples below).

#### `toolUseResult` type varies

In the sample, `toolUseResult` can be:

- an **object** (common for bash-like tools: `{ stdout, stderr, interrupted, isImage }`)
- a **string** (sometimes for error cases)
- a **structured object** for file operations (e.g. create/write) or todo updates (e.g. `{ oldTodos, newTodos }`)

### Case C: slash commands / injected payloads

Some `user.message.content` strings contain embedded tags (e.g. `<command-name>...</command-name>` or `<local-command-stdout>...</local-command-stdout>`). Unless you explicitly need these, treat them as **opaque strings**.

### Case D: meta / transcript-control flags

Observed flags (sample + schema docs):

- `isMeta: true` (system-injected message; not a user prompt)
- `isVisibleInTranscriptOnly: true`
- `isCompactSummary: true`

---

## `system` records: context compaction boundaries

Claude Code may emit a context compaction boundary:

```json
{
  "type": "system",
  "subtype": "compact_boundary",
  "content": "Conversation compacted",
  "uuid": "...",
  "parentUuid": null,
  "logicalParentUuid": "...",
  "compactMetadata": { "trigger": "auto", "preTokens": 156953 }
}
```

Interpretation:

- `parentUuid: null` starts a new chain root after compaction
- `logicalParentUuid` points to the last record before compaction

### Recommended stitching rule

When building a conversation graph, treat compaction boundaries as roots **but** optionally add a virtual edge:

- `logicalParentUuid → system.uuid`

so the user can “follow continuity” across compaction resets.

---

## `file-history-snapshot` records (undo/redo backing store)

These track file backups created by the environment for undo/redo.

Observed shape:

```json
{
  "type": "file-history-snapshot",
  "messageId": "...",
  "snapshot": {
    "messageId": "...",
    "trackedFileBackups": {
      "/abs/or/relative/path": {
        "backupFileName": "...@v1",
        "version": 1,
        "backupTime": "2025-...Z"
      }
    },
    "timestamp": "2025-...Z"
  },
  "isSnapshotUpdate": true
}
```

Notes:

- `trackedFileBackups` can be `{}` or large.
- **There is no `uuid`** on these records (in this sample), so they are not directly part of the `parentUuid` conversation chain.
- **`messageId` vs `snapshot.messageId`**:
  - Initial snapshot: `messageId == snapshot.messageId`
  - Update snapshot: `messageId` changes each time, while `snapshot.messageId` stays the same
  - Practically: treat `snapshot.messageId` as the stable “snapshot thread id”

---

## `queue-operation` records (async queue events)

These represent async queue changes (enqueue/dequeue/remove). Observed shape:

```json
{
  "type": "queue-operation",
  "operation": "enqueue" | "dequeue" | "remove",
  "timestamp": "2025-...Z",
  "sessionId": "...",
  "content": "..." // optional
}
```

Notes:

- `content` may be a slash command string (e.g. `"/rate-limit-options"`).
- `content` may be a structured `<bash-notification>...</bash-notification>` payload. Treat as opaque unless needed.

---

## Sub-agents / sidechains (spawned via `Task` tool)

In the **main** session log, sub-agents are created by `assistant.message.content[].type == "tool_use"` with:

- `name: "Task"`
- `input.subagent_type` (observed: `Explore`, `Plan`)
- `input.prompt` (the subtask)
- `input.description` (optional summary)

In the corresponding `agent-{agentId}.jsonl` file:

- every record has `isSidechain: true`
- every record has `agentId`
- records share the same `sessionId`
- the sidechain often starts with `parentUuid: null`

### Important caveat about discovering agents

Depending on environment/version, the `Task` tool call in the main log may not directly reveal `agentId`. In that case, discover sidechains by:

- scanning `agent-*.jsonl` files and filtering records by `sessionId`

For this sample folder, you can simply load all `agent-*.jsonl` because they all belong to the single session.

---

## Tool execution metadata (`toolUseResult`)

Many tool result `user` records include a tool-specific `toolUseResult` payload. Observed patterns:

### Bash-like tools

```json
{
  "toolUseResult": {
    "stdout": "...",
    "stderr": "",
    "interrupted": false,
    "isImage": false
  }
}
```

### Read-like tools

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

### Glob-like tools

```json
{
  "toolUseResult": {
    "filenames": ["/path/a", "/path/b"],
    "numFiles": 2,
    "durationMs": 491,
    "truncated": false
  }
}
```

### Task (sub-agent) results

Task results may appear as `toolUseResult` with fields like:

- `status`
- `agentId`
- `totalDurationMs`
- `totalTokens`
- `totalToolUseCount`
- `content` (structured blocks)

Because this is tool- and version-specific, treat `toolUseResult` as a loosely-typed union keyed by the tool name.

---

## Assistant “API error” records (synthetic)

The sample includes assistant records representing API errors (e.g., rate limits). These can be “synthetic”:

- `message.model: "<synthetic>"`
- additional root fields like `error`, `isApiErrorMessage`
- may differ from normal assistant records (e.g., missing `requestId` in some environments)

Treat these as first-class timeline events; they can interrupt tool flows and explain missing tool results.

---

## Reconstructing one session: recommended algorithm

### Step 1: load records (main + sidechains)

1. Parse the main `{sessionId}.jsonl`.
2. Parse all `agent-*.jsonl`.
3. Keep only records whose `sessionId` matches the session you’re reconstructing (for this sample folder, they all match).

### Step 2: build indices (minimum useful set)

- **`recordsByUuid: Map<string, Record>`**
- **`childrenByParentUuid: Map<string | null, string[]>`**
- **`assistantGroups: Map<(requestId?, message.id), assistantRecord[]>`**
- **`toolCallsById: Map<string, { assistantUuid, toolUseBlock }>`**
- **`toolResultsByToolUseId: Map<string, { userUuid, toolResultBlock }[]>`**

### Step 2.1: explicit join keys (quick reference)

- **Conversation chain**: `record.parentUuid -> record.uuid`
- **Compaction continuity** (optional): `system.logicalParentUuid -> system.uuid`
- **Assistant “same model turn” grouping**: `(assistant.requestId, assistant.message.id)` (fallback to `assistant.message.id`)
- **Tool call/result pairing**: `assistant.message.content[].id (tool_use) == user.message.content[].tool_use_id (tool_result)`
- **TodoWrite pairing**: same as any tool (the tool name is `TodoWrite`; its result often includes `toolUseResult.oldTodos/newTodos`)
- **Snapshot thread**: `file-history-snapshot.snapshot.messageId` (stable) groups snapshot updates

### Step 3: stitch threads (ordering)

- Use `parentUuid → uuid` as your primary “next” relation.
- Sort siblings (same `parentUuid`) by `timestamp` as a *secondary heuristic* (ties/async can still exist).
- For `system.compact_boundary`, treat as a root; optionally stitch continuity using `logicalParentUuid`.

### Step 4: lift to higher-level “conversation objects”

- **One model response**: group assistant chunks by `(requestId, message.id)`; if `requestId` is missing, fall back to `message.id`.
- **Tool exchange**: join tool calls/results via `toolu_*` ids.
- **Sub-agents**: sidechains are independent threads but should be included in the same session graph and timeline views.

---

## Minimal examples of the key relationships (schematic)

### A) `uuid` / `parentUuid` chain

```text
record A: { uuid: "U1", parentUuid: null }
record B: { uuid: "U2", parentUuid: "U1" }
record C: { uuid: "U3", parentUuid: "U2" }
```

### B) One assistant “turn” split into chunks (same `requestId` + `message.id`)

```text
assistant chunk 1: { requestId: "R1", message.id: "M1", uuid: "U10" }
assistant chunk 2: { requestId: "R1", message.id: "M1", uuid: "U11" }
assistant chunk 3: { requestId: "R1", message.id: "M1", uuid: "U12" }
```

### C) Tool call/result pairing (`tool_use.id` ↔ `tool_result.tool_use_id`)

```text
assistant: message.content += { type:"tool_use", id:"T1", name:"Bash", input:{...} }
user:      message.content += { type:"tool_result", tool_use_id:"T1", is_error:false, content:"..." }
```

### D) Compaction boundary continuity (`logicalParentUuid`)

```text
... record K: { uuid:"UK" }
system: { type:"system", subtype:"compact_boundary", uuid:"UC", parentUuid:null, logicalParentUuid:"UK" }
... new chain continues from UC ...
```

---

## Schema summary checklist (what your parser should handle)

- **Robust JSONL parsing**: one line = one JSON object; tolerate very long lines.
- **Overloaded `user` type**: prompt vs tool result vs injected/meta.
- **Assistant chunking**: multiple assistant records can share the same `(requestId, message.id)`.
- **Tool correlation**: `tool_use.id` ↔ `tool_result.tool_use_id`, and tool results may arrive later.
- **Context compaction**: `system.compact_boundary` with `logicalParentUuid`.
- **Sidechains**: `agent-*.jsonl` with `isSidechain: true` and `agentId`.
- **Non-conversational events**: `file-history-snapshot`, `queue-operation`.
- **Synthetic errors**: assistant records with `isApiErrorMessage` / `model: "<synthetic>"`.


