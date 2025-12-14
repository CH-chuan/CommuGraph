/**
 * Annotation Schema Types (v0.2)
 *
 * TypeScript types matching annotation_schema_v02.yaml
 * Used by the annotation preprocessor to generate intermediate JSONL for labeling.
 */

// ============================================================================
// Unit Types
// ============================================================================

export type UnitType = 'assistant_turn' | 'user_turn' | 'system_turn';

// ============================================================================
// Actor Types
// ============================================================================

export type ActorType = 'human' | 'agent' | 'system';
export type RoleType = 'delegator' | 'proxy' | 'mixed' | 'unknown';
export type AgentKind = 'main' | 'sub' | 'unknown';

// ============================================================================
// Label Definitions (from schema v02)
// ============================================================================

export type LabelId =
  // A. Task Structuring & Work Decomposition
  | 'TASK_DECOMPOSITION'
  | 'TASK_SUBTASK_DELEGATION'
  // B. Action Execution Types
  | 'EXEC_COGNITIVE'
  | 'EXEC_DIGITAL'
  // D. Delegation Mechanisms
  | 'DELEGATION_APPRAISAL'
  | 'DELEGATION_DECISION'
  | 'DELEGATION_NEGOTIATION'
  | 'DELEGATION_CONSTRAINT_SETTING'
  // E. Coordination & Oversight
  | 'COORD_MONITORING'
  | 'COORD_INTERVENTION'
  | 'COORD_STATE_UPDATING'
  | 'COORD_COMMON_UNDERSTANDING';

export type LabelFamily =
  | 'task_structuring'
  | 'execution'
  | 'delegation_appraisal'
  | 'delegation_distribution'
  | 'coordination';

// ============================================================================
// Label Evidence
// ============================================================================

export interface LabelEvidence {
  quote?: string;
  cue?: string;
}

export interface LabelRecord {
  id: LabelId;
  confidence?: number; // 0.0 - 1.0
  evidence?: LabelEvidence;
  fields?: Record<string, unknown>; // Label-specific output fields
}

// ============================================================================
// Tool Summary (for assistant_turn)
// ============================================================================

export interface ToolCallSummary {
  tool_use_id: string;
  tool_name: string;
  /** True if tool results indicate success (coarse) */
  success?: boolean;
  /** True if any matching tool_result has is_error=true */
  is_error?: boolean;
  /** Number of tool_result blocks for this tool_use_id */
  result_count: number;
}

export interface ToolSummary {
  tool_calls: ToolCallSummary[];
}

// ============================================================================
// Source Traceability
// ============================================================================

export interface SourcePointers {
  /** Path to the source JSONL file (main or agent-*.jsonl) */
  raw_file?: string;
  /** [startLine, endLine] in the raw JSONL file */
  raw_line_range?: [number, number];
  /** One or more raw record uuids contributing to this unit */
  raw_uuids?: string[];
  /** API request ID (for assistant records) */
  request_id?: string;
  /** API message ID (for assistant records) */
  message_id?: string;
  /** All tool_use.id values emitted in this assistant turn */
  tool_use_ids?: string[];
  /** Whether this is from a sidechain/sub-agent */
  is_sidechain?: boolean;
  /** Agent ID if from sidechain */
  agent_id?: string;
}

// ============================================================================
// Text/Artifact Reference
// ============================================================================

/** Tool call reference for structured text_or_artifact_ref */
export interface ToolCallRef {
  tool_use_id: string;
  tool_name: string;
  input: Record<string, unknown>;
}

export interface TextOrArtifactRef {
  /** Thinking content from assistant (for assistant_turn) */
  thinking?: string;
  /** Text response from assistant OR user prompt text (for user_turn) */
  text?: string;
  /** Tool calls made in this turn (for assistant_turn) */
  tool_calls?: ToolCallRef[];
  /** Tool call ID reference (legacy compatibility) */
  tool_call_id?: string;
  /** Path to artifact (e.g., file written) */
  artifact_path?: string;
  /** Image content from user messages (base64) */
  images?: {
    mediaType: string;
    data: string;
  }[];
}

// ============================================================================
// Annotation Record (main output type)
// ============================================================================

export interface AnnotationRecord {
  /** Session identifier */
  session_id: string;
  /** Event identifier (formatted per convention) */
  event_id: string;
  /** Actor identifier (e.g., "human", "assistant", "agent-{id}") */
  actor_id: string;
  /** Actor type classification */
  actor_type: ActorType;
  /** Agent kind - only for actor_type=agent */
  agent_kind?: AgentKind;
  /** Type of annotation unit */
  unit_type: UnitType;
  /** Source traceability pointers */
  source: SourcePointers;
  /** Optional timestamp (ISO-8601) */
  timestamp?: string;
  /** Tool execution summary (only for assistant_turn) */
  tool_summary?: ToolSummary;
  /** Reference to content */
  text_or_artifact_ref: TextOrArtifactRef;
  /** Labels (empty for preprocessing, filled during annotation) */
  labels: LabelRecord[];
  /** Compact metadata (only for system_turn with context compaction) */
  compact_metadata?: {
    trigger: string;
    preTokens: number;
  };
}

// ============================================================================
// Event ID Conventions
// ============================================================================

/**
 * Generate event_id for assistant_turn unit.
 * Pattern: A:{request_id}:{message_id} or A::{message_id} if no request_id
 */
export function makeAssistantEventId(requestId: string | undefined, messageId: string): string {
  return `A:${requestId || ''}:${messageId}`;
}

/**
 * Generate event_id for user_turn unit.
 * Pattern: U:{raw_uuid}
 */
export function makeUserTurnEventId(rawUuid: string): string {
  return `U:${rawUuid}`;
}

/**
 * Generate event_id for system_turn unit.
 * Pattern: S:{raw_uuid}
 */
export function makeSystemTurnEventId(rawUuid: string): string {
  return `S:${rawUuid}`;
}

// ============================================================================
// Raw Log Types (for parsing)
// ============================================================================

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | { type: string; text: string }[];
  is_error?: boolean;
}

export type AssistantContent = ThinkingContent | TextContent | ToolUseContent;

export interface AssistantMessage {
  model: string;
  id: string;
  type: 'message';
  role: 'assistant';
  content: AssistantContent[];
  stop_reason: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

/** Image content in user messages */
export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: string;
    data: string;
  };
}

/** Text content in mixed user message arrays */
export interface UserTextContent {
  type: 'text';
  text: string;
}

/** Mixed user content can be images, text, or tool results */
export type MixedUserContent = (ImageContent | UserTextContent | ToolResultContent)[];

export interface UserMessage {
  role: 'user';
  content: string | MixedUserContent;
}

export interface RawLogRecord {
  uuid: string;
  parentUuid: string | null;
  logicalParentUuid?: string | null;
  sessionId: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'system' | 'file-history-snapshot' | 'queue-operation';
  subtype?: string;
  isSidechain: boolean;
  agentId?: string;
  message?: AssistantMessage | UserMessage;
  requestId?: string;
  isMeta?: boolean;
  toolUseResult?: Record<string, unknown>;
  thinkingMetadata?: {
    level: string;
    disabled: boolean;
  };
  // System record fields
  content?: string;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };
  // Context compaction summary
  isCompactSummary?: boolean;
}
