/**
 * API Types - Request/response schemas for API endpoints
 */

import type { GraphSnapshot } from './graph';
import type { WorkflowGraphSnapshot } from '@/lib/models/types';

export interface UploadResponse {
  graph_id: string;
  message_count: number;
  node_count: number;
  edge_count: number;
  total_steps: number;
  main_agent_steps: number;
  framework: string;
  /** Number of sub-agent files loaded (for Claude Code) */
  sub_agents_loaded?: number;
  /** Agent IDs for which no file was found (for Claude Code) */
  sub_agents_missing?: string[];
  /** Number of annotation records generated (for Claude Code) */
  annotation_count?: number;
}

export interface GraphResponse {
  graph: GraphSnapshot;
}

export interface WorkflowResponse {
  workflow: WorkflowGraphSnapshot;
}

export interface AnnotationsResponse {
  annotations: import('@/lib/annotation/types').AnnotationRecord[];
  total: number;
  user_turn_count: number;
  assistant_turn_count: number;
  system_turn_count: number;
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
