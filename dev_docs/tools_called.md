## Tools Called by the Agent (from chat logs)

This document lists **all tool calls** observed in Claude Code chat logs by scanning `assistant.message.content[]` for items where `type == "tool_use"`.

### Tool inventory (with counts from sample logs)

| Tool name | Calls | What it does (high level) |
|---|---:|---|
| `Read` | 574 | Read file contents from a path |
| `Edit` | 459 | Edit an existing file by replace-old-with-new |
| `Bash` | 411 | Execute a shell command |
| `Grep` | 238 | Search file contents (pattern-based) |
| `TodoWrite` | 142 | Create/update a structured TODO list |
| `Glob` | 96 | Find files by glob pattern |
| `Write` | 52 | Write/overwrite a file at a path |
| `Task` | 12 | Spawn a sub-agent to run a delegated task |
| `WebFetch` | 5 | Fetch and analyze content from a URL |
| `TaskOutput` | 3 | Retrieve output from a background task |
| `AgentOutputTool` | 2 | Get output from a running agent |
| `ExitPlanMode` | 2 | Exit "plan mode" with a proposed plan |
| `EnterPlanMode` | 1 | Enter planning mode |
| `AskUserQuestion` | 1 | Ask the user a structured multiple-choice question |
| `KillShell` | 1 | Terminate a background shell job |

---

## Tool schemas and how to interpret them in the logs

All tool calls appear inside an **assistant** record at:

- `assistant.message.content[i].type == "tool_use"`
- `assistant.message.content[i].name == <tool name>`
- `assistant.message.content[i].id == "toolu_..."` (tool call id)
- `assistant.message.content[i].input == { ... }` (tool-specific input)

Tool results typically arrive later as a **user** record containing:

- `user.message.content[j].type == "tool_result"`
- `user.message.content[j].tool_use_id == "toolu_..."` (references the tool call id)
- `user.message.content[j].content == "..."` (text result shown to the model)
- `user.message.content[j].is_error == boolean` (indicates if tool failed)

Many user tool result records also include a convenience field `toolUseResult` with structured output metadata.

---

## Per-tool schemas

### `Read`

**Purpose**: Load file contents (often source code) into the conversation context.

**Input schema**:
```json
{
  "file_path": "string (required) - absolute path to file",
  "limit": "number (optional) - max lines to read",
  "offset": "number (optional) - starting line number"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "file": "string - file path",
  "type": "string"
}
```

---

### `Write`

**Purpose**: Create or overwrite a file with given content.

**Input schema**:
```json
{
  "file_path": "string (required) - absolute path",
  "content": "string (required) - file content to write"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "filePath": "string",
  "content": "string",
  "originalFile": "string (if file existed)",
  "structuredPatch": "object (diff info)",
  "type": "string - 'create' | 'update'"
}
```

---

### `Edit`

**Purpose**: Modify an existing file using exact string replacement.

**Input schema**:
```json
{
  "file_path": "string (required) - absolute path",
  "old_string": "string (required) - exact text to find",
  "new_string": "string (required) - replacement text",
  "replace_all": "boolean (optional) - replace all occurrences"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "filePath": "string",
  "oldString": "string",
  "newString": "string",
  "originalFile": "string",
  "structuredPatch": "object",
  "userModified": "boolean",
  "replaceAll": "boolean"
}
```

---

### `Bash`

**Purpose**: Run a shell command (builds, file operations, scripts).

**Input schema**:
```json
{
  "command": "string (required) - shell command to execute",
  "description": "string (optional) - short description of what command does",
  "timeout": "number (optional) - timeout in milliseconds"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "stdout": "string",
  "stderr": "string",
  "interrupted": "boolean",
  "isImage": "boolean",
  "backgroundTaskId": "string (if run in background)"
}
```

---

### `Glob`

**Purpose**: Find files by a glob pattern.

**Input schema**:
```json
{
  "pattern": "string (required) - glob pattern, e.g. '**/*.ts'",
  "path": "string (optional) - directory to search in"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "filenames": ["array of matching file paths"],
  "numFiles": "number",
  "durationMs": "number",
  "truncated": "boolean"
}
```

---

### `Grep`

**Purpose**: Search file contents for a pattern (regex-based).

**Input schema**:
```json
{
  "pattern": "string (required) - regex pattern to search",
  "path": "string (optional) - directory/file to search",
  "output_mode": "string - 'files_with_matches' | 'content' | 'count'",
  "glob": "string (optional) - filter files by glob pattern",
  "type": "string (optional) - file type filter, e.g. 'ts', 'py'",
  "head_limit": "number (optional) - limit number of results",
  "-A": "number (optional) - lines after match",
  "-B": "number (optional) - lines before match",
  "-C": "number (optional) - lines of context",
  "-i": "boolean (optional) - case insensitive",
  "-n": "boolean (optional) - show line numbers"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "filenames": ["array of matching files"],
  "numFiles": "number",
  "mode": "string",
  "content": "string (if output_mode='content')",
  "numLines": "number (if output_mode='content')",
  "appliedLimit": "number (if limited)"
}
```

---

### `TodoWrite`

**Purpose**: Maintain a structured todo list to track task progress.

**Input schema**:
```json
{
  "todos": [
    {
      "content": "string - task description (imperative form)",
      "status": "string - 'pending' | 'in_progress' | 'completed'",
      "activeForm": "string - present continuous form for display"
    }
  ]
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "oldTodos": ["previous todo list"],
  "newTodos": ["updated todo list"]
}
```

---

### `Task`

**Purpose**: Spawn a sub-agent (sidechain) to do exploration/planning work.

**Input schema**:
```json
{
  "prompt": "string (required) - task description for the agent",
  "description": "string (required) - short 3-5 word description",
  "subagent_type": "string (required) - 'Explore' | 'Plan' | 'general-purpose' | etc.",
  "model": "string (optional) - 'sonnet' | 'opus' | 'haiku'",
  "run_in_background": "boolean (optional) - run asynchronously"
}
```

**Result metadata (sync)** (`toolUseResult`):
```json
{
  "agentId": "string",
  "status": "string - 'completed' | 'running'",
  "prompt": "string",
  "content": "string - agent's response",
  "totalDurationMs": "number",
  "totalTokens": "number",
  "totalToolUseCount": "number",
  "usage": "object"
}
```

**Result metadata (async)** (`toolUseResult`):
```json
{
  "agentId": "string",
  "status": "string - 'running'",
  "description": "string",
  "prompt": "string",
  "isAsync": "boolean"
}
```

**Downstream log effect**:
- Creates `agent-{agentId}.jsonl` where entries have `isSidechain: true`.

---

### `TaskOutput`

**Purpose**: Retrieve output from a running or completed background task.

**Input schema**:
```json
{
  "task_id": "string (required) - the agent/task ID",
  "block": "boolean (optional, default true) - wait for completion",
  "timeout": "number (optional) - max wait time in ms"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "retrieval_status": "string - 'success' | 'timeout'",
  "task": "object - task details and output"
}
```

---

### `AgentOutputTool`

**Purpose**: Get output from a specific running agent.

**Input schema**:
```json
{
  "agentId": "string (required) - the agent ID",
  "block": "boolean (optional) - wait for output"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "retrieval_status": "string - 'success' | 'timeout'",
  "agents": {
    "<agentId>": {
      "status": "string",
      "description": "string",
      "prompt": "string",
      "output": "string"
    }
  }
}
```

---

### `WebFetch`

**Purpose**: Fetch content from a URL and process it with AI.

**Input schema**:
```json
{
  "url": "string (required) - URL to fetch",
  "prompt": "string (required) - what to extract/analyze from the page"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "url": "string",
  "code": "number - HTTP status code",
  "codeText": "string - HTTP status text",
  "bytes": "number - response size",
  "durationMs": "number",
  "result": "string - AI-processed content"
}
```

---

### `AskUserQuestion`

**Purpose**: Ask the user structured questions (often multiple choice) to disambiguate requirements.

**Input schema**:
```json
{
  "questions": [
    {
      "header": "string (optional) - short label (max 12 chars)",
      "question": "string (required) - the question to ask",
      "options": [
        {
          "label": "string - option display text",
          "description": "string (optional) - explanation"
        }
      ],
      "multiSelect": "boolean - allow multiple selections"
    }
  ]
}
```

---

### `EnterPlanMode`

**Purpose**: Enter planning mode for complex implementation tasks.

**Input schema**:
```json
{}
```

**Result metadata** (`toolUseResult`):
```json
{
  "message": "string - confirmation message"
}
```

---

### `ExitPlanMode`

**Purpose**: Exit planning mode with a finalized plan.

**Input schema**:
```json
{
  "plan": "string (optional) - the plan content (markdown)"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "plan": "string",
  "filePath": "string - path to plan file",
  "isAgent": "boolean"
}
```

---

### `KillShell`

**Purpose**: Terminate a background shell command.

**Input schema**:
```json
{
  "shell_id": "string (required) - ID of the shell to kill"
}
```

---

### `NotebookEdit`

**Purpose**: Edit Jupyter notebook cells (.ipynb files).

**Input schema**:
```json
{
  "notebook_path": "string (required) - absolute path to notebook",
  "new_source": "string (required) - new source for the cell",
  "cell_id": "string (optional) - cell ID to edit or insert after",
  "cell_type": "string (optional) - 'code' or 'markdown'",
  "edit_mode": "string (optional) - 'replace' | 'insert' | 'delete'"
}
```

**Note**: Used for editing Jupyter notebooks. Not commonly observed in typical logs.

---

### `WebSearch`

**Purpose**: Search the web for up-to-date information.

**Input schema**:
```json
{
  "query": "string (required) - search query",
  "allowed_domains": "array of strings (optional) - only include results from these domains",
  "blocked_domains": "array of strings (optional) - never include results from these domains"
}
```

**Result metadata** (`toolUseResult`):
```json
{
  "query": "string",
  "results": "array of search result objects",
  "durationMs": "number"
}
```

**Note**: Not observed in the sample logs but available in Claude Code.

---

## Notes / caveats

- This list is **empirical**: it reflects tools that appear in the provided sample logs, not necessarily every tool Claude Code can use.
- In the logs, "tool calls" are always emitted by `type: "assistant"` records; "tool results" are recorded as `type: "user"` records referencing `tool_use_id`.
- The `toolUseResult` field provides structured metadata about the tool execution, separate from the text `content` shown to the model.
- Additional tools may exist in Claude Code that were not observed in these particular log samples.
