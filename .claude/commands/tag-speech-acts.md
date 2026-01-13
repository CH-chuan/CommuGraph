---
description: Tag chat messages with speech act types (Searle's five illocutionary types)
allowed-tools: Read, Write, Bash(npx:*), Bash(mkdir:*), Bash(wc:*), Bash(node:*)
argument-hint: <file_path> [--output-dir <path>]
---

# Speech Act Tagging Command (Parallel)

Tag Claude Code chat logs with Searle's five illocutionary speech act types using parallel sub-agents.

## Input Arguments

- **$1**: File path to the chat log (Claude Code JSONL format)
- **$ARGUMENTS**: Parse for `--output-dir <path>` (default: `public/tagged_chalogs`)

## Annotation Schema

@public/annotation_schema/speechact.md

## Speech Act Types

| Type | Examples |
|------|----------|
| **REPRESENTATIVE** | "The error is caused by...", "This approach won't work" |
| **DIRECTIVE** | "Can you fix this?", "Explain why...", any question |
| **COMMISSIVE** | "I'll draft the email", "I can generate..." |
| **EXPRESSIVE** | "Thanks!", "Sorry for the confusion" |
| **DECLARATION** | "You are banned", "Meeting adjourned" (rare) |

---

## Process

### Step 1: Parse the Raw Log

```bash
mkdir -p {output_dir}
npx tsx src/lib/dialog/preprocessor.ts {$1} {output_dir}/{filename}.parsed.jsonl
```

### Step 2: Filter for Tagging

Filter out system_turn and records without text (preserves original line_num):

```bash
node scripts/filter-for-tagging.js {output_dir}/{filename}.parsed.jsonl {output_dir}/{filename}.taggable.jsonl
```

Output format (one per line):
```json
{"line_num": 5, "event_id": "U:abc...", "unit_type": "user_turn", "text": "full text", "text_preview": "first 150 chars"}
```

## Output Schema

Each tagged record uses a `types` array (not primary/secondary) to support multi-act turns:

```json
{
  "speech_act": {
    "types": ["COMMISSIVE", "REPRESENTATIVE"],
    "notes": "Status report followed by commitment"
  }
}
```

- `types`: Array of speech act types present in the turn (1 or more)
- `notes`: Brief explanation of classification reasoning

### Step 3: Count & Calculate Ranges

```bash
wc -l {output_dir}/{filename}.taggable.jsonl
```

Calculate ranges for up to 5 sub-agents (min 5 lines each).

### Step 4: Spawn Parallel Sub-Agents

Use the `speech-act-tagger` sub-agent. Spawn **in parallel** using multiple Task tool calls:

```
Task 1: Use speech-act-tagger to tag lines 1-N of {taggable_file}, append to {tagged_file}
Task 2: Use speech-act-tagger to tag lines N+1-M of {taggable_file}, append to {tagged_file}
...
```

Each sub-agent:
1. Reads assigned lines from `.taggable.jsonl`
2. Tags each record with speech act type
3. Appends to `.tagged.jsonl` (preserving line_num)

### Step 5: Sort & Finalize

```bash
node -e "
const fs = require('fs');
const f = '{output_dir}/{filename}.tagged.jsonl';
const lines = fs.readFileSync(f,'utf8').split('\n').filter(Boolean);
const sorted = lines.map(l=>JSON.parse(l)).sort((a,b)=>a.line_num-b.line_num);
fs.writeFileSync(f, sorted.map(r=>{delete r.line_num;return JSON.stringify(r)}).join('\n')+'\n');
console.log('Sorted', sorted.length, 'records');
"
```

### Step 6: Report Summary

```
Total parsed: X | Taggable: X | System skipped: X | No-text skipped: X
REPRESENTATIVE: X | DIRECTIVE: X | COMMISSIVE: X | EXPRESSIVE: X | DECLARATION: X
Output: {output_dir}/{filename}.tagged.jsonl
```

---

## Sub-Agent Reference

The `speech-act-tagger` sub-agent (`.claude/agents/speech-act-tagger.md`):
- Model: haiku (fast)
- Tools: Read, Write
- Input: Pre-filtered taggable records with line_num

---

## Example

```
/tag-speech-acts public/samples/claudecode/ab51623b-c26d-45f5-b98e-f9d0cfa17018.jsonl
```
