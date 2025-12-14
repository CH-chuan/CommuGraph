# Record Ordering: Topological Sort via Parent-Child UUID Chain

This document explains how CommuGraph orders records from Claude Code sessions. The ordering algorithm is **shared across all views** (Workflow View, Annotation View, Chat Log) to ensure consistent sequencing.

## Why Not Timestamp Sorting?

Claude Code is asynchronous. Multiple records can have the **same timestamp** but belong to different parts of the conversation tree. Timestamp sorting produces incorrect ordering in these cases:

```
Problem: Two records at 2025-12-09T20:46:53.669Z
- Record A: Line 800, part of conversation branch 1
- Record B: Line 1048, part of conversation branch 2

Timestamp sort: [A, B] adjacent (WRONG - they're unrelated)
Topological sort: [A, ...many records..., B] separated by tree structure (CORRECT)
```

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

## Topological Sort Algorithm

### Overview

```
1. Build uuid → record map (for all UUIDs)
2. Build parent → children adjacency map
3. DFS from roots, processing children in timestamp order
4. Handle orphans (records whose parent is not in set)
```

### Step 1: Build UUID Map

For merged responses (grouped assistant records), register **all** UUIDs:
- Main record UUID
- All tool call UUIDs (children may reference these)

```typescript
const byUuid = new Map<string, Record>();
for (const record of records) {
  for (const uuid of record.allUuids) {
    byUuid.set(uuid, record);
  }
}
```

### Step 2: Build Children Adjacency

Group records by their effective parent UUID:

```typescript
const children = new Map<string | null, Record[]>();
for (const record of records) {
  // Use logicalParentUuid for context compaction continuity
  const parentUuid = record.logicalParentUuid ?? record.parentUuid ?? null;
  children.get(parentUuid)?.push(record) || children.set(parentUuid, [record]);
}
```

### Step 3: DFS with Timestamp Tiebreaker

Process children in timestamp order (for siblings):

```typescript
function dfs(uuid: string | null) {
  const childRecords = children.get(uuid) || [];

  // SIBLINGS: Sort by timestamp as tiebreaker
  childRecords.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const record of childRecords) {
    if (visited.has(record)) continue;
    visited.add(record);

    result.push(record);

    // Continue DFS from this record's UUIDs
    for (const uuid of record.allUuids) {
      dfs(uuid);
    }
  }
}

// Start from null parent (roots)
dfs(null);
```

### Step 4: Handle Orphans

Records whose `parentUuid` references a UUID not in our processable set:

```typescript
// Find unvisited records (orphans)
const orphans = records.filter(r => !visited.has(r));

// ORPHANS: Sort by timestamp
orphans.sort((a, b) =>
  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
);

// Process each orphan as a new root
for (const orphan of orphans) {
  if (visited.has(orphan)) continue;
  visited.add(orphan);
  result.push(orphan);

  // Process orphan's children
  for (const uuid of orphan.allUuids) {
    dfs(uuid);
  }
}
```

## Handling Specific Cases

### 1. Siblings (Children with Same Parent)

**Scenario:** Multiple records share the same `parentUuid`

```
Parent A
├── Child B (timestamp: 10:00:01)
├── Child C (timestamp: 10:00:02)
└── Child D (timestamp: 10:00:03)
```

**Handling:** Sort siblings by timestamp, then process depth-first.

**Result order:** `[A, B, B's children..., C, C's children..., D, D's children...]`

### 2. Orphans

**Scenario:** Record's `parentUuid` points to a UUID not in our set

**Why orphans exist:**
- Parent was filtered out (e.g., `file-history-snapshot`, `queue-operation`)
- Parent is in a sub-agent file not loaded
- First record in session (may reference previous session)

**Handling:**
1. After main DFS, find all unvisited records
2. Sort orphans by timestamp
3. Process each orphan as a new "root" and DFS its children

**Example:**
```
Main Tree (parentUuid chain intact):
  Root1 → Child1 → Child2

Orphan Tree (parentUuid not found):
  Orphan1 → OrphanChild1
  Orphan2 → OrphanChild2

Result: [Root1, Child1, Child2, Orphan1, OrphanChild1, Orphan2, OrphanChild2]
```

### 3. Context Compaction (logicalParentUuid)

**Scenario:** Context limit reached, conversation "restarts" with summary

When context is compacted:
1. A `system` record with `subtype: "compact_boundary"` is created
2. It has `parentUuid: null` (appears as new root)
3. It has `logicalParentUuid` pointing to the last record before compaction

**Handling:** Use `logicalParentUuid ?? parentUuid` to maintain conversation continuity:

```typescript
const effectiveParent = record.logicalParentUuid ?? record.parentUuid;
```

### 4. Merged Responses (Grouped Assistant Records)

**Scenario:** Multiple JSONL lines grouped by `requestId` into one logical record

A merged response contains:
- Main UUID (first chunk's UUID)
- Tool call UUIDs (each `tool_use` block has its own UUID in raw records)

**Handling:** Register all UUIDs in the map so children can reference any of them:

```typescript
allUuids: [response.uuid, ...response.toolCalls.map(tc => tc.uuid)]
```

## Pre-Processing: Deduplication

Before ordering, records are deduplicated to handle Claude Code logging bugs.

### The Problem

Claude Code sometimes logs the same content multiple times with different UUIDs, creating **phantom branches** in the conversation tree.

#### Type 1: Assistant Records (Signature Duplicates)

Multiple records with the same thinking content and signature:

```
Line 10:  uuid=68ad3e2f, parentUuid=2da22b59, signature=EfYD..., timestamp=15:23:35
Line 196: uuid=ecde71ae, parentUuid=d6adb465, signature=EfYD..., timestamp=15:23:35
                                              ^^^^^^^^^^^^
                                              SAME signature!
```

#### Type 2: User Records (Partial Content Duplicates)

The same user message logged multiple times at the same timestamp, but with **different content richness**. One record contains the full content, the other contains partial content:

```
Line 737: uuid=461dbbb6, parentUuid=e15b4dfc, content=[image,image,text], timestamp=20:26:17
Line 983: uuid=2dace94c, parentUuid=e15b4dfc, content=[image], timestamp=20:26:17
          ^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^            ^^^^^^^^
          DIFFERENT uuid  SAME parentUuid+timestamp        PARTIAL content!

Line 737 has 3 content blocks (full)
Line 983 has 1 content block (partial) ← Creates phantom branch
```

### Impact

These duplicates create **fork points** where one UUID becomes the parent of two different conversation branches. Both branches appear valid but one is a ghost branch from partial logging.

In sample files:
- `5c22b36d`: 1 fork point → 67 records in phantom branch
- `f812be97`: 1 fork point → 50 records in phantom branch

### Solution

**Phase 1: Assistant Record Deduplication**

For records with thinking content, deduplicate where ALL match:
- `signature` (first 60 chars)
- `message.id`
- `requestId`
- `timestamp`

Keep the **first occurrence** (lower line number).

**Phase 2: User Record Deduplication**

For user records with array content, group by:
- `parentUuid`
- `timestamp`

Keep the record with **most content blocks** (richest content). If tied, keep first occurrence.

```typescript
// Phase 1: Assistant deduplication key
const assistantKey = [
  'assistant',
  signature.slice(0, 60),
  msg.id || '',
  record.requestId || '',
  record.timestamp || '',
].join('|');

// Phase 2: User deduplication - group by key, keep richest
const userGroupKey = `${record.parentUuid}|${record.timestamp}`;
// Group all user records with array content by this key
// Keep the one with highest content.length
```

### Results After Deduplication

| File | Records Before | Records After | Removed | Fork Points |
|------|----------------|---------------|---------|-------------|
| 5c22b36d | 1413 | 1346 | 67 | 1 → **0** |
| f812be97 | 428 | 378 | 50 | 1 → **0** |

### Implementation Locations

| Component | File | Method |
|-----------|------|--------|
| Workflow/ChatLog | `src/lib/parsers/claude-code-parser.ts` | `deduplicateRecords()` |
| Annotation View | `src/lib/annotation/preprocessor.ts` | `deduplicateRecords()` |

Deduplication runs **before** topological sorting.

---

## Topological Sort Implementation Locations

| Component | File | Method |
|-----------|------|--------|
| Workflow/ChatLog | `src/lib/parsers/claude-code-parser.ts` | `topologicalSortRecords()` |
| Annotation View | `src/lib/annotation/preprocessor.ts` | `topologicalSort()` |

Both implementations follow the same algorithm to ensure consistent ordering across all views.

## Verification

To verify ordering is correct, check that no child appears before its parent:

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
