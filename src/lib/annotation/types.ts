/**
 * Annotation Schema Types (v0.1)
 *
 * TypeScript types matching annotation_schema_v01.yaml
 * Used by the annotation preprocessor to generate intermediate JSONL for labeling.
 */

// ============================================================================
// Unit Types
// ============================================================================

export type UnitType = 'assistant_thought_text' | 'tool_exchange' | 'user_prompt';

// ============================================================================
// Actor Types
// ============================================================================

export type ActorType = 'human' | 'agent' | 'tool';
export type RoleType = 'delegator' | 'proxy' | 'mixed' | 'unknown';

// ============================================================================
// Label Definitions (from schema)
// ============================================================================

export type LabelId =
  // A. Task Structuring & Work Decomposition
  | 'TASK_DECOMPOSITION'
  | 'TASK_SUBTASK_DELEGATION'
  // B. Action Execution Types
  | 'EXEC_COGNITIVE'
  | 'EXEC_DIGITAL'
  | 'EXEC_PHYSICAL'
  // C. Task Complexity Handling
  | 'COMPLEXITY_UNCERTAINTY'
  | 'COMPLEXITY_INTERDEPENDENCE'
  | 'COMPLEXITY_DYNAMICS'
  // D. Delegation Mechanisms
  | 'DELEGATION_APPRAISAL_CAPABILITY'
  | 'DELEGATION_APPRAISAL_TRUST'
  | 'DELEGATION_APPRAISAL_COMPATIBILITY'
  | 'DELEGATION_DECISION'
  | 'DELEGATION_ROLE_REVERSAL'
  | 'DELEGATION_NEGOTIATION'
  | 'DELEGATION_CONSTRAINT_SETTING'
  // E. Coordination & Oversight
  | 'COORD_MONITORING'
  | 'COORD_INTERVENTION'
  | 'COORD_STATE_UPDATING'
  | 'COORD_ACCOUNTABILITY'
  | 'COORD_PREDICTABILITY_ALIGNMENT'
  | 'COORD_COMMON_UNDERSTANDING'
  // F. Outcome States (mutually exclusive)
  | 'OUTCOME_GOAL_ATTAINMENT'
  | 'OUTCOME_GOAL_PROGRESS'
  | 'OUTCOME_GOAL_FAILURE';

export type LabelFamily =
  | 'task_structuring'
  | 'execution'
  | 'complexity'
  | 'delegation_appraisal'
  | 'delegation_distribution'
  | 'coordination'
  | 'outcome';

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
  /** Tool use ID (for tool_exchange units) */
  tool_use_id?: string;
  /** Tool name (for tool_exchange units) */
  tool_name?: string;
  /** Whether this is from a sidechain/sub-agent */
  is_sidechain?: boolean;
  /** Agent ID if from sidechain */
  agent_id?: string;
}

// ============================================================================
// Text/Artifact Reference
// ============================================================================

export interface TextOrArtifactRef {
  /** The actual text content */
  text?: string;
  /** Tool call ID reference */
  tool_call_id?: string;
  /** Path to artifact (e.g., file written) */
  artifact_path?: string;
}

// ============================================================================
// Annotation Record (main output type)
// ============================================================================

export interface AnnotationRecord {
  /** Session identifier */
  session_id: string;
  /** Event identifier (formatted per convention) */
  event_id: string;
  /** Actor identifier (e.g., "human", "assistant", "tool:Bash") */
  actor_id: string;
  /** Actor type classification */
  actor_type: ActorType;
  /** Role in delegation relationship */
  role?: RoleType;
  /** Type of annotation unit */
  unit_type: UnitType;
  /** Source traceability pointers */
  source: SourcePointers;
  /** Optional timestamp (ISO-8601) */
  timestamp?: string;
  /** Reference to content */
  text_or_artifact_ref: TextOrArtifactRef;
  /** Labels (empty for preprocessing, filled during annotation) */
  labels: LabelRecord[];
}

// ============================================================================
// Event ID Conventions
// ============================================================================

/**
 * Generate event_id for assistant_thought_text unit.
 * Pattern: A:{request_id}:{message_id}
 */
export function makeAssistantEventId(requestId: string, messageId: string): string {
  return `A:${requestId}:${messageId}`;
}

/**
 * Generate event_id for tool_exchange unit.
 * Pattern: T:{tool_use_id}
 */
export function makeToolExchangeEventId(toolUseId: string): string {
  return `T:${toolUseId}`;
}

/**
 * Generate event_id for user_prompt unit.
 * Pattern: U:{raw_uuid}
 */
export function makeUserPromptEventId(rawUuid: string): string {
  return `U:${rawUuid}`;
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

export interface UserMessage {
  role: 'user';
  content: string | ToolResultContent[];
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
}
