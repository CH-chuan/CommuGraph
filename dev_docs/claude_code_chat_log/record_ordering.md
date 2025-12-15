# Record Ordering: Kahn's Algorithm with Timestamp Priority

This document explains how CommuGraph orders records from Claude Code sessions. The ordering algorithm ensures **consistent sequencing across all views** (Workflow View, Annotation View, Chat Log).

---

## TL;DR: The Three-Phase Pipeline

CommuGraph processes Claude Code logs through three phases:

| Phase | Purpose | Method |
|-------|---------|--------|
| **1. Deduplication** | Remove duplicate content from logging bugs | Signature matching + timestamp grouping |
| **2. Branch Resolution** | Prune phantom branches | BFS from phantom roots |
| **3. Final Ordering** | Produce chronological + tree-respecting order | Kahn's algorithm with timestamp priority |

---

## Why This Approach?

### Problem 1: Pure Timestamp Sort Fails

Claude Code is asynchronous. Multiple records can have the **same timestamp** but belong to different parts of the conversation tree:

```
Problem: Two records at 2025-12-09T20:46:53.669Z
- Record A: Line 800, part of conversation branch 1
- Record B: Line 1048, part of conversation branch 2

Timestamp sort: [A, B] adjacent (WRONG - they're unrelated)
```

### Problem 2: Pure DFS Fails (The Original Bug)

DFS processes entire branches before siblings, causing **chronologically incorrect ordering**:

```
Problem: User message at 07:56 is child of assistant at 06:51
         Another assistant at 07:46 is on a different branch

DFS order: [06:51 assistant, 07:56 user, ...then... 07:46 assistant]
                            ^^^^^^^^                 ^^^^^^^^
                            LATER timestamp          EARLIER timestamp
                            appears FIRST!           appears LATER!
```

### Solution: Kahn's Algorithm with Timestamp Priority

Combines the best of both approaches:
- **Respects tree structure**: Parents always before children
- **Maximizes chronological order**: Among unrelated records, earlier timestamps first

---

## The Parent-Child UUID Chain

Each raw JSONL record has:
- `uuid` - Unique identifier for this record
- `parentUuid` - UUID of the parent record (or `null` for roots)
- `logicalParentUuid` - Optional, used for context compaction continuity

This forms a **tree structure** representing the actual conversation flow.

```
Root (parentUuid: null)
├── User prompt (parentUuid: root)
│   └── Assistant response (parentUuid: user prompt)
│       ├── Tool call 1 (parentUuid: assistant)
│       │   └── Tool result 1 (parentUuid: tool call 1)
│       └── Tool call 2 (parentUuid: assistant)
│           └── Tool result 2 (parentUuid: tool call 2)
└── Another root (parentUuid: null, after context compaction)
    └── ...
```

---

## Phase 3: Final Ordering (Kahn's Algorithm)

### Algorithm Overview

```
1. Build uuid → record map (for all UUIDs)
2. Build record → parent mapping
3. Initialize priority queue with "ready" records (no parent or parent already processed)
4. While queue not empty:
   a. Pop record with earliest timestamp
   b. Add to result
   c. Mark children as ready (if their parent is now processed)
   d. Add newly ready children to queue
5. Handle remaining records (cycles or data issues)
```

### Why Kahn's Algorithm?

| Approach | Tree Constraint | Chronological Order | Multiple Branches |
|----------|-----------------|---------------------|-------------------|
| Pure Timestamp | ❌ Violates | ✅ Perfect | ✅ Interleaved |
| Pure DFS | ✅ Respects | ❌ Violates | ❌ Sequential |
| **Kahn's + Priority** | ✅ Respects | ✅ Optimal | ✅ Interleaved |

### Implementation

```typescript
private topologicalSort(records: AnnotationRecord[]): AnnotationRecord[] {
  // Step 1: Build uuid → record map (register ALL UUIDs for merged records)
  const byUuid = new Map<string, AnnotationRecord>();
  for (const record of records) {
    for (const uuid of record.source.raw_uuids || []) {
      byUuid.set(uuid, record);
    }
  }

  // Step 2: Build record → parent mapping
  const parentOf = new Map<AnnotationRecord, AnnotationRecord | null>();
  for (const record of records) {
    const parentUuid = record.source.parent_uuid;
    if (parentUuid && byUuid.has(parentUuid)) {
      parentOf.set(record, byUuid.get(parentUuid)!);
    } else {
      parentOf.set(record, null); // Root or orphan
    }
  }

  // Step 3: Track processed records
  const processed = new Set<AnnotationRecord>();
  const result: AnnotationRecord[] = [];

  // Helper: Get timestamp for sorting
  const getTimestamp = (r: AnnotationRecord): number =>
    r.timestamp ? new Date(r.timestamp).getTime() : 0;

  // Helper: Check if record is ready (parent processed or no parent)
  const isReady = (r: AnnotationRecord): boolean => {
    const parent = parentOf.get(r);
    return parent === null || parent === undefined || processed.has(parent);
  };

  // Step 4: Initialize priority queue with ready records
  let readyQueue = records.filter(isReady);
  readyQueue.sort((a, b) => getTimestamp(a) - getTimestamp(b));

  // Build children map for efficient lookup
  const childrenOf = new Map<AnnotationRecord, AnnotationRecord[]>();
  for (const record of records) {
    const parent = parentOf.get(record);
    if (parent) {
      const children = childrenOf.get(parent) || [];
      children.push(record);
      childrenOf.set(parent, children);
    }
  }

  // Step 5: Process in timestamp order, respecting dependencies
  while (readyQueue.length > 0) {
    const record = readyQueue.shift()!; // Earliest timestamp

    if (processed.has(record)) continue;
    processed.add(record);
    result.push(record);

    // Check if any children are now ready
    const children = childrenOf.get(record) || [];
    const newlyReady = children.filter(c => !processed.has(c) && isReady(c));

    if (newlyReady.length > 0) {
      readyQueue.push(...newlyReady);
      readyQueue.sort((a, b) => getTimestamp(a) - getTimestamp(b));
    }
  }

  // Step 6: Handle remaining (shouldn't happen in well-formed data)
  const remaining = records.filter(r => !processed.has(r));
  if (remaining.length > 0) {
    console.warn(`${remaining.length} records could not be ordered`);
    remaining.sort((a, b) => getTimestamp(a) - getTimestamp(b));
    result.push(...remaining);
  }

  return result;
}
```

### Visual Example

```
Input Records (by timestamp):
  06:51 Assistant A (root)
  07:45 User B (root)
  07:46 Assistant C (parent: B)
  07:56 User D (parent: A)

Tree Structure:
  A (06:51)          B (07:45)
    └── D (07:56)      └── C (07:46)

DFS Order (WRONG):
  [A, D, B, C]  ← D at 07:56 before C at 07:46!

Kahn's Order (CORRECT):
  [A, B, C, D]  ← Chronological while respecting parents

  Step-by-step:
  1. Ready: [A, B] → Pick A (06:51), D becomes ready
  2. Ready: [B, D] → Pick B (07:45), C becomes ready
  3. Ready: [C, D] → Pick C (07:46)
  4. Ready: [D]    → Pick D (07:56)
```

---

## Handling Specific Cases

### 1. Multiple Branches with Interleaved Timestamps

**Scenario:** Two branches with timestamps that interleave

```
Branch 1: A (06:00) → B (06:30) → C (07:00)
Branch 2: X (06:15) → Y (06:45)
```

**Kahn's Result:** `[A, X, B, Y, C]` - chronological order preserved!

**DFS Result:** `[A, B, C, X, Y]` - Branch 1 completed before Branch 2 starts ❌

### 2. Orphans (Parent Not in Set)

**Scenario:** Record's `parentUuid` references a UUID not in our processable set

**Why orphans exist:**
- Parent was filtered out (e.g., `file-history-snapshot`, `queue-operation`)
- Parent is in a sub-agent file not loaded
- First record in session (may reference previous session)

**Handling:** Treated as roots (parent = null), sorted into queue by timestamp.

### 3. Context Compaction (logicalParentUuid)

**Scenario:** Context limit reached, conversation "restarts" with summary

When context is compacted:
1. A `system` record with `subtype: "compact_boundary"` is created
2. It has `parentUuid: null` (appears as new root)
3. It has `logicalParentUuid` pointing to the last record before compaction

**Handling:** Use `logicalParentUuid ?? parentUuid` to maintain conversation continuity.

### 4. Merged Responses (Grouped Assistant Records)

**Scenario:** Multiple JSONL lines grouped by `requestId` into one logical record

A merged response contains:
- Main UUID (first chunk's UUID)
- Tool call UUIDs (each `tool_use` block has its own UUID in raw records)

**Handling:** Register all UUIDs in the map so children can reference any of them:

```typescript
raw_uuids: [response.uuid, ...response.toolCalls.map(tc => tc.uuid)]
```

---

## Why This Approach is Robust

### Guarantees

1. **Topological Correctness**: Parents always appear before children (enforced by `isReady` check)
2. **Optimal Chronology**: Among records with no dependency relationship, earlier timestamps always come first
3. **Deterministic**: Same input always produces same output (no randomness)
4. **Complete**: All records are processed (remaining records handled at end)

### Edge Cases Handled

| Edge Case | How It's Handled |
|-----------|------------------|
| Same timestamp, different branches | Both become ready simultaneously, processed in stable order |
| Orphan records | Treated as roots, sorted by timestamp |
| Cycles in data | Detected and appended at end with warning |
| Empty input | Returns empty array immediately |
| Single record | Returns that record |
| All records are roots | Pure timestamp sort (optimal) |
| Linear chain (no branches) | Pure parent-child order (optimal) |

### Complexity

- **Time**: O(n log n) - dominated by priority queue operations
- **Space**: O(n) - maps and queue store all records

## Pre-Processing: Phantom Branch Pruning

Before ordering, phantom branches are pruned to handle Claude Code logging bugs.

### The Problem

Claude Code sometimes logs the same user message multiple times with different UUIDs when images are involved. These duplicate records create phantom branches in the conversation tree.

#### Type 1: Assistant Records (Signature Duplicates)

Multiple records with the same thinking content and signature:

```
Line 10:  uuid=68ad3e2f, parentUuid=2da22b59, signature=EfYD..., timestamp=15:23:35
Line 196: uuid=ecde71ae, parentUuid=d6adb465, signature=EfYD..., timestamp=15:23:35
                                              ^^^^^^^^^^^^
                                              SAME signature!
```

#### Type 2: User Records (Timestamp Duplicates)

The same user message logged as multiple separate records. These duplicates:
- Share the **same timestamp** (key identifier)
- May have **different parentUuids** (creating parallel chains, not just forks)
- Have **different content richness** (complete vs partial logging)

**Example - Same timestamp, different content:**
```
Timestamp: 2025-12-09T20:35:22.822Z

Line 768: 3 blocks [image+image+text], parentUuid=45da10a4  ← MAIN (richest)
Line 1015: 1 block [image], parentUuid=f78fbdf2  ← PHANTOM
Line 1016: 1 block [image], parentUuid=4d9bf34d  ← PHANTOM
Line 1017: 1 block [text], parentUuid=810d2f56   ← PHANTOM
```

The partial records form chains (image → image → text) that parallel the complete record.

### Impact

These parallel chains create divergent conversation trees. Both branches appear valid but the phantom branches contain duplicated/partial data that shouldn't be displayed.

### Solution: Timestamp + Content Deduplication

We use **timestamp grouping** combined with **content comparison** to identify duplicates:

1. **Deduplicate assistants by signature** - Same as before
2. **Group USER INPUT records by timestamp** - Same timestamp = potentially same user action
3. **Identify the "main" record** - Richest record (most content blocks) is the main
4. **Detect phantom patterns** - Compare each record against the main record
5. **Collect phantom UUIDs** - BFS from phantom branch roots
6. **Exclude phantom records** - Filter out all records in phantom branches

**Simplified Rule**:
> The richest record (most content blocks) is the **main** record. ALL others are **phantoms** UNLESS they have **different non-empty text** (which indicates a legitimate parallel branch).

**Key distinctions**:
- **User INPUT records** (actual user prompts with text/images) - these CAN have phantom duplicates
- **Tool RESULT records** (tool execution results) - these should NEVER be deduplicated
- **Different non-empty text** - Records with different text content are legitimate parallel branches, NOT phantoms

This simple rule handles all phantom cases:
- Same text content (string vs array format) → phantom
- Image-only subsets of image+text main → phantom (empty text = not a legitimate parallel)
- Text-only subsets of image+text main → phantom if same text
- Different text content → legitimate parallel branch

```typescript
// Phase 3: Group USER INPUT records by timestamp for phantom branch detection
const timestampGroups = new Map<string, RawLogRecord[]>();
for (const record of afterAssistantDedup) {
  if (record.type !== 'user') continue;
  if (!record.message?.content) continue;

  // Skip records that contain tool_result - these are tool execution results
  if (Array.isArray(record.message.content)) {
    const hasToolResult = record.message.content.some(c => c.type === 'tool_result');
    if (hasToolResult) continue;
  }

  const ts = record.timestamp;
  timestampGroups.get(ts)?.push(record) || timestampGroups.set(ts, [record]);
}

// Phase 4: Identify phantom roots using the simplified rule
for (const [, recs] of timestampGroups.entries()) {
  if (recs.length <= 1) continue;

  // Sort by content count (richest first) - the richest is the main record
  const sortedRecs = [...recs].sort((a, b) => getContentCount(b) - getContentCount(a));
  const mainRecord = sortedRecs[0];
  const mainText = extractTextContent(mainRecord).trim().toLowerCase();

  // All other records are phantoms UNLESS they have different non-empty text
  for (let i = 1; i < sortedRecs.length; i++) {
    const rec = sortedRecs[i];
    const recText = extractTextContent(rec).trim().toLowerCase();

    // Different non-empty text = legitimate parallel branch, not phantom
    const isLegitimateParallel = recText.length > 0 && recText !== mainText;

    if (!isLegitimateParallel) {
      phantomRoots.push(rec);
    }
  }
}

// Phase 5: Collect all UUIDs in phantom branches (BFS)
for (const root of phantomRoots) {
  // BFS to collect all UUIDs in phantom branch
  phantomUuids.add(root.uuid);
  // ... add all descendants
}

// Phase 6: Filter out phantom branch
return records.filter(r => !phantomUuids.has(r.uuid));
```

### Why Timestamp-Based (not Fork-Based)?

The original fork-based approach only detected cases where duplicates shared the same `parentUuid`. However, Claude Code's logging bug often creates duplicates with **different** `parentUuids` but the **same** `timestamp`.

| Approach | Detects Same Parent | Detects Different Parent |
|----------|---------------------|--------------------------|
| Fork-based | ✅ | ❌ |
| Timestamp-based | ✅ | ✅ |

### Results After Timestamp-Based Pruning

| File | Before | After | Records Removed | Duplicate Groups |
|------|--------|-------|-----------------|------------------|
| 5c22b36d | 1413 | 656 | 757 | 69 → **0** |
| f812be97 | 428 | 135 | 293 | 44 → **0** |

### Note: Signature Dedup vs Branch Pruning

The algorithm has two deduplication phases:
1. **Phase 1: Signature dedup** - Removes assistant records with identical thinking signatures
2. **Phase 3-6: Branch pruning** - Removes phantom branches based on timestamp grouping

Analysis shows that duplicate thinking records are **children of phantom image branches**:

| File | Duplicate Signature Groups | After Branch Pruning Alone |
|------|---------------------------|---------------------------|
| 5c22b36d | 77 | 0 remaining |
| f812be97 | 49 | 0 remaining |

This means signature dedup (Phase 1) is technically redundant - branch pruning handles everything.

**Why we keep both:**
1. **Defense in depth** - Handles edge cases where duplicates might not be in phantom branches
2. **Performance** - Fewer records to process in later phases
3. **Safety** - If timestamp grouping misses something, signature dedup catches it

### Assistant Record Deduplication by Content

Even after phantom branch pruning, some phantom assistant records may survive (e.g., when the phantom root user record wasn't identified as a phantom due to having "different non-empty text"). These phantom assistant records have:

- **Same requestId** - same Claude API request
- **Same messageId** - same Claude API response (e.g., `msg_01En82gokp8XpJUb`)
- **Same timestamp**
- **Identical content** (thinking, text, tool_use)
- **Different UUIDs** (different log records from phantom branches)

When `mergeAssistantRecords()` groups records by `requestId`, phantom branch duplicates get combined, causing:
- Duplicate `[Thinking]` content (same thinking appended twice)
- Duplicate `[Response]` text (same text appended twice)
- Duplicate tool_use entries (same tool call pushed twice)

**IMPORTANT:** We must deduplicate by **content**, NOT by messageId!

Claude Code logs each content type (thinking, text, tool_use) in SEPARATE records with the SAME messageId. If we skip records by messageId, we lose the text/response content entirely.

**Solution:** Deduplicate by content signature/prefix within each `requestId` group:

```typescript
// mergeAssistantRecords() in claude-code-parser.ts
const seenThinkingSignatures = new Set<string>();
const seenTextContent = new Set<string>();
const seenToolUseIds = new Set<string>();

for (const record of records) {
  const msg = record.message as AssistantMessage;
  if (!msg?.content) continue;

  for (const content of msg.content) {
    if (content.type === 'thinking') {
      // Deduplicate by signature (if available) or content prefix
      const dedupeKey = content.signature || content.thinking.slice(0, 200);
      if (!seenThinkingSignatures.has(dedupeKey)) {
        seenThinkingSignatures.add(dedupeKey);
        response.thinking = (response.thinking || '') + content.thinking;
      }
    } else if (content.type === 'text') {
      // Deduplicate by text content prefix
      const dedupeKey = content.text.slice(0, 200);
      if (!seenTextContent.has(dedupeKey)) {
        seenTextContent.add(dedupeKey);
        response.text = (response.text || '') + content.text;
      }
    } else if (content.type === 'tool_use') {
      // Deduplicate by tool_use_id
      if (!seenToolUseIds.has(content.id)) {
        seenToolUseIds.add(content.id);
        response.toolCalls.push({...});
      }
    }
  }
}
```

### Implementation Locations

| Component | File | Method |
|-----------|------|--------|
| Workflow/ChatLog | `src/lib/parsers/claude-code-parser.ts` | `prunePhantomBranches()` |
| Annotation View | `src/lib/annotation/preprocessor.ts` | `prunePhantomBranches()` |
| Assistant Merging | `src/lib/parsers/claude-code-parser.ts` | `mergeAssistantRecords()` |

Branch pruning runs **before** topological sorting. Assistant deduplication runs during record merging.

---

## Topological Sort Implementation Locations

| Component | File | Method | Algorithm |
|-----------|------|--------|-----------|
| Workflow/ChatLog | `src/lib/parsers/claude-code-parser.ts` | `topologicalSortRecords()` | DFS (legacy) |
| Annotation View | `src/lib/annotation/preprocessor.ts` | `topologicalSort()` | **Kahn's + Priority Queue** |

> **Note**: The Annotation View uses the improved Kahn's algorithm. The Workflow/ChatLog implementation should be updated to match for full consistency.

---

## Verification

To verify ordering is correct, check that:
1. No child appears before its parent (topological correctness)
2. Records are as chronological as possible (optimal ordering)

```typescript
const uuidToIndex = new Map(records.map((r, i) => [r.uuid, i]));

for (const record of records) {
  if (record.parentUuid && uuidToIndex.has(record.parentUuid)) {
    const parentIdx = uuidToIndex.get(record.parentUuid);
    const myIdx = uuidToIndex.get(record.uuid);
    if (parentIdx > myIdx) {
      console.error('VIOLATION: child before parent');
    }
  }
}
```

---

## Summary: The Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RAW JSONL RECORDS                            │
│  (may contain duplicates, phantom branches, out-of-order records)   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PHASE 1: DEDUPLICATION (Signature Matching)            │
│                                                                     │
│  • Assistant records: dedupe by thinking signature                  │
│  • Removes exact duplicate content from logging bugs                │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│           PHASE 2: BRANCH RESOLUTION (Phantom Pruning)              │
│                                                                     │
│  • Group user INPUT records by timestamp                            │
│  • Keep richest record (most content blocks) as "main"              │
│  • Mark others as phantom roots (unless different text)             │
│  • BFS to collect all descendants of phantom roots                  │
│  • Filter out all phantom branch records                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│           PHASE 3: FINAL ORDERING (Kahn's Algorithm)                │
│                                                                     │
│  • Build parent → children relationships                            │
│  • Initialize priority queue with "ready" records (roots/orphans)   │
│  • Loop: pop earliest timestamp, add to result, mark children ready │
│  • Result: chronological order + parent-before-child guarantee      │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ORDERED ANNOTATION RECORDS                     │
│  (clean, deduplicated, chronologically optimal, tree-respecting)    │
└─────────────────────────────────────────────────────────────────────┘
```
