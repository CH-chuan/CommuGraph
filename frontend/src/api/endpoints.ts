/**
 * API Endpoint Functions
 *
 * All backend API calls are defined here.
 */

import { apiClient } from './client';
import type {
  UploadResponse,
  GraphResponse,
  FrameworkListResponse,
  MetricsResponse,
} from '@/types/api';

/**
 * GET /api/frameworks
 * Returns list of supported log frameworks
 */
export const getFrameworks = async (): Promise<FrameworkListResponse> => {
  const { data } = await apiClient.get<FrameworkListResponse>('/api/frameworks');
  return data;
};

/**
 * POST /api/upload
 * Upload log file and get graph_id
 */
export const uploadLogFile = async (
  file: File,
  framework: string
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('framework', framework);

  const { data } = await apiClient.post<UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

/**
 * GET /api/graph/{graph_id}?step=N
 * Retrieve graph snapshot, optionally filtered by step
 */
export const getGraph = async (
  graphId: string,
  step?: number
): Promise<GraphResponse> => {
  const params = step !== undefined ? { step } : {};
  const { data } = await apiClient.get<GraphResponse>(`/api/graph/${graphId}`, {
    params,
  });
  return data;
};

/**
 * GET /api/graph/{graph_id}/metrics
 * Get graph metrics (centrality, density, etc.)
 */
export const getMetrics = async (graphId: string): Promise<MetricsResponse> => {
  const { data } = await apiClient.get<MetricsResponse>(
    `/api/graph/${graphId}/metrics`
  );
  return data;
};
