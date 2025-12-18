/**
 * Annotation Preprocessor for Claude Code Logs (v0.2)
 *
 * Transforms raw Claude Code JSONL into intermediate JSONL format
 * ready for annotation according to annotation_schema_v02.yaml.
 *
 * Unit types produced:
 * - assistant_turn: All content from one model turn (thinking + text + tool calls)
 *                   with tool_summary for tool execution status
 * - user_turn: Direct user input (not tool results or meta)
 *
 * Tool results are NOT separate units - they populate tool_summary on assistant_turn.
 *
 * Focus: Main agent only (isSidechain=false)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  type AnnotationRecord,
  type RawLogRecord,
  type AssistantMessage,
  type UserMessage,
  type ToolUseContent,
  type ToolResultContent,
  type ThinkingContent,
  type TextContent,
  type SourcePointers,
  type ToolSummary,
  type ToolCallSummary,
  type ImageContent,
  type UserTextContent,
  makeAssistantEventId,
  makeUserTurnEventId,
  makeSystemTurnEventId,
} from './types';

// ============================================================================
// Interfaces for Grouping
// ============================================================================

interface AssistantTurn {
  requestId?: string;
  messageId: string;
  timestamp: string;
  rawUuids: string[];
  lineNumbers: number[];
  thinkingBlocks: string[];
  textBlocks: string[];
  toolUseBlocks: ToolUseContent[];
  model: string;
  isSidechain: boolean;
  agentId?: string;
  parentUuid: string | null;
}

interface ToolResultInfo {
  uuid: string;
  timestamp: string;
  lineNumber: number;
  isError: boolean;
}

interface ParsedLine {
  lineNumber: number;
  record: RawLogRecord;
}

// ============================================================================
// Preprocessor Class
// ============================================================================

export class AnnotationPreprocessor {
  private records: ParsedLine[] = [];
  private sessionId: string = '';
  private rawFile: string = '';

  /**
   * Parse JSONL file into records with line numbers.
   */
  parseFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.rawFile = path.basename(filePath);
    this.parseContent(content);
  }

  /**
   * Parse JSONL content string into records with line numbers.
   * Use this for in-memory parsing without file access.
   */
  parseContent(content: string, filename?: string): void {
    if (filename) {
      this.rawFile = filename;
    }
    this.records = [];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const record = JSON.parse(line) as RawLogRecord;
        this.records.push({ lineNumber: i + 1, record });

        // Capture sessionId from first conversational record
        if (!this.sessionId && record.sessionId) {
          this.sessionId = record.sessionId;
        }
      } catch {
        console.warn(`Skipping invalid JSON on line ${i + 1}`);
      }
    }

    // Prune phantom branches (handles Claude Code logging bug)
    this.records = this.prunePhantomBranches(this.records);
  }

  /**
   * Prune phantom branches caused by Claude Code logging bug.
   *
   * Claude Code sometimes logs the same user message multiple times with different
   * UUIDs when images are involved. These duplicates share the same timestamp but
   * may have different parentUuids and content richness.
   *
   * Strategy (timestamp-based):
   * 1. Deduplicate assistant records by signature
   * 2. Group user records (with array content) by timestamp
   * 3. For each timestamp group with multiple records, keep only the richest one
   * 4. Collect all UUIDs in phantom branches (descendants of partial records)
   * 5. Exclude all records in phantom branches
   */
  private prunePhantomBranches(records: ParsedLine[]): ParsedLine[] {
    // Phase 1: Deduplicate assistant records by signature
    const assistantSeen = new Set<string>();
    const afterAssistantDedup: ParsedLine[] = [];

    for (const parsed of records) {
      const record = parsed.record;

      if (record.type === 'assistant') {
        const msg = record.message as AssistantMessage | undefined;
        if (msg?.content && Array.isArray(msg.content)) {
          // Find signature in thinking content
          let signature: string | undefined;
          for (const c of msg.content) {
            if (c.type === 'thinking' && (c as ThinkingContent).signature) {
              signature = (c as ThinkingContent).signature;
              break;
            }
          }

          if (signature) {
            const key = [
              'assistant',
              signature.slice(0, 60),
              msg.id || '',
              record.requestId || '',
              record.timestamp || '',
            ].join('|');

            if (assistantSeen.has(key)) {
              continue; // Duplicate - skip
            }
            assistantSeen.add(key);
          }
        }
      }
      afterAssistantDedup.push(parsed);
    }

    // Phase 2: Build parent -> children map for BFS traversal later
    const childrenMap = new Map<string | null, ParsedLine[]>();
    for (const parsed of afterAssistantDedup) {
      const parent = parsed.record.parentUuid ?? null;
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent)!.push(parsed);
    }

    // Phase 3: Group USER INPUT records by timestamp for phantom branch detection
    // The phantom branch bug causes Claude Code to log the same user message multiple
    // times with different UUIDs. This affects:
    // - Image messages: split into multiple records (image, image, text separately)
    // - Text messages: logged twice with different formats (string vs array with text)
    //
    // We should SKIP tool_result records - multiple tool results at the same timestamp
    // are legitimate (parallel tool calls returning together).
    //
    // We should INCLUDE all other user records (string content, or array with images/text).
    const timestampGroups = new Map<string, ParsedLine[]>();
    for (const parsed of afterAssistantDedup) {
      const record = parsed.record;
      if (record.type !== 'user') continue;
      const msg = record.message as UserMessage | undefined;
      if (!msg?.content) continue;

      // Skip records that contain tool_result - these are tool execution results, not user input
      if (Array.isArray(msg.content)) {
        const hasToolResult = msg.content.some(
          (c): c is ToolResultContent => c.type === 'tool_result'
        );
        if (hasToolResult) continue;
      }

      const ts = record.timestamp;
      if (!timestampGroups.has(ts)) timestampGroups.set(ts, []);
      timestampGroups.get(ts)!.push(parsed);
    }

    // Phase 4: Identify phantom roots (subset duplicates at same timestamp)
    // Rule: The richest record (most content blocks) is the main.
    //       ALL others are phantoms UNLESS they have different non-empty text
    //       (which indicates a legitimate parallel branch, not a duplicate).
    const phantomBranchRoots: ParsedLine[] = [];

    // Helper to extract text content for comparison
    const extractTextContent = (p: ParsedLine): string => {
      const msg = p.record.message as UserMessage;
      if (typeof msg.content === 'string') return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter((c): c is TextContent => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      }
      return '';
    };

    // Helper to count content blocks (for richness comparison)
    const getContentCount = (p: ParsedLine): number => {
      const msg = p.record.message as UserMessage;
      if (typeof msg.content === 'string') return 1;
      return Array.isArray(msg.content) ? msg.content.length : 0;
    };

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
          phantomBranchRoots.push(rec);
        }
      }
    }

    // Phase 5: Collect all UUIDs in phantom branches (BFS from phantom roots)
    const phantomUuids = new Set<string>();

    for (const root of phantomBranchRoots) {
      const queue = [root];
      while (queue.length > 0) {
        const parsed = queue.shift()!;
        if (phantomUuids.has(parsed.record.uuid)) continue;
        phantomUuids.add(parsed.record.uuid);

        // Add children of this record to queue
        const children = childrenMap.get(parsed.record.uuid) || [];
        queue.push(...children);
      }
    }

    // Phase 6: Filter out phantom branch records
    return afterAssistantDedup.filter(p => !phantomUuids.has(p.record.uuid));
  }

  /**
   * Filter to main agent only (isSidechain=false).
   */
  private filterMainAgent(): ParsedLine[] {
    return this.records.filter(({ record }) => {
      // Skip non-conversational types
      if (record.type === 'file-history-snapshot') return false;
      if (record.type === 'queue-operation') return false;

      // Only main agent
      return record.isSidechain === false;
    });
  }

  /**
   * Check if a user record is a direct user prompt (not tool result or meta).
   * Now supports mixed content arrays with images + text.
   */
  private isUserPrompt(record: RawLogRecord): boolean {
    if (record.type !== 'user') return false;
    if (record.isMeta) return false;
    // Skip compact summary records (will be merged with system_turn)
    if (record.isCompactSummary) return false;

    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg) return false;

    // String content - original logic
    if (typeof userMsg.content === 'string') {
      const content = userMsg.content;

      // Skip system-generated messages (but NOT <command-name> which are user slash commands)
      if (content.includes('<local-command-')) return false;
      if (content.includes('<bash-notification>')) return false;

      // Skip empty content (but allow short messages like "yes", "ok")
      if (content.trim().length === 0) return false;

      return true;
    }

    // Array content - check if it contains text or image (not just tool_results)
    if (Array.isArray(userMsg.content)) {
      const hasUserContent = userMsg.content.some(
        item => item.type === 'text' || item.type === 'image'
      );
      // Skip if only tool results
      if (!hasUserContent) return false;

      // Extract text to check for system-generated messages (but NOT <command-name> which are user slash commands)
      const textContent = this.extractTextFromMixedContent(userMsg.content);
      if (textContent.includes('<local-command-')) return false;
      if (textContent.includes('<bash-notification>')) return false;

      // Check if there's meaningful content (text or images)
      const hasImages = userMsg.content.some(item => item.type === 'image');
      if (hasImages) return true; // Images are always meaningful

      // Check text length (allow short messages, but require non-empty)
      if (textContent.trim().length === 0) return false;

      return true;
    }

    return false;
  }

  /**
   * Extract text content from mixed content array.
   */
  private extractTextFromMixedContent(content: UserMessage['content']): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    const textParts: string[] = [];
    for (const item of content) {
      if (item.type === 'text') {
        textParts.push((item as UserTextContent).text);
      }
    }
    return textParts.join('\n');
  }

  /**
   * Extract images from mixed content array.
   */
  private extractImagesFromMixedContent(content: UserMessage['content']): { mediaType: string; data: string }[] | undefined {
    if (typeof content === 'string') return undefined;
    if (!Array.isArray(content)) return undefined;

    const images: { mediaType: string; data: string }[] = [];
    for (const item of content) {
      if (item.type === 'image') {
        const imgItem = item as ImageContent;
        if (imgItem.source?.type === 'base64' && imgItem.source.data) {
          images.push({
            mediaType: imgItem.source.media_type,
            data: imgItem.source.data,
          });
        }
      }
    }
    return images.length > 0 ? images : undefined;
  }

  /**
   * Check if a user record contains tool results.
   */
  private isToolResult(record: RawLogRecord): boolean {
    if (record.type !== 'user') return false;

    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg) return false;

    if (!Array.isArray(userMsg.content)) return false;

    return userMsg.content.some(
      (c): c is ToolResultContent => c.type === 'tool_result'
    );
  }

  /**
   * Extract tool results from a user record.
   * Returns map of tool_use_id -> result info
   */
  private extractToolResults(record: RawLogRecord, lineNumber: number): Map<string, ToolResultInfo> {
    const results = new Map<string, ToolResultInfo>();

    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg || !Array.isArray(userMsg.content)) return results;

    for (const item of userMsg.content) {
      if (item.type !== 'tool_result') continue;

      const toolResult = item as ToolResultContent;
      results.set(toolResult.tool_use_id, {
        uuid: record.uuid,
        timestamp: record.timestamp,
        lineNumber,
        isError: toolResult.is_error ?? false,
      });
    }

    return results;
  }

  /**
   * Group assistant records by (requestId, messageId) to form turns.
   */
  private groupAssistantTurns(mainRecords: ParsedLine[]): Map<string, AssistantTurn> {
    const turns = new Map<string, AssistantTurn>();

    for (const { lineNumber, record } of mainRecords) {
      if (record.type !== 'assistant') continue;

      const assistantMsg = record.message as AssistantMessage | undefined;
      if (!assistantMsg) continue;

      // Use requestId:messageId as key, fallback to just messageId
      const key = record.requestId
        ? `${record.requestId}:${assistantMsg.id}`
        : `:${assistantMsg.id}`;

      let turn = turns.get(key);
      if (!turn) {
        turn = {
          requestId: record.requestId,
          messageId: assistantMsg.id,
          timestamp: record.timestamp,
          rawUuids: [],
          lineNumbers: [],
          thinkingBlocks: [],
          textBlocks: [],
          toolUseBlocks: [],
          model: assistantMsg.model,
          isSidechain: record.isSidechain,
          agentId: record.agentId,
          parentUuid: record.parentUuid,
        };
        turns.set(key, turn);
      }

      turn.rawUuids.push(record.uuid);
      turn.lineNumbers.push(lineNumber);

      // Update timestamp to earliest
      if (new Date(record.timestamp) < new Date(turn.timestamp)) {
        turn.timestamp = record.timestamp;
      }

      // Extract content blocks
      for (const content of assistantMsg.content) {
        if (content.type === 'thinking') {
          const thinking = content as ThinkingContent;
          if (thinking.thinking) {
            turn.thinkingBlocks.push(thinking.thinking);
          }
        } else if (content.type === 'text') {
          const text = content as TextContent;
          if (text.text) {
            turn.textBlocks.push(text.text);
          }
        } else if (content.type === 'tool_use') {
          turn.toolUseBlocks.push(content as ToolUseContent);
        }
      }
    }

    return turns;
  }

  /**
   * Build tool results index: tool_use_id -> ToolResultInfo[]
   */
  private buildToolResultsIndex(mainRecords: ParsedLine[]): Map<string, ToolResultInfo[]> {
    const index = new Map<string, ToolResultInfo[]>();

    for (const { lineNumber, record } of mainRecords) {
      if (!this.isToolResult(record)) continue;

      const results = this.extractToolResults(record, lineNumber);
      for (const [toolUseId, resultInfo] of results) {
        const existing = index.get(toolUseId) || [];
        existing.push(resultInfo);
        index.set(toolUseId, existing);
      }
    }

    return index;
  }

  /**
   * Build tool_summary for an assistant turn.
   */
  private buildToolSummary(
    turn: AssistantTurn,
    toolResultsIndex: Map<string, ToolResultInfo[]>
  ): ToolSummary | undefined {
    if (turn.toolUseBlocks.length === 0) {
      return undefined;
    }

    const toolCalls: ToolCallSummary[] = [];

    for (const toolUse of turn.toolUseBlocks) {
      const results = toolResultsIndex.get(toolUse.id) || [];
      const hasError = results.some(r => r.isError);

      toolCalls.push({
        tool_use_id: toolUse.id,
        tool_name: toolUse.name,
        success: results.length > 0 && !hasError,
        is_error: hasError,
        result_count: results.length,
      });
    }

    return { tool_calls: toolCalls };
  }

  /**
   * Sort annotation records using Kahn's algorithm with timestamp-based priority.
   *
   * This produces an ordering that:
   * 1. Respects tree structure (parents always before children)
   * 2. Maximizes chronological order (earlier timestamps first among unrelated records)
   *
   * Algorithm:
   * - Use a priority queue (sorted by timestamp) instead of DFS
   * - Start with all "ready" records (those whose parents are already processed or don't exist)
   * - Always pick the ready record with the earliest timestamp
   * - When a record is processed, its children may become ready
   *
   * This is more robust than DFS because it doesn't process entire branches
   * before considering other branches - it interleaves based on timestamp.
   */
  private topologicalSort(records: AnnotationRecord[]): AnnotationRecord[] {
    if (records.length === 0) return [];

    // Build uuid -> record map
    // Register ALL raw_uuids since children may reference any of them
    const byUuid = new Map<string, AnnotationRecord>();
    for (const record of records) {
      for (const uuid of record.source.raw_uuids || []) {
        byUuid.set(uuid, record);
      }
    }

    // Build record -> parent record mapping
    const parentOf = new Map<AnnotationRecord, AnnotationRecord | null>();
    for (const record of records) {
      const parentUuid = record.source.parent_uuid;
      if (parentUuid && byUuid.has(parentUuid)) {
        parentOf.set(record, byUuid.get(parentUuid)!);
      } else {
        parentOf.set(record, null); // Root or orphan (parent not in our set)
      }
    }

    // Track which records have been processed
    const processed = new Set<AnnotationRecord>();
    const result: AnnotationRecord[] = [];

    // Helper to get timestamp for sorting
    const getTimestamp = (r: AnnotationRecord): number =>
      r.timestamp ? new Date(r.timestamp).getTime() : 0;

    // Helper to check if a record is ready (parent processed or no parent)
    const isReady = (r: AnnotationRecord): boolean => {
      const parent = parentOf.get(r);
      return parent === null || parent === undefined || processed.has(parent);
    };

    // Initialize with all ready records, sorted by timestamp
    // Use an array as a simple priority queue (re-sort when needed)
    const readyQueue = records.filter(isReady);
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

    // Process records in timestamp order, respecting dependencies
    while (readyQueue.length > 0) {
      // Take the record with earliest timestamp
      const record = readyQueue.shift()!;

      if (processed.has(record)) continue;
      processed.add(record);
      result.push(record);

      // Check if any children are now ready
      const children = childrenOf.get(record) || [];
      const newlyReady: AnnotationRecord[] = [];
      for (const child of children) {
        if (!processed.has(child) && isReady(child)) {
          newlyReady.push(child);
        }
      }

      // Insert newly ready records into queue (maintain sorted order)
      if (newlyReady.length > 0) {
        readyQueue.push(...newlyReady);
        readyQueue.sort((a, b) => getTimestamp(a) - getTimestamp(b));
      }
    }

    // Handle any remaining unvisited records (shouldn't happen in well-formed data)
    // These would be records in cycles or with other issues
    const remaining = records.filter(r => !processed.has(r));
    if (remaining.length > 0) {
      console.warn(`topologicalSort: ${remaining.length} records could not be ordered (possible cycle or data issue)`);
      remaining.sort((a, b) => getTimestamp(a) - getTimestamp(b));
      result.push(...remaining);
    }

    return result;
  }

  /**
   * Generate annotation records from parsed data.
   */
  generateAnnotationRecords(): AnnotationRecord[] {
    const mainRecords = this.filterMainAgent();
    const turns = this.groupAssistantTurns(mainRecords);
    const toolResultsIndex = this.buildToolResultsIndex(mainRecords);

    const output: AnnotationRecord[] = [];

    // 1. Generate user_turn records
    for (const { lineNumber, record } of mainRecords) {
      if (!this.isUserPrompt(record)) continue;

      const userMsg = record.message as UserMessage;
      const textContent = this.extractTextFromMixedContent(userMsg.content);
      const images = this.extractImagesFromMixedContent(userMsg.content);

      output.push({
        session_id: this.sessionId,
        event_id: makeUserTurnEventId(record.uuid),
        actor_id: 'human',
        actor_type: 'human',
        unit_type: 'user_turn',
        source: {
          raw_file: this.rawFile,
          raw_line_range: [lineNumber, lineNumber],
          raw_uuids: [record.uuid],
          is_sidechain: false,
          parent_uuid: record.parentUuid,
        },
        timestamp: record.timestamp,
        text_or_artifact_ref: {
          text: textContent,
          images,
        },
        labels: [],
      });
    }

    // 2. Generate assistant_turn records
    for (const [, turn] of turns) {
      // Build structured text_or_artifact_ref
      const hasThinking = turn.thinkingBlocks.length > 0;
      const hasText = turn.textBlocks.length > 0;
      const hasTools = turn.toolUseBlocks.length > 0;

      // Skip turns with no content
      if (!hasThinking && !hasText && !hasTools) continue;

      const source: SourcePointers = {
        raw_file: this.rawFile,
        raw_line_range: [Math.min(...turn.lineNumbers), Math.max(...turn.lineNumbers)],
        raw_uuids: turn.rawUuids,
        request_id: turn.requestId,
        message_id: turn.messageId,
        is_sidechain: false,
        parent_uuid: turn.parentUuid,
      };

      // Add tool_use_ids if present
      if (hasTools) {
        source.tool_use_ids = turn.toolUseBlocks.map(t => t.id);
      }

      const toolSummary = this.buildToolSummary(turn, toolResultsIndex);

      // Build structured text_or_artifact_ref
      const textOrArtifactRef: {
        thinking?: string;
        text?: string;
        tool_calls?: { tool_use_id: string; tool_name: string; input: Record<string, unknown> }[];
      } = {};

      if (hasThinking) {
        textOrArtifactRef.thinking = turn.thinkingBlocks.join('\n\n');
      }
      if (hasText) {
        textOrArtifactRef.text = turn.textBlocks.join('\n\n');
      }
      if (hasTools) {
        textOrArtifactRef.tool_calls = turn.toolUseBlocks.map(t => ({
          tool_use_id: t.id,
          tool_name: t.name,
          input: t.input,
        }));
      }

      const record: AnnotationRecord = {
        session_id: this.sessionId,
        event_id: makeAssistantEventId(turn.requestId, turn.messageId),
        actor_id: 'assistant',
        actor_type: 'agent',
        agent_kind: 'main',
        unit_type: 'assistant_turn',
        source,
        timestamp: turn.timestamp,
        text_or_artifact_ref: textOrArtifactRef,
        labels: [],
      };

      if (toolSummary) {
        record.tool_summary = toolSummary;
      }

      output.push(record);
    }

    // 3. Generate system_turn records for context compaction
    // Build index of compact summary records by parentUuid
    const compactSummaryByParentUuid = new Map<string, { lineNumber: number; record: RawLogRecord }>();
    for (const { lineNumber, record } of mainRecords) {
      if (record.type === 'user' && record.isCompactSummary && record.parentUuid) {
        compactSummaryByParentUuid.set(record.parentUuid, { lineNumber, record });
      }
    }

    // Find compact_boundary system records and merge with summaries
    for (const { lineNumber, record } of mainRecords) {
      if (record.type !== 'system' || record.subtype !== 'compact_boundary') continue;

      // Look up matching compact summary
      const summaryEntry = compactSummaryByParentUuid.get(record.uuid);
      let summaryContent = '';
      const rawUuids = [record.uuid];
      const lineNumbers = [lineNumber];

      if (summaryEntry) {
        const userMsg = summaryEntry.record.message as UserMessage | undefined;
        if (userMsg && typeof userMsg.content === 'string') {
          summaryContent = userMsg.content;
        }
        rawUuids.push(summaryEntry.record.uuid);
        lineNumbers.push(summaryEntry.lineNumber);
      }

      output.push({
        session_id: this.sessionId,
        event_id: makeSystemTurnEventId(record.uuid),
        actor_id: 'system',
        actor_type: 'system',
        unit_type: 'system_turn',
        source: {
          raw_file: this.rawFile,
          raw_line_range: [Math.min(...lineNumbers), Math.max(...lineNumbers)],
          raw_uuids: rawUuids,
          is_sidechain: false,
          // Use logicalParentUuid for context compaction continuity
          parent_uuid: record.logicalParentUuid ?? record.parentUuid,
        },
        timestamp: record.timestamp,
        text_or_artifact_ref: {
          text: summaryContent || record.content || 'Context compacted',
        },
        labels: [],
        // Store compact metadata for UI display
        compact_metadata: record.compactMetadata,
      });
    }

    // 4. Generate system_turn records for other system messages (api_error, etc.)
    for (const { lineNumber, record } of mainRecords) {
      if (record.type !== 'system') continue;
      // Skip compact_boundary (already handled above)
      if (record.subtype === 'compact_boundary') continue;
      // Skip records without subtype (shouldn't happen but be safe)
      if (!record.subtype) continue;

      output.push({
        session_id: this.sessionId,
        event_id: makeSystemTurnEventId(record.uuid),
        actor_id: 'system',
        actor_type: 'system',
        unit_type: 'system_turn',
        source: {
          raw_file: this.rawFile,
          raw_line_range: [lineNumber, lineNumber],
          raw_uuids: [record.uuid],
          is_sidechain: false,
          parent_uuid: record.parentUuid,
        },
        timestamp: record.timestamp,
        text_or_artifact_ref: {
          text: record.content || record.subtype || 'System event',
        },
        labels: [],
        // Store subtype for UI display
        system_subtype: record.subtype,
      });
    }

    // Sort by parent-child relationship chain (topological order)
    return this.topologicalSort(output);
  }

  /**
   * Write annotation records to JSONL file.
   */
  writeJsonl(records: AnnotationRecord[], outputPath: string): void {
    const lines = records.map(r => JSON.stringify(r));
    fs.writeFileSync(outputPath, lines.join('\n') + '\n');
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: npx tsx src/lib/annotation/preprocessor.ts <input.jsonl> [output.jsonl]');
    console.log('');
    console.log('Preprocesses Claude Code JSONL into annotation-ready format (v0.2 schema).');
    console.log('Focus: Main agent only (sidechains excluded).');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace('.jsonl', '_annotation_prep.jsonl');

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  const preprocessor = new AnnotationPreprocessor();
  preprocessor.parseFile(inputPath);

  const records = preprocessor.generateAnnotationRecords();

  console.log(`Generated ${records.length} annotation records:`);
  const byType = {
    user_turn: records.filter(r => r.unit_type === 'user_turn').length,
    assistant_turn: records.filter(r => r.unit_type === 'assistant_turn').length,
  };
  console.log(`  - user_turn: ${byType.user_turn}`);
  console.log(`  - assistant_turn: ${byType.assistant_turn}`);

  // Tool summary stats
  const withTools = records.filter(r => r.tool_summary && r.tool_summary.tool_calls.length > 0);
  const totalToolCalls = withTools.reduce((sum, r) => sum + (r.tool_summary?.tool_calls.length || 0), 0);
  console.log(`  - assistant_turns with tools: ${withTools.length}`);
  console.log(`  - total tool calls: ${totalToolCalls}`);

  preprocessor.writeJsonl(records, outputPath);
  console.log(`\nWritten to: ${outputPath}`);
}
