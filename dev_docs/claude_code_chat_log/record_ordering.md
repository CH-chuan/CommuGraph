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

### Assistant Record Deduplication by messageId

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

**Solution:** Deduplicate by `messageId` within each `requestId` group:

```typescript
// mergeAssistantRecords() in claude-code-parser.ts
const processedMessageIds = new Set<string>();
const seenToolUseIds = new Set<string>();

for (const record of records) {
  const msg = record.message as AssistantMessage;
  if (!msg?.content) continue;

  // Skip if we've already processed a record with this messageId
  // (phantom branches have same messageId but different UUIDs)
  if (processedMessageIds.has(msg.id)) {
    continue;
  }
  processedMessageIds.add(msg.id);

  for (const content of msg.content) {
    if (content.type === 'thinking') {
      response.thinking = (response.thinking || '') + content.thinking;
    } else if (content.type === 'text') {
      response.text = (response.text || '') + content.text;
    } else if (content.type === 'tool_use') {
      // Additional safety: deduplicate by tool_use_id
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
