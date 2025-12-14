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
      } catch (e) {
        console.warn(`Skipping invalid JSON on line ${i + 1}`);
      }
    }
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

      // Skip command messages
      if (content.includes('<command-name>')) return false;
      if (content.includes('<local-command-')) return false;
      if (content.includes('<bash-notification>')) return false;

      // Skip empty or very short content
      if (content.trim().length < 5) return false;

      return true;
    }

    // Array content - check if it contains text or image (not just tool_results)
    if (Array.isArray(userMsg.content)) {
      const hasUserContent = userMsg.content.some(
        item => item.type === 'text' || item.type === 'image'
      );
      // Skip if only tool results
      if (!hasUserContent) return false;

      // Extract text to check for command messages
      const textContent = this.extractTextFromMixedContent(userMsg.content);
      if (textContent.includes('<command-name>')) return false;
      if (textContent.includes('<local-command-')) return false;
      if (textContent.includes('<bash-notification>')) return false;

      // Check if there's meaningful content (text or images)
      const hasImages = userMsg.content.some(item => item.type === 'image');
      if (hasImages) return true; // Images are always meaningful

      // Check text length
      if (textContent.trim().length < 5) return false;

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

    // Sort by timestamp
    output.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });

    return output;
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
