/**
 * Claude Code Parser - Parses Claude Code multi-agent chat logs
 *
 * Handles the complex structure of Claude Code logs including:
 * - Multi-file sessions (main session + sub-agent files)
 * - LLM response chunking (thinking, text, tool_use in separate records)
 * - User type decomposition (user_input, tool_result, system_notice)
 * - Temporal ordering via parentUuid chains
 *
 * @see /dev_docs/claude_code_chat_log/understanding_claude_code_chat_log.md
 */

import { BaseParser, ParserError } from './base-parser';
import {
  MessageType,
  IntentLabel,
  WorkflowNodeType,
  type Message,
  type WorkflowNodeType as WorkflowNodeTypeType,
} from '@/lib/models/types';

// ============================================================================
// Raw Log Record Types (from Claude Code JSONL)
// ============================================================================

/** Content types within assistant messages */
interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | { type: string; text: string }[];
  is_error?: boolean;
}

type AssistantContent = ThinkingContent | TextContent | ToolUseContent;
type UserMessageContent = string | ToolResultContent[];

/** Token usage statistics */
interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
}

/** Assistant message structure */
interface AssistantMessage {
  model: string;
  id: string; // Claude API message ID (msg_xxx)
  type: 'message';
  role: 'assistant';
  content: AssistantContent[];
  stop_reason: string | null;
  usage?: TokenUsage;
}

/** User message structure */
interface UserMessage {
  role: 'user';
  content: UserMessageContent;
}

/** Tool use result metadata */
interface ToolUseResultMeta {
  status?: 'completed' | 'failed';
  prompt?: string;
  agentId?: string;
  content?: { type: string; text: string }[];
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  stdout?: string;
  stderr?: string;
  interrupted?: boolean;
  isImage?: boolean;
  type?: string;
  file?: {
    filePath: string;
    content: string;
    numLines: number;
  };
  filenames?: string[];
}

/** Compact metadata for context compaction */
interface CompactMetadata {
  trigger: string;
  preTokens: number;
}

/** Raw JSONL record from Claude Code log */
interface RawLogRecord {
  // Identity
  uuid: string;
  parentUuid: string | null;
  logicalParentUuid?: string | null;
  sessionId: string;
  timestamp: string;

  // Type classification
  type: 'user' | 'assistant' | 'system' | 'file-history-snapshot' | 'queue-operation';
  subtype?: string;

  // Context
  isSidechain: boolean;
  agentId?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  slug?: string;
  userType?: string;

  // Message content (structure depends on type)
  message?: AssistantMessage | UserMessage;
  requestId?: string;

  // Metadata
  isMeta?: boolean;
  thinkingMetadata?: {
    level: string;
    disabled: boolean;
    triggers: string[];
  };
  toolUseResult?: ToolUseResultMeta;

  // System-specific
  content?: string;
  level?: string;
  compactMetadata?: CompactMetadata;

  // Queue operation
  operation?: 'enqueue' | 'dequeue';

  // File snapshot
  messageId?: string;
  snapshot?: Record<string, unknown>;
  isSnapshotUpdate?: boolean;
}

// Re-export WorkflowNodeType for convenience
export { WorkflowNodeType } from '@/lib/models/types';

/** Extended message with workflow node info */
export interface ClaudeCodeMessage extends Message {
  // Claude Code specific fields
  uuid: string;
  parentUuid: string | null;
  logicalParentUuid?: string | null; // Used for context compaction continuity
  requestId?: string;
  messageApiId?: string;

  // Workflow classification
  workflowNodeType: WorkflowNodeTypeType;

  // Sub-agent context
  isSidechain: boolean;
  agentId?: string;

  // Tool-specific
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;

  // Token metrics
  inputTokens?: number;
  outputTokens?: number;

  // Duration (for tool results)
  durationMs?: number;
}

/** Merged LLM response (combining thinking + text + tool_use chunks) */
interface MergedLLMResponse {
  uuid: string;
  parentUuid: string | null;
  logicalParentUuid?: string | null;
  requestId: string;
  messageApiId: string;
  timestamp: string;
  model: string;
  isSidechain: boolean;
  agentId?: string;

  // Content parts
  thinking?: string;
  text?: string;
  toolCalls: {
    id: string;
    name: string;
    input: Record<string, unknown>;
    uuid: string; // UUID of the record containing this tool call
  }[];

  // Metrics
  inputTokens: number;
  outputTokens: number;
}

/** Sub-agent metadata */
export interface SubAgentInfo {
  agentId: string;
  subagentType?: string;
  prompt: string;
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  status?: 'completed' | 'failed';
}

/** Parse result with full context */
export interface ClaudeCodeParseResult {
  sessionId: string;
  messages: ClaudeCodeMessage[];
  subAgents: Map<string, SubAgentInfo>;
  totalTokens: number;
  timeRange: { start: string; end: string };
}

// ============================================================================
// Parser Implementation
// ============================================================================

export class ClaudeCodeParser extends BaseParser {
  readonly frameworkName = 'claudecode';

  /**
   * Parse Claude Code log content into Message objects.
   * This method parses a single JSONL file content.
   */
  parse(content: string): Message[] {
    this.validateContent(content);

    const result = this.parseClaudeCodeLog(content);
    return result.messages;
  }

  /**
   * Full parsing with Claude Code specific metadata.
   * Use this for process mining features.
   */
  parseClaudeCodeLog(content: string): ClaudeCodeParseResult {
    this.validateContent(content);

    const rawRecords = this.parseJsonl(content);
    return this.processRecords(rawRecords);
  }

  /**
   * Parse multiple files (main session + sub-agents).
   * Pass contents as a Map from filename to content.
   */
  parseMultiFile(files: Map<string, string>): ClaudeCodeParseResult {
    // Identify main session file (UUID format, not agent-*)
    let mainSessionId: string | null = null;
    const allRecords: RawLogRecord[] = [];

    for (const [filename, content] of files) {
      const records = this.parseJsonl(content);

      // Detect main session from filename pattern
      const isAgentFile = filename.includes('agent-');
      if (!isAgentFile && !mainSessionId && records.length > 0) {
        mainSessionId = records[0].sessionId;
      }

      allRecords.push(...records);
    }

    return this.processRecords(allRecords, mainSessionId ?? undefined);
  }

  /**
   * Parse JSONL content into raw records.
   */
  private parseJsonl(content: string): RawLogRecord[] {
    const records: RawLogRecord[] = [];
    const lines = content.split('\n');

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line) continue;

      try {
        const record = JSON.parse(line) as RawLogRecord;
        records.push(record);
      } catch (e) {
        throw new ParserError(`Invalid JSON on line ${idx + 1}`, {
          lineNumber: idx + 1,
          originalError: e instanceof Error ? e : new Error(String(e)),
        });
      }
    }

    return records;
  }

  /**
   * Process raw records into messages.
   */
  private processRecords(
    records: RawLogRecord[],
    sessionId?: string
  ): ClaudeCodeParseResult {
    // Group assistant records by requestId for merging
    const assistantRecordsByRequest = new Map<string, RawLogRecord[]>();
    const otherRecords: RawLogRecord[] = [];
    const subAgents = new Map<string, SubAgentInfo>();

    // Detect sessionId from first record if not provided
    if (!sessionId && records.length > 0) {
      sessionId = records[0].sessionId;
    }

    // First pass: categorize records
    for (const record of records) {
      if (record.type === 'assistant' && record.requestId) {
        const existing = assistantRecordsByRequest.get(record.requestId) || [];
        existing.push(record);
        assistantRecordsByRequest.set(record.requestId, existing);
      } else if (
        record.type === 'user' ||
        record.type === 'system'
      ) {
        otherRecords.push(record);
      }
      // Skip file-history-snapshot and queue-operation for now
    }

    // Merge assistant records
    const mergedResponses = this.mergeAssistantRecords(assistantRecordsByRequest);

    // Convert to messages
    const messages: ClaudeCodeMessage[] = [];
    let stepIndex = 0;

    // Build UUID to merged response map for linking
    const responseByUuid = new Map<string, MergedLLMResponse>();
    for (const response of mergedResponses) {
      responseByUuid.set(response.uuid, response);
      // Also map tool call UUIDs
      for (const tool of response.toolCalls) {
        responseByUuid.set(tool.uuid, response);
      }
    }

    // Sort all records by timestamp for step ordering
    const allProcessableRecords = [
      ...mergedResponses.map(r => ({
        type: 'merged_response' as const,
        data: r,
        timestamp: r.timestamp,
        uuid: r.uuid,
      })),
      ...otherRecords.map(r => ({
        type: 'raw' as const,
        data: r,
        timestamp: r.timestamp,
        uuid: r.uuid,
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Process records in order
    for (const item of allProcessableRecords) {
      if (item.type === 'merged_response') {
        const response = item.data;
        const newMessages = this.convertMergedResponse(response, stepIndex);
        messages.push(...newMessages);
        stepIndex += newMessages.length;
      } else {
        const record = item.data;
        const newMessages = this.convertRawRecord(record, stepIndex, subAgents);
        messages.push(...newMessages);
        stepIndex += newMessages.length;
      }
    }

    // Calculate time range
    const timestamps = messages.map(m => new Date(m.timestamp).getTime());
    const timeRange = {
      start: new Date(Math.min(...timestamps)).toISOString(),
      end: new Date(Math.max(...timestamps)).toISOString(),
    };

    // Calculate total tokens
    const totalTokens = messages.reduce((sum, m) => {
      return sum + (m.inputTokens || 0) + (m.outputTokens || 0);
    }, 0);

    return {
      sessionId: sessionId || 'unknown',
      messages,
      subAgents,
      totalTokens,
      timeRange,
    };
  }

  /**
   * Merge chunked assistant records by requestId.
   */
  private mergeAssistantRecords(
    recordsByRequest: Map<string, RawLogRecord[]>
  ): MergedLLMResponse[] {
    const merged: MergedLLMResponse[] = [];

    for (const [requestId, records] of recordsByRequest) {
      // Sort by timestamp to get correct order
      records.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const first = records[0];
      const assistantMsg = first.message as AssistantMessage | undefined;

      if (!assistantMsg) continue;

      const response: MergedLLMResponse = {
        uuid: first.uuid,
        parentUuid: first.parentUuid,
        logicalParentUuid: first.logicalParentUuid,
        requestId,
        messageApiId: assistantMsg.id,
        timestamp: first.timestamp,
        model: assistantMsg.model,
        isSidechain: first.isSidechain,
        agentId: first.agentId,
        toolCalls: [],
        inputTokens: 0,
        outputTokens: 0,
      };

      // Aggregate content from all chunks
      for (const record of records) {
        const msg = record.message as AssistantMessage | undefined;
        if (!msg?.content) continue;

        for (const content of msg.content) {
          if (content.type === 'thinking') {
            response.thinking = (response.thinking || '') + content.thinking;
          } else if (content.type === 'text') {
            response.text = (response.text || '') + content.text;
          } else if (content.type === 'tool_use') {
            response.toolCalls.push({
              id: content.id,
              name: content.name,
              input: content.input,
              uuid: record.uuid,
            });
          }
        }

        // Aggregate token usage
        if (msg.usage) {
          response.inputTokens += msg.usage.input_tokens || 0;
          response.outputTokens += msg.usage.output_tokens || 0;
        }
      }

      merged.push(response);
    }

    return merged;
  }

  /**
   * Convert merged LLM response to messages.
   */
  private convertMergedResponse(
    response: MergedLLMResponse,
    startStepIndex: number
  ): ClaudeCodeMessage[] {
    const messages: ClaudeCodeMessage[] = [];
    let stepIndex = startStepIndex;

    // Create reasoning node if there's thinking or text
    if (response.thinking || response.text) {
      const reasoningContent = [
        response.thinking ? `[Thinking]\n${response.thinking}` : '',
        response.text || '',
      ].filter(Boolean).join('\n\n');

      messages.push({
        step_index: stepIndex++,
        timestamp: response.timestamp,
        sender: response.agentId ? `agent-${response.agentId}` : 'assistant',
        receiver: null,
        message_type: MessageType.THOUGHT,
        content: reasoningContent,
        metadata: {
          model: response.model,
          requestId: response.requestId,
        },

        // Claude Code specific
        uuid: response.uuid,
        parentUuid: response.parentUuid,
        logicalParentUuid: response.logicalParentUuid,
        requestId: response.requestId,
        messageApiId: response.messageApiId,
        workflowNodeType: WorkflowNodeType.AGENT_REASONING,
        isSidechain: response.isSidechain,
        agentId: response.agentId,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      });
    }

    // Create tool call nodes
    for (const toolCall of response.toolCalls) {
      const toolDescription = this.getToolDescription(toolCall.name, toolCall.input);

      messages.push({
        step_index: stepIndex++,
        timestamp: response.timestamp,
        sender: response.agentId ? `agent-${response.agentId}` : 'assistant',
        receiver: null,
        message_type: MessageType.ACTION,
        content: toolDescription,
        metadata: {
          tool_name: toolCall.name,
          tool_input: toolCall.input,
          tool_use_id: toolCall.id,
        },

        // Claude Code specific
        uuid: toolCall.uuid,
        parentUuid: response.uuid,
        requestId: response.requestId,
        messageApiId: response.messageApiId,
        workflowNodeType: WorkflowNodeType.TOOL_CALL,
        isSidechain: response.isSidechain,
        agentId: response.agentId,
        toolName: toolCall.name,
        toolInput: toolCall.input,
        toolUseId: toolCall.id,
      });
    }

    return messages;
  }

  /**
   * Convert raw record (user/system) to messages.
   */
  private convertRawRecord(
    record: RawLogRecord,
    startStepIndex: number,
    subAgents: Map<string, SubAgentInfo>
  ): ClaudeCodeMessage[] {
    const messages: ClaudeCodeMessage[] = [];

    if (record.type === 'user') {
      const userMsg = record.message as UserMessage | undefined;
      if (!userMsg) return messages;

      const nodeType = this.classifyUserMessage(record);
      const content = this.extractUserContent(record);

      // Extract sub-agent info from tool results
      if (nodeType === WorkflowNodeType.TOOL_RESULT && record.toolUseResult?.agentId) {
        const result = record.toolUseResult;
        const agentId = result.agentId; // Already checked for undefined above
        if (agentId) {
          subAgents.set(agentId, {
            agentId,
            prompt: result.prompt || '',
            totalDurationMs: result.totalDurationMs,
            totalTokens: result.totalTokens,
            totalToolUseCount: result.totalToolUseCount,
            status: result.status,
          });
        }
      }

      // Skip meta messages and empty content
      if (record.isMeta || !content.trim()) return messages;

      // Determine message type based on workflow node type
      let messageType: MessageType = MessageType.RESPONSE;
      if (nodeType === WorkflowNodeType.USER_INPUT) {
        messageType = MessageType.DELEGATION;
      } else if (nodeType === WorkflowNodeType.TOOL_RESULT) {
        messageType = MessageType.OBSERVATION;
      } else if (nodeType === WorkflowNodeType.SYSTEM_NOTICE) {
        messageType = MessageType.SYSTEM;
      }

      // Determine if result is success or failure
      let resultStatus: 'success' | 'failure' | undefined;
      let toolUseIdFromResult: string | undefined;

      if (nodeType === WorkflowNodeType.TOOL_RESULT) {
        if (record.toolUseResult?.status === 'failed' ||
            record.toolUseResult?.stderr ||
            (Array.isArray(userMsg.content) &&
             userMsg.content.some(c =>
               c.type === 'tool_result' && c.is_error
             ))) {
          resultStatus = 'failure';
        } else {
          resultStatus = 'success';
        }

        // Extract tool_use_id from message content
        if (Array.isArray(userMsg.content)) {
          const toolResultContent = userMsg.content.find(
            (c): c is ToolResultContent => c.type === 'tool_result'
          );
          if (toolResultContent) {
            toolUseIdFromResult = toolResultContent.tool_use_id;
          }
        }
      }

      messages.push({
        step_index: startStepIndex,
        timestamp: record.timestamp,
        sender: record.agentId ? `agent-${record.agentId}` : 'user',
        receiver: null,
        message_type: messageType,
        content,
        metadata: {
          node_type: nodeType,
          result_status: resultStatus,
          tool_use_result: record.toolUseResult,
          tool_use_id: toolUseIdFromResult, // Store tool_use_id in metadata
        },

        // Claude Code specific
        uuid: record.uuid,
        parentUuid: record.parentUuid,
        logicalParentUuid: record.logicalParentUuid,
        workflowNodeType: resultStatus === 'failure'
          ? WorkflowNodeType.RESULT_FAILURE
          : (nodeType === WorkflowNodeType.TOOL_RESULT
              ? WorkflowNodeType.RESULT_SUCCESS
              : nodeType),
        isSidechain: record.isSidechain,
        agentId: record.agentId,
        toolUseId: toolUseIdFromResult, // Also add to ClaudeCodeMessage for direct access
        durationMs: record.toolUseResult?.totalDurationMs,
      });
    } else if (record.type === 'system') {
      messages.push({
        step_index: startStepIndex,
        timestamp: record.timestamp,
        sender: 'system',
        receiver: null,
        message_type: MessageType.SYSTEM,
        content: record.content || record.subtype || 'System event',
        metadata: {
          subtype: record.subtype,
          compact_metadata: record.compactMetadata,
        },

        // Claude Code specific
        uuid: record.uuid,
        parentUuid: record.parentUuid,
        logicalParentUuid: record.logicalParentUuid,
        workflowNodeType: WorkflowNodeType.SYSTEM_NOTICE,
        isSidechain: record.isSidechain,
        agentId: record.agentId,
      });
    }

    return messages;
  }

  /**
   * Classify user message into workflow node type.
   */
  private classifyUserMessage(record: RawLogRecord): WorkflowNodeType {
    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg) return WorkflowNodeType.USER_INPUT;

    // Tool result check
    if (Array.isArray(userMsg.content)) {
      const hasToolResult = userMsg.content.some(
        (c): c is ToolResultContent => c.type === 'tool_result'
      );
      if (hasToolResult) return WorkflowNodeType.TOOL_RESULT;
    }

    // System notice checks
    if (record.isMeta) return WorkflowNodeType.SYSTEM_NOTICE;

    const content = typeof userMsg.content === 'string' ? userMsg.content : '';
    if (content.includes('<local-command-')) return WorkflowNodeType.SYSTEM_NOTICE;
    if (content.includes('<bash-notification>')) return WorkflowNodeType.SYSTEM_NOTICE;
    if (content.includes('<command-name>')) return WorkflowNodeType.SYSTEM_NOTICE;

    // Default: real user input
    return WorkflowNodeType.USER_INPUT;
  }

  /**
   * Extract text content from user message.
   */
  private extractUserContent(record: RawLogRecord): string {
    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg) return '';

    if (typeof userMsg.content === 'string') {
      return userMsg.content;
    }

    // Array of tool results
    if (Array.isArray(userMsg.content)) {
      const parts: string[] = [];

      for (const item of userMsg.content) {
        if (item.type === 'tool_result') {
          if (typeof item.content === 'string') {
            parts.push(item.content);
          } else if (Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === 'text') {
                parts.push(c.text);
              }
            }
          }
        }
      }

      // Also include toolUseResult content if available
      if (record.toolUseResult?.stdout) {
        parts.push(record.toolUseResult.stdout);
      }
      if (record.toolUseResult?.stderr) {
        parts.push(`[stderr] ${record.toolUseResult.stderr}`);
      }
      if (record.toolUseResult?.file?.content) {
        parts.push(`[file: ${record.toolUseResult.file.filePath}]\n${record.toolUseResult.file.content}`);
      }

      return parts.join('\n').slice(0, 10000); // Limit content length
    }

    return '';
  }

  /**
   * Generate human-readable tool description.
   */
  private getToolDescription(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'Read':
        return `Read file: ${input.file_path || 'unknown'}`;
      case 'Write':
        return `Write file: ${input.file_path || 'unknown'}`;
      case 'Edit':
        return `Edit file: ${input.file_path || 'unknown'}`;
      case 'Bash':
        return `Bash: ${String(input.command || '').slice(0, 100)}`;
      case 'Glob':
        return `Glob: ${input.pattern || 'unknown'}`;
      case 'Grep':
        return `Grep: ${input.pattern || 'unknown'}`;
      case 'Task':
        return `Task (${input.subagent_type || 'unknown'}): ${String(input.description || input.prompt || '').slice(0, 100)}`;
      case 'TodoWrite':
        return `TodoWrite: ${JSON.stringify(input.todos || []).slice(0, 100)}`;
      case 'AskUserQuestion':
        return `Ask user: ${String(input.question || input.prompt || '').slice(0, 100)}`;
      default:
        return `${name}: ${JSON.stringify(input).slice(0, 100)}`;
    }
  }

  /**
   * Infer intent from message content and type.
   */
  inferIntent(message: ClaudeCodeMessage): IntentLabel {
    switch (message.workflowNodeType) {
      case WorkflowNodeType.USER_INPUT:
        return IntentLabel.DELEGATION;
      case WorkflowNodeType.TOOL_CALL:
        return IntentLabel.INFORMATION_REQUEST;
      case WorkflowNodeType.TOOL_RESULT:
      case WorkflowNodeType.RESULT_SUCCESS:
      case WorkflowNodeType.RESULT_FAILURE:
        return IntentLabel.INFORMATION_RESPONSE;
      case WorkflowNodeType.AGENT_REASONING:
        return IntentLabel.COORDINATION;
      case WorkflowNodeType.SYSTEM_NOTICE:
        return IntentLabel.FEEDBACK;
      default:
        return IntentLabel.UNKNOWN;
    }
  }
}
