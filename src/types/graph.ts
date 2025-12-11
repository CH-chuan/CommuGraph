/**
 * Graph Types - Frontend type definitions
 *
 * These TypeScript interfaces match the backend API responses.
 * Keep snake_case to match backend naming convention.
 */

export const MessageType = {
  THOUGHT: 'thought',
  ACTION: 'action',
  OBSERVATION: 'observation',
  DELEGATION: 'delegation',
  RESPONSE: 'response',
  SYSTEM: 'system',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const IntentLabel = {
  DELEGATION: 'delegation',
  INFORMATION_REQUEST: 'information_request',
  INFORMATION_RESPONSE: 'information_response',
  FEEDBACK: 'feedback',
  COORDINATION: 'coordination',
  UNKNOWN: 'unknown',
} as const;

export type IntentLabel = (typeof IntentLabel)[keyof typeof IntentLabel];

export interface Interaction {
  step_index: number;
  timestamp: string; // ISO 8601 string
  intent: IntentLabel;
  message_id?: number | null;
  metadata?: Record<string, unknown>;
}

export interface EdgeData {
  source: string;
  target: string;
  interactions: Interaction[];
  weight: number;
}

export interface NodeData {
  id: string;
  label: string;
  message_count: number; // Deprecated, use messages_sent
  messages_sent: number;
  messages_received: number;
  first_appearance?: string | null;
  last_activity?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GraphSnapshot {
  nodes: NodeData[];
  edges: EdgeData[];
  current_step?: number | null;
  total_steps: number;
  metadata?: Record<string, unknown>;
}

export const AnomalyType = {
  CIRCULAR_LOOP: 'circular_loop',
  STAGNATION: 'stagnation',
  ISOLATION: 'isolation',
  EXCESSIVE_TOKENS: 'excessive_tokens',
} as const;

export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

export interface Anomaly {
  type: AnomalyType;
  step_index: number;
  severity: number; // 1-5
  description: string;
  affected_agents: string[];
  metadata?: Record<string, unknown>;
}
