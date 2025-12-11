/**
 * Type definitions and Zod schemas for CommuGraph
 *
 * Mirrors the Python Pydantic models from backend/app/models/types.py
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

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

export const AnomalyType = {
  CIRCULAR_LOOP: 'circular_loop',
  STAGNATION: 'stagnation',
  ISOLATION: 'isolation',
  EXCESSIVE_TOKENS: 'excessive_tokens',
} as const;

export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

// ============================================================================
// Zod Schemas
// ============================================================================

export const MessageSchema = z.object({
  step_index: z.number().int().nonnegative(),
  timestamp: z.string(), // ISO 8601 datetime string
  sender: z.string().min(1),
  receiver: z.string().nullable(),
  message_type: z.enum([
    MessageType.THOUGHT,
    MessageType.ACTION,
    MessageType.OBSERVATION,
    MessageType.DELEGATION,
    MessageType.RESPONSE,
    MessageType.SYSTEM,
  ]),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Message = z.infer<typeof MessageSchema>;

export const InteractionSchema = z.object({
  step_index: z.number().int().nonnegative(),
  timestamp: z.string(), // ISO 8601 datetime string
  intent: z.enum([
    IntentLabel.DELEGATION,
    IntentLabel.INFORMATION_REQUEST,
    IntentLabel.INFORMATION_RESPONSE,
    IntentLabel.FEEDBACK,
    IntentLabel.COORDINATION,
    IntentLabel.UNKNOWN,
  ]).default(IntentLabel.UNKNOWN),
  message_id: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Interaction = z.infer<typeof InteractionSchema>;

export const EdgeDataSchema = z.object({
  source: z.string(),
  target: z.string(),
  interactions: z.array(InteractionSchema),
  weight: z.number().int().nonnegative(),
});

export type EdgeData = z.infer<typeof EdgeDataSchema>;

export const NodeDataSchema = z.object({
  id: z.string(),
  label: z.string(),
  message_count: z.number().int().nonnegative(), // Deprecated, use messages_sent
  messages_sent: z.number().int().nonnegative(),
  messages_received: z.number().int().nonnegative(),
  first_appearance: z.string().nullable().optional(),
  last_activity: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type NodeData = z.infer<typeof NodeDataSchema>;

export const GraphSnapshotSchema = z.object({
  nodes: z.array(NodeDataSchema),
  edges: z.array(EdgeDataSchema),
  current_step: z.number().nullable().optional(),
  total_steps: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type GraphSnapshot = z.infer<typeof GraphSnapshotSchema>;

export const AnomalySchema = z.object({
  type: z.enum([
    AnomalyType.CIRCULAR_LOOP,
    AnomalyType.STAGNATION,
    AnomalyType.ISOLATION,
    AnomalyType.EXCESSIVE_TOKENS,
  ]),
  step_index: z.number().int().nonnegative(),
  severity: z.number().int().min(1).max(5),
  description: z.string(),
  affected_agents: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Anomaly = z.infer<typeof AnomalySchema>;

// ============================================================================
// API Response Types
// ============================================================================

export interface UploadResponse {
  graph_id: string;
  message_count: number;
  node_count: number;
  edge_count: number;
  total_steps: number;
  framework: string;
}

export interface GraphResponse {
  graph: GraphSnapshot;
}

export interface MetricsResponse {
  node_count: number;
  edge_count: number;
  density: number;
  centrality?: Record<string, number> | null;
  in_degree_centrality?: Record<string, number> | null;
  out_degree_centrality?: Record<string, number> | null;
}

export interface FrameworkListResponse {
  frameworks: string[];
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SessionInfo {
  id: string;
  framework: string;
  message_count: number;
  node_count: number;
  edge_count: number;
  created_at: string;
  last_accessed: string;
}

// ============================================================================
// Internal Types (used by services)
// ============================================================================

export interface NodeMetadata {
  id: string;
  label: string;
  message_count: number;
  messages_sent: number;
  messages_received: number;
  first_appearance: string;
  last_activity: string;
  metadata: Record<string, unknown>;
}

export interface EdgeMetadata {
  source: string;
  target: string;
  interactions: Interaction[];
  weight: number;
}
