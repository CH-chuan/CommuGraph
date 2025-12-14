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

/** Image content in user messages */
interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: string;
    data: string;
  };
}

/** Text content in mixed user message arrays */
interface UserTextContent {
  type: 'text';
  text: string;
}

type AssistantContent = ThinkingContent | TextContent | ToolUseContent;
/** User message content can be string, tool results array, or mixed content array (images + text) */
type MixedUserContent = (ImageContent | UserTextContent | ToolResultContent)[];
type UserMessageContent = string | MixedUserContent;

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

  // Context compaction summary
  isCompactSummary?: boolean;
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

  // Context compaction fields
  isContextCompact?: boolean;
  compactSummary?: string;
  compactMetadata?: CompactMetadata;

  // Image content from user messages
  images?: {
    mediaType: string;
    data: string;  // base64 data
  }[];
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
  toolUseId?: string;  // tool_use_id that triggered this sub-agent
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
   * Parse main session file with lazily loaded sub-agent files.
   *
   * Use this when sub-agent files are loaded separately after extracting
   * agentIds from the main session.
   *
   * @param mainContent - Content of the main session JSONL file
   * @param mainFilename - Filename of the main session (for identification)
   * @param subAgentFiles - Map of sub-agent files (filename -> content)
   * @returns Parsed result with messages and sub-agent info
   */
  parseWithLazySubAgents(
    mainContent: string,
    mainFilename: string,
    subAgentFiles: Map<string, string>
  ): ClaudeCodeParseResult {
    // Combine main file with sub-agent files
    const allFiles = new Map<string, string>();
    allFiles.set(mainFilename, mainContent);

    for (const [filename, content] of subAgentFiles) {
      allFiles.set(filename, content);
    }

    // Use existing multi-file parsing
    return this.parseMultiFile(allFiles);
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

    // Map tool_use_id -> subagent_type for Task tool calls
    const taskToolSubagentTypes = new Map<string, string>();

    // Detect sessionId from first record if not provided
    if (!sessionId && records.length > 0) {
      sessionId = records[0].sessionId;
    }

    // Build compact boundary map (uuid -> system record with compact_boundary)
    const compactBoundaryMap = new Map<string, RawLogRecord>();
    for (const record of records) {
      if (record.type === 'system' && record.subtype === 'compact_boundary') {
        compactBoundaryMap.set(record.uuid, record);
      }
    }

    // Build compact summary map (parentUuid -> user summary record)
    // Also track UUIDs to skip in main processing
    const compactSummaryMap = new Map<string, RawLogRecord>();
    const compactSummaryUuids = new Set<string>();
    for (const record of records) {
      if (record.type === 'user' && record.isCompactSummary === true) {
        if (record.parentUuid && compactBoundaryMap.has(record.parentUuid)) {
          compactSummaryMap.set(record.parentUuid, record);
          compactSummaryUuids.add(record.uuid);
        }
      }
    }

    // First pass: categorize records and extract Task tool subagent_type
    for (const record of records) {
      // Skip user records that are compact summaries (will be merged with system record)
      if (record.type === 'user' && compactSummaryUuids.has(record.uuid)) {
        continue;
      }
      if (record.type === 'assistant' && record.requestId) {
        const existing = assistantRecordsByRequest.get(record.requestId) || [];
        existing.push(record);
        assistantRecordsByRequest.set(record.requestId, existing);

        // Extract subagent_type from Task tool calls
        const msg = record.message as AssistantMessage | undefined;
        if (msg?.content) {
          for (const content of msg.content) {
            if (content.type === 'tool_use' && content.name === 'Task') {
              const input = content.input as { subagent_type?: string };
              if (input.subagent_type) {
                taskToolSubagentTypes.set(content.id, input.subagent_type);
              }
            }
          }
        }
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

    // Build processable records with parent info for topological sort
    type ProcessableRecord = {
      type: 'merged_response' | 'raw';
      data: MergedLLMResponse | RawLogRecord;
      timestamp: string;
      uuid: string;
      parentUuid: string | null;
      logicalParentUuid?: string | null;
      allUuids: string[]; // All UUIDs that identify this record (for merged responses)
    };

    const allProcessableRecords: ProcessableRecord[] = [
      ...mergedResponses.map(r => ({
        type: 'merged_response' as const,
        data: r,
        timestamp: r.timestamp,
        uuid: r.uuid,
        parentUuid: r.parentUuid,
        logicalParentUuid: r.logicalParentUuid,
        // Include all tool call UUIDs as they may be referenced by children
        allUuids: [r.uuid, ...r.toolCalls.map(tc => tc.uuid)],
      })),
      ...otherRecords.map(r => ({
        type: 'raw' as const,
        data: r,
        timestamp: r.timestamp,
        uuid: r.uuid,
        parentUuid: r.parentUuid,
        logicalParentUuid: r.logicalParentUuid,
        allUuids: [r.uuid],
      })),
    ];

    // Topological sort using uuid→parentUuid chain
    const sortedRecords = this.topologicalSortRecords(allProcessableRecords);

    // Process records in order
    for (const item of sortedRecords) {
      if (item.type === 'merged_response') {
        const response = item.data as MergedLLMResponse;
        const newMessages = this.convertMergedResponse(response, stepIndex);
        messages.push(...newMessages);
        stepIndex += newMessages.length;
      } else {
        const record = item.data as RawLogRecord;
        const newMessages = this.convertRawRecord(record, stepIndex, subAgents, taskToolSubagentTypes, compactSummaryMap);
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
    // Combine thinking and text from the same request into one node
    if (response.thinking || response.text) {
      const contentParts: string[] = [];
      if (response.thinking) {
        contentParts.push(`[Thinking]\n${response.thinking}`);
      }
      if (response.text) {
        contentParts.push(`[Response]\n${response.text}`);
      }
      const reasoningContent = contentParts.join('\n\n');

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
          hasThinking: !!response.thinking,
          hasText: !!response.text,
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
    subAgents: Map<string, SubAgentInfo>,
    taskToolSubagentTypes: Map<string, string>,
    compactSummaryMap?: Map<string, RawLogRecord>
  ): ClaudeCodeMessage[] {
    const messages: ClaudeCodeMessage[] = [];

    if (record.type === 'user') {
      const userMsg = record.message as UserMessage | undefined;
      if (!userMsg) return messages;

      const nodeType = this.classifyUserMessage(record);
      const { text: content, images } = this.extractUserContent(record);

      // Extract tool_use_id from message content FIRST (needed for sub-agent matching)
      let toolUseIdFromResult: string | undefined;
      if (nodeType === WorkflowNodeType.TOOL_RESULT && Array.isArray(userMsg.content)) {
        const toolResultContent = userMsg.content.find(
          (c): c is ToolResultContent => c.type === 'tool_result'
        );
        if (toolResultContent) {
          toolUseIdFromResult = toolResultContent.tool_use_id;
        }
      }

      // Extract sub-agent info from tool results
      // Key by tool_use_id so we can match with the Task tool call later
      if (nodeType === WorkflowNodeType.TOOL_RESULT && record.toolUseResult?.agentId) {
        const result = record.toolUseResult;
        const agentId = result.agentId;
        if (agentId && toolUseIdFromResult) {
          // Look up subagent_type from the Task tool call that triggered this sub-agent
          const subagentType = taskToolSubagentTypes.get(toolUseIdFromResult);

          subAgents.set(toolUseIdFromResult, {  // Key by tool_use_id, not agentId
            agentId,
            toolUseId: toolUseIdFromResult,
            subagentType,  // Now populated from Task tool call input
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

        // Image content from user messages
        images,
      });
    } else if (record.type === 'system') {
      // Check if this is a compact_boundary with a summary to merge
      const isCompactBoundary = record.subtype === 'compact_boundary';
      let compactSummary: string | undefined;

      if (isCompactBoundary && compactSummaryMap) {
        const summaryRecord = compactSummaryMap.get(record.uuid);
        if (summaryRecord) {
          const userMsg = summaryRecord.message as UserMessage | undefined;
          compactSummary = typeof userMsg?.content === 'string'
            ? userMsg.content
            : undefined;
        }
      }

      messages.push({
        step_index: startStepIndex,
        timestamp: record.timestamp,
        // Updated sender for context compact
        sender: isCompactBoundary ? 'system - context compact' : 'system',
        receiver: null,
        message_type: MessageType.SYSTEM,
        // For compact boundary, prefer the summary content if available
        content: isCompactBoundary
          ? (compactSummary || record.content || 'Context compacted')
          : (record.content || record.subtype || 'System event'),
        metadata: {
          subtype: record.subtype,
          compact_metadata: record.compactMetadata,
          has_summary: !!compactSummary,
        },

        // Claude Code specific
        uuid: record.uuid,
        parentUuid: record.parentUuid,
        logicalParentUuid: record.logicalParentUuid,
        workflowNodeType: WorkflowNodeType.SYSTEM_NOTICE,
        isSidechain: record.isSidechain,
        agentId: record.agentId,

        // Context compaction fields
        isContextCompact: isCompactBoundary,
        compactSummary: compactSummary,
        compactMetadata: record.compactMetadata,
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
    // Note: <command-name> messages are user-initiated slash commands (e.g., /clear, /savelog)
    // They should be treated as USER_INPUT, not SYSTEM_NOTICE

    // Default: real user input
    return WorkflowNodeType.USER_INPUT;
  }

  /**
   * Extract text content and images from user message.
   * Returns both text and any base64 images found in the message.
   */
  private extractUserContent(record: RawLogRecord): {
    text: string;
    images?: { mediaType: string; data: string }[];
  } {
    const userMsg = record.message as UserMessage | undefined;
    if (!userMsg) return { text: '' };

    if (typeof userMsg.content === 'string') {
      return { text: userMsg.content };
    }

    // Array content (can be tool results, images, text, or mixed)
    if (Array.isArray(userMsg.content)) {
      const textParts: string[] = [];
      const images: { mediaType: string; data: string }[] = [];

      for (const item of userMsg.content) {
        if (item.type === 'text') {
          // Direct text content in mixed arrays
          textParts.push((item as UserTextContent).text);
        } else if (item.type === 'image') {
          // Image content - extract base64 data
          const imgItem = item as ImageContent;
          if (imgItem.source?.type === 'base64' && imgItem.source.data) {
            images.push({
              mediaType: imgItem.source.media_type,
              data: imgItem.source.data,
            });
          }
        } else if (item.type === 'tool_result') {
          // Tool result content
          const toolResult = item as ToolResultContent;
          if (typeof toolResult.content === 'string') {
            textParts.push(toolResult.content);
          } else if (Array.isArray(toolResult.content)) {
            for (const c of toolResult.content) {
              if (c.type === 'text') {
                textParts.push(c.text);
              }
            }
          }
        }
      }

      // Also include toolUseResult content if available
      if (record.toolUseResult?.stdout) {
        textParts.push(record.toolUseResult.stdout);
      }
      if (record.toolUseResult?.stderr) {
        textParts.push(`[stderr] ${record.toolUseResult.stderr}`);
      }
      if (record.toolUseResult?.file?.content) {
        textParts.push(`[file: ${record.toolUseResult.file.filePath}]\n${record.toolUseResult.file.content}`);
      }

      return {
        text: textParts.join('\n').slice(0, 10000), // Limit content length
        images: images.length > 0 ? images : undefined,
      };
    }

    return { text: '' };
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
      case 'AskUserQuestion': {
        const questions = input.questions as Array<{question: string}> | undefined;
        const firstQ = questions?.[0]?.question || '';
        return `Ask user: ${firstQ.slice(0, 100)}`;
      }
      default:
        return `${name}: ${JSON.stringify(input).slice(0, 100)}`;
    }
  }

  /**
   * Topological sort records using uuid→parentUuid chain.
   *
   * Uses DFS traversal following parent-child relationships.
   * Siblings are sorted by timestamp as tiebreaker.
   * Orphans (records whose parent is not in the set) are sorted by timestamp.
   */
  private topologicalSortRecords<T extends {
    uuid: string;
    parentUuid: string | null;
    logicalParentUuid?: string | null;
    allUuids: string[];
    timestamp: string;
  }>(records: T[]): T[] {
    // Build uuid -> record map (register all UUIDs for each record)
    const byUuid = new Map<string, T>();
    for (const record of records) {
      for (const uuid of record.allUuids) {
        byUuid.set(uuid, record);
      }
    }

    // Build parent -> children adjacency list
    // Use logicalParentUuid for context compaction continuity, fall back to parentUuid
    const children = new Map<string | null, T[]>();
    for (const record of records) {
      const parentUuid = record.logicalParentUuid ?? record.parentUuid ?? null;
      const list = children.get(parentUuid) || [];
      list.push(record);
      children.set(parentUuid, list);
    }

    // DFS from roots (records with no parent or parent not in our set)
    const result: T[] = [];
    const visited = new Set<string>();

    const dfs = (uuid: string | null) => {
      const childRecords = children.get(uuid) || [];

      // Sort children by timestamp as tiebreaker for siblings
      childRecords.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return ta - tb;
      });

      for (const record of childRecords) {
        // Check if already visited (via any of its UUIDs)
        const isVisited = record.allUuids.some(u => visited.has(u));
        if (isVisited) continue;

        // Mark all UUIDs as visited
        for (const u of record.allUuids) {
          visited.add(u);
        }

        result.push(record);

        // Continue DFS from this record's UUIDs
        for (const u of record.allUuids) {
          dfs(u);
        }
      }
    };

    // Start from null parent (root) - records whose parent is null
    dfs(null);

    // Also process records whose parent exists but is not in our set (orphans)
    // These are records that reference a parent that was filtered out
    const orphanRecords: T[] = [];
    for (const record of records) {
      const isVisited = record.allUuids.some(u => visited.has(u));
      if (!isVisited) {
        orphanRecords.push(record);
      }
    }

    // Sort orphans by timestamp and process each as a new root
    orphanRecords.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });

    for (const record of orphanRecords) {
      const isVisited = record.allUuids.some(u => visited.has(u));
      if (isVisited) continue;

      for (const u of record.allUuids) {
        visited.add(u);
      }
      result.push(record);

      // Process children of this orphan
      for (const u of record.allUuids) {
        dfs(u);
      }
    }

    return result;
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
