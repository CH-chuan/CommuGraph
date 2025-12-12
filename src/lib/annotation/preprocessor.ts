/**
 * Annotation Preprocessor for Claude Code Logs
 *
 * Transforms raw Claude Code JSONL into intermediate JSONL format
 * ready for annotation according to annotation_schema_v01.yaml.
 *
 * Unit types produced:
 * - assistant_thought_text: Grouped thinking+text blocks per model turn
 * - tool_exchange: One tool_use paired with its tool_result(s)
 * - user_prompt: Direct user input (not tool results or meta)
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
  type AssistantContent,
  type ToolUseContent,
  type ToolResultContent,
  type ThinkingContent,
  type TextContent,
  type SourcePointers,
  makeAssistantEventId,
  makeToolExchangeEventId,
  makeUserPromptEventId,
} from './types';

// ============================================================================
// Interfaces for Grouping
// ============================================================================

interface AssistantTurn {
  requestId: string;
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

interface ToolExchange {
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolUseTimestamp: string;
  toolUseUuid: string;
  toolUseLineNumber: number;
  toolResults: {
    uuid: string;
    timestamp: string;
    lineNumber: number;
    content: string;
    isError: boolean;
  }[];
  requestId?: string;
  messageId?: string;
  isSidechain: boolean;
  agentId?: string;
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
   */
  private isUserPrompt(record: RawLogRecord): boolean {
    if (record.type !== 'user') return false;
    if (record.isMeta) return false;

    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg) return false;

    // Must be string content (not array of tool_results)
    if (typeof userMsg.content !== 'string') return false;

    const content = userMsg.content;

    // Skip command messages
    if (content.includes('<command-name>')) return false;
    if (content.includes('<local-command-')) return false;
    if (content.includes('<bash-notification>')) return false;

    // Skip empty or very short content
    if (content.trim().length < 5) return false;

    return true;
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
   */
  private extractToolResults(record: RawLogRecord, lineNumber: number): Map<string, {
    uuid: string;
    timestamp: string;
    lineNumber: number;
    content: string;
    isError: boolean;
  }> {
    const results = new Map<string, {
      uuid: string;
      timestamp: string;
      lineNumber: number;
      content: string;
      isError: boolean;
    }>();

    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg || !Array.isArray(userMsg.content)) return results;

    for (const item of userMsg.content) {
      if (item.type !== 'tool_result') continue;

      const toolResult = item as ToolResultContent;
      let contentStr: string;

      if (typeof toolResult.content === 'string') {
        contentStr = toolResult.content;
      } else if (Array.isArray(toolResult.content)) {
        contentStr = toolResult.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      } else {
        contentStr = JSON.stringify(toolResult.content);
      }

      results.set(toolResult.tool_use_id, {
        uuid: record.uuid,
        timestamp: record.timestamp,
        lineNumber,
        content: contentStr,
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
      if (!record.requestId) continue;

      const assistantMsg = record.message as AssistantMessage | undefined;
      if (!assistantMsg) continue;

      const key = `${record.requestId}:${assistantMsg.id}`;

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
   * Build tool exchanges by pairing tool_use with tool_results.
   */
  private buildToolExchanges(
    turns: Map<string, AssistantTurn>,
    mainRecords: ParsedLine[]
  ): Map<string, ToolExchange> {
    const exchanges = new Map<string, ToolExchange>();

    // First, collect all tool_use blocks
    for (const [, turn] of turns) {
      for (const toolUse of turn.toolUseBlocks) {
        exchanges.set(toolUse.id, {
          toolUseId: toolUse.id,
          toolName: toolUse.name,
          toolInput: toolUse.input,
          toolUseTimestamp: turn.timestamp,
          toolUseUuid: turn.rawUuids[0], // Use first UUID
          toolUseLineNumber: turn.lineNumbers[0],
          toolResults: [],
          requestId: turn.requestId,
          messageId: turn.messageId,
          isSidechain: turn.isSidechain,
          agentId: turn.agentId,
        });
      }
    }

    // Then, match tool_results
    for (const { lineNumber, record } of mainRecords) {
      if (!this.isToolResult(record)) continue;

      const results = this.extractToolResults(record, lineNumber);
      for (const [toolUseId, result] of results) {
        const exchange = exchanges.get(toolUseId);
        if (exchange) {
          exchange.toolResults.push(result);
        }
      }
    }

    return exchanges;
  }

  /**
   * Generate annotation records from parsed data.
   */
  generateAnnotationRecords(): AnnotationRecord[] {
    const mainRecords = this.filterMainAgent();
    const turns = this.groupAssistantTurns(mainRecords);
    const exchanges = this.buildToolExchanges(turns, mainRecords);

    const output: AnnotationRecord[] = [];

    // 1. Generate user_prompt records
    for (const { lineNumber, record } of mainRecords) {
      if (!this.isUserPrompt(record)) continue;

      const userMsg = record.message as UserMessage;
      const content = typeof userMsg.content === 'string' ? userMsg.content : '';

      output.push({
        session_id: this.sessionId,
        event_id: makeUserPromptEventId(record.uuid),
        actor_id: 'human',
        actor_type: 'human',
        role: 'delegator',
        unit_type: 'user_prompt',
        source: {
          raw_file: this.rawFile,
          raw_line_range: [lineNumber, lineNumber],
          raw_uuids: [record.uuid],
          is_sidechain: false,
        },
        timestamp: record.timestamp,
        text_or_artifact_ref: {
          text: content,
        },
        labels: [],
      });
    }

    // 2. Generate assistant_thought_text records (only if has thinking or text)
    for (const [, turn] of turns) {
      const hasThinkingOrText = turn.thinkingBlocks.length > 0 || turn.textBlocks.length > 0;
      if (!hasThinkingOrText) continue;

      // Combine thinking and text
      const textParts: string[] = [];
      if (turn.thinkingBlocks.length > 0) {
        textParts.push('[THINKING]\n' + turn.thinkingBlocks.join('\n\n'));
      }
      if (turn.textBlocks.length > 0) {
        textParts.push('[TEXT]\n' + turn.textBlocks.join('\n\n'));
      }

      const source: SourcePointers = {
        raw_file: this.rawFile,
        raw_line_range: [Math.min(...turn.lineNumbers), Math.max(...turn.lineNumbers)],
        raw_uuids: turn.rawUuids,
        request_id: turn.requestId,
        message_id: turn.messageId,
        is_sidechain: false,
      };

      output.push({
        session_id: this.sessionId,
        event_id: makeAssistantEventId(turn.requestId, turn.messageId),
        actor_id: 'agent',
        actor_type: 'agent',
        role: 'proxy',
        unit_type: 'assistant_thought_text',
        source,
        timestamp: turn.timestamp,
        text_or_artifact_ref: {
          text: textParts.join('\n\n'),
        },
        labels: [],
      });
    }

    // 3. Generate tool_exchange records
    for (const [, exchange] of exchanges) {
      // Build combined text
      const textParts: string[] = [];

      // Tool call info
      textParts.push(`[TOOL_USE] ${exchange.toolName}`);
      textParts.push(`Input: ${JSON.stringify(exchange.toolInput, null, 2)}`);

      // Tool results
      for (const result of exchange.toolResults) {
        const prefix = result.isError ? '[TOOL_RESULT - ERROR]' : '[TOOL_RESULT]';
        textParts.push(`${prefix}\n${result.content}`);
      }

      // Collect all line numbers and UUIDs
      const lineNumbers = [exchange.toolUseLineNumber];
      const uuids = [exchange.toolUseUuid];
      for (const result of exchange.toolResults) {
        lineNumbers.push(result.lineNumber);
        uuids.push(result.uuid);
      }

      const source: SourcePointers = {
        raw_file: this.rawFile,
        raw_line_range: [Math.min(...lineNumbers), Math.max(...lineNumbers)],
        raw_uuids: uuids,
        request_id: exchange.requestId,
        message_id: exchange.messageId,
        tool_use_id: exchange.toolUseId,
        tool_name: exchange.toolName,
        is_sidechain: false,
      };

      output.push({
        session_id: this.sessionId,
        event_id: makeToolExchangeEventId(exchange.toolUseId),
        actor_id: `tool:${exchange.toolName}`,
        actor_type: 'tool',
        role: 'proxy',
        unit_type: 'tool_exchange',
        source,
        timestamp: exchange.toolUseTimestamp,
        text_or_artifact_ref: {
          text: textParts.join('\n\n'),
          tool_call_id: exchange.toolUseId,
        },
        labels: [],
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
    console.log('Preprocesses Claude Code JSONL into annotation-ready format.');
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
    user_prompt: records.filter(r => r.unit_type === 'user_prompt').length,
    assistant_thought_text: records.filter(r => r.unit_type === 'assistant_thought_text').length,
    tool_exchange: records.filter(r => r.unit_type === 'tool_exchange').length,
  };
  console.log(`  - user_prompt: ${byType.user_prompt}`);
  console.log(`  - assistant_thought_text: ${byType.assistant_thought_text}`);
  console.log(`  - tool_exchange: ${byType.tool_exchange}`);

  preprocessor.writeJsonl(records, outputPath);
  console.log(`\nWritten to: ${outputPath}`);
}
