/**
 * API Types - Request/response schemas for API endpoints
 */

import type { GraphSnapshot } from './graph';

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
