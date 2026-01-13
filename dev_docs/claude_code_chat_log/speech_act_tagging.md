# Speech Act Tagging System

This document describes the speech act tagging infrastructure for annotating Claude Code chat logs with Searle's five illocutionary speech act types.

## Overview

The speech act tagging system classifies each dialog turn (user or assistant message) according to Searle's taxonomy of illocutionary acts. This enables analysis of conversational patterns and the communicative functions of human-AI interactions.

## New Files

| File | Purpose |
|------|---------|
| `public/annotation_schema/speechact.md` | Annotation guidelines defining the five speech act types |
| `src/lib/dialog/speech-act-loader.ts` | Loads tagged JSONL files and converts to `LabelRecord` format |
| `.claude/agents/speech-act-tagger.md` | Sub-agent definition for parallel tagging |
| `.claude/commands/tag-speech-acts.md` | Slash command for invoking the tagging workflow |

## Speech Act Types (Searle's Five)

| Type | Definition | Examples |
|------|------------|----------|
| **REPRESENTATIVE** | Speaker commits to a proposition (claim/explain/report) | "The error is caused by...", "This approach won't work" |
| **DIRECTIVE** | Speaker attempts to get hearer to do something | "Can you fix this?", "Explain why...", questions |
| **COMMISSIVE** | Speaker commits to future action | "I'll draft the email", "I can generate..." |
| **EXPRESSIVE** | Speaker expresses emotional/attitudinal state | "Thanks!", "Sorry for the confusion" |
| **DECLARATION** | Utterance changes institutional status (rare) | "You are banned", "Meeting adjourned" |

## Multi-Act Turns

A single turn can contain multiple speech acts. The system uses a `types` array to capture all present:

```json
{
  "speech_act": {
    "types": ["REPRESENTATIVE", "COMMISSIVE"],
    "notes": "Reports findings, commits to plan"
  }
}
```

Examples:
- "Phase 1 complete. Let me start Phase 2." → `["REPRESENTATIVE", "COMMISSIVE"]`
- "Thanks! Can you also fix the tests?" → `["EXPRESSIVE", "DIRECTIVE"]`

## Architecture

### Tagging Workflow (`/tag-speech-acts`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    /tag-speech-acts <file>                          │
├─────────────────────────────────────────────────────────────────────┤
│ Step 1: Parse raw JSONL → .parsed.jsonl                             │
│ Step 2: Filter for taggable records → .taggable.jsonl               │
│ Step 3: Count lines, calculate ranges for parallel processing       │
│ Step 4: Spawn parallel sub-agents (speech-act-tagger)               │
│ Step 5: Sort & finalize → .tagged.jsonl                             │
│ Step 6: Report summary                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
raw.jsonl
    │
    ▼ (preprocessor.ts)
{session}.parsed.jsonl    ← DialogRecord format
    │
    ▼ (filter-for-tagging.js)
{session}.taggable.jsonl  ← Only user_turn/assistant_turn with text
    │
    ▼ (speech-act-tagger sub-agents)
{session}.tagged.jsonl    ← With speech_act labels in labels[]
```

### File Locations

- **Input**: Any Claude Code JSONL file
- **Intermediate files**: `public/tagged_chalogs/{session}.parsed.jsonl`, `.taggable.jsonl`
- **Output**: `public/tagged_chalogs/{session}.tagged.jsonl`

## Integration with Dialog View

### LabelRecord Format

The `speech-act-loader.ts` module converts tagged records to `LabelRecord` format:

```typescript
// Types from src/lib/dialog/types.ts
type LabelId =
  | 'SPEECH_ACT_REPRESENTATIVE'
  | 'SPEECH_ACT_DIRECTIVE'
  | 'SPEECH_ACT_COMMISSIVE'
  | 'SPEECH_ACT_EXPRESSIVE'
  | 'SPEECH_ACT_DECLARATION';

interface LabelRecord {
  id: LabelId;
  confidence?: number;
  evidence?: { cue?: string };
}
```

### Loading Tags

```typescript
import { loadSpeechActTags, hasTaggedFile } from '@/lib/dialog/speech-act-loader';

// Check if tagged file exists
const hasFile = await hasTaggedFile(sessionId);

// Load tags (Map<event_id, LabelRecord[]>)
const tags = await loadSpeechActTags(sessionId);
const labelsForEvent = tags.get(eventId) || [];
```

## Usage

### Via Slash Command

```bash
/tag-speech-acts public/samples/claudecode/ab51623b-c26d-45f5-b98e-f9d0cfa17018.jsonl
```

## Classification Rules

Quick disambiguation heuristics from the annotation schema:

1. **Question** → DIRECTIVE (requesting an answer)
2. **"Here is / This is..."** → REPRESENTATIVE (unless "Here is what you should do" → Directive)
3. **"I will / I can / I won't"** → COMMISSIVE (unless factual prediction)
4. **Pure affect ("thanks", "sorry")** → EXPRESSIVE
5. **Institutional status change** → DECLARATION (rare in AI chats)

### Primary Act Rule

When only one label is allowed, pick the act that best captures the main conversational function:
- Directive often dominates ("Can you...?" even with extra context)
- If no Directive: Commissive > Representative > Expressive > Declaration

## Output Example

```json
{
  "event_id": "A:req123:msg456",
  "unit_type": "assistant_turn",
  "text_or_artifact_ref": {
    "text": "Let me check the error logs and fix the issue."
  },
  "labels": [
    {
      "schema": "speechact",
      "types": ["COMMISSIVE"],
      "notes": "commitment to act"
    }
  ]
}
```

## Statistics Output

After tagging, the system reports:

```
Total: 150 | Tagged: 120 | NO_TEXT_CONTENT: 20 | Skipped (system): 10
REPRESENTATIVE: 45 | DIRECTIVE: 35 | COMMISSIVE: 30 | EXPRESSIVE: 8 | DECLARATION: 2
Output: public/tagged_chalogs/{session}.tagged.jsonl
```
