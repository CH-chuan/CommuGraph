/**
 * API Client - Fetch-based client for API routes
 *
 * Replaces Axios with native fetch for Next.js compatibility.
 */

import type {
  UploadResponse,
  GraphResponse,
  MetricsResponse,
  FrameworkListResponse,
} from '@/types/api';

/**
 * Upload a log file and create a new graph session.
 */
export async function uploadLogFile(
  file: File,
  framework: string
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('framework', framework);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Upload failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get graph data for a session, optionally filtered by step.
 */
export async function getGraph(
  graphId: string,
  step?: number
): Promise<GraphResponse> {
  const url =
    step !== undefined
      ? `/api/graph/${graphId}?step=${step}`
      : `/api/graph/${graphId}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to fetch graph: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get graph metrics for a session.
 */
export async function getMetrics(graphId: string): Promise<MetricsResponse> {
  const response = await fetch(`/api/graph/${graphId}/metrics`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to fetch metrics: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get list of available frameworks.
 */
export async function getFrameworks(): Promise<FrameworkListResponse> {
  const response = await fetch('/api/frameworks');

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to fetch frameworks: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Delete a session.
 */
export async function deleteSession(
  sessionId: string
): Promise<{ message: string }> {
  const response = await fetch(`/api/session/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to delete session: ${response.statusText}`
    );
  }

  return response.json();
}
