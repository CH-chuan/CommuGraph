## Tools Called by the Agent (from chat logs)

This document lists **all tool calls** observed in `claude_code_chatlog_example/*.jsonl` by scanning `assistant.message.content[]` for items where `type == "tool_use"`.

### Tool inventory (with counts in the sample)

| Tool name | Calls (sample) | What it does (high level) |
|---|---:|---|
| `Read` | 122 | Read file contents from a path |
| `Write` | 52 | Write/overwrite a file at a path |
| `Bash` | 41 | Execute a shell command |
| `Glob` | 13 | Find files by glob pattern |
| `Edit` | 9 | Edit an existing file by replace-old-with-new |
| `TodoWrite` | 7 | Create/update a structured TODO list |
| `Task` | 4 | Spawn a sub-agent to run a delegated task |
| `BashOutput` | 2 | Fetch output from a background bash/shell job |
| `AskUserQuestion` | 1 | Ask the user a structured multiple-choice / prompt question |
| `ExitPlanMode` | 1 | Exit “plan mode” with a proposed plan |
| `Grep` | 1 | Search file contents (pattern-based) |
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

Many user tool result records also include a convenience field `toolUseResult` with structured output.

---

## Per-tool descriptions

### `Read`

- **Purpose**: Load file contents (often source code) into the conversation context.
- **Typical input (observed)**:
  - `file_path: string`
- **Typical tool result shape**:
  - `user.toolUseResult.file.filePath`
  - `user.toolUseResult.file.content`
  - line counts: `numLines`, `startLine`, `totalLines`

### `Write`

- **Purpose**: Create or overwrite a file with given content.
- **Typical input (observed)**:
  - `file_path: string`
  - `content: string`
- **Typical tool result shape**:
  - For creates/updates, `user.toolUseResult` may include:
    - `type: "create" | "update"`
    - `filePath`, `content`
    - optional `structuredPatch`, `originalFile`

### `Edit`

- **Purpose**: Modify an existing file using a string replacement.
- **Typical input (observed)**:
  - `file_path: string`
  - `old_string: string` (must match existing content)
  - `new_string: string`
- **Typical tool result**:
  - Similar to write/update metadata; may include patch-like fields.

### `Bash`

- **Purpose**: Run a shell command (builds, file operations, scripts).
- **Typical input (observed)**:
  - `command: string`
  - optional `description: string`
  - optional `timeout: number`
- **Typical tool result shape**:
  - `user.toolUseResult.stdout`
  - `user.toolUseResult.stderr`
  - `user.toolUseResult.interrupted: boolean`
  - `user.toolUseResult.isImage: boolean`

### `BashOutput`

- **Purpose**: Retrieve output for a **background** shell command.
- **Typical input (observed)**:
  - `bash_id: string`
- **Typical tool result**:
  - Similar stdout/stderr payloads, depending on the implementation.

### `KillShell`

- **Purpose**: Stop a background shell command.
- **Typical input (observed)**:
  - `shell_id: string`

### `Glob`

- **Purpose**: Find files by a glob pattern.
- **Typical input (observed)**:
  - `pattern: string` (example: `"**/mock_chat_history.jsonl"`)
- **Typical tool result**:
  - A list of matching file paths.

### `Grep`

- **Purpose**: Search file contents for a pattern.
- **Typical input (observed)**:
  - `pattern: string` (regex)
  - `path: string` (directory/file to search)
  - `type: string` (file type filter, e.g. `py`)
  - `output_mode: "files_with_matches" | ...`
- **Typical tool result**:
  - Matching lines and/or matching file paths.

### `TodoWrite`

- **Purpose**: Maintain a structured todo list used to track progress.
- **Typical input (observed)**:
  - `todos: Array<{ content: string, status: "pending"|"in_progress"|"completed", activeForm?: string }>`
- **Typical tool result**:
  - Often returns `oldTodos` and `newTodos`.

### `Task`

- **Purpose**: Spawn a sub-agent (sidechain) to do exploration/planning work.
- **Typical input (observed)**:
  - `subagent_type: string` (observed: `Explore`, `Plan`)
  - `prompt: string`
  - optional `description: string`
- **Downstream log effect**:
  - Creates `agent-{agentId}.jsonl` where entries have `isSidechain: true`.

### `AskUserQuestion`

- **Purpose**: Ask the user structured questions (often multiple choice) to disambiguate requirements.
- **Typical input (observed)**:
  - `questions: Array<{ header?: string, question: string, options: Array<{label: string, description?: string}>, multiSelect: boolean }>`

### `ExitPlanMode`

- **Purpose**: Finish a planning phase by returning a plan payload.
- **Typical input (observed)**:
  - `plan: string` (markdown)

---

## Notes / caveats

- This list is **empirical**: it reflects tools that appear in the provided sample logs, not necessarily every tool Claude Code can ever use.
- In the logs, “tool calls” are always emitted by `type: "assistant"` records; “tool results” are recorded as `type: "user"` records referencing `tool_use_id`.
