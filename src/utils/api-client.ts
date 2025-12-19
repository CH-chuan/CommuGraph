/**
 * API Client - Fetch-based client for API routes
 *
 * Replaces Axios with native fetch for Next.js compatibility.
 */

import type {
  UploadResponse,
  GraphResponse,
  WorkflowResponse,
  AnnotationsResponse,
  MetricsResponse,
  FrameworkListResponse,
} from '@/types/api';

/**
 * Internal helper for fetching JSON with consistent error handling.
 */
async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  errorContext?: string
): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `${errorContext || 'Request failed'}: ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Upload log file(s) and create a new graph session.
 *
 * For Claude Code: supports multiple files (main session + agent-*.jsonl)
 * For other frameworks: single file upload
 *
 * @param files - Array of files to upload
 * @param framework - Framework identifier ('autogen', 'claudecode', etc.)
 * @param subAgentDirectory - (Optional) Directory path to search for sub-agent files
 */
export async function uploadLogFiles(
  files: File[],
  framework: string,
  subAgentDirectory?: string
): Promise<UploadResponse> {
  const formData = new FormData();

  // Append all files
  for (const file of files) {
    formData.append('file', file);
  }
  formData.append('framework', framework);

  // Append sub-agent directory if provided
  if (subAgentDirectory) {
    formData.append('subAgentDirectory', subAgentDirectory);
  }

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
 * @deprecated Use uploadLogFiles instead
 */
export async function uploadLogFile(
  file: File,
  framework: string
): Promise<UploadResponse> {
  return uploadLogFiles([file], framework);
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

  return fetchJson<GraphResponse>(url, undefined, 'Failed to fetch graph');
}

/**
 * Get workflow graph for a Claude Code session.
 */
export async function getWorkflow(
  graphId: string,
  step?: number
): Promise<WorkflowResponse> {
  const url =
    step !== undefined
      ? `/api/graph/${graphId}/workflow?step=${step}`
      : `/api/graph/${graphId}/workflow`;

  return fetchJson<WorkflowResponse>(url, undefined, 'Failed to fetch workflow');
}

/**
 * Get annotation records for a Claude Code session.
 */
export async function getAnnotations(
  graphId: string
): Promise<AnnotationsResponse> {
  return fetchJson<AnnotationsResponse>(
    `/api/graph/${graphId}/annotations`,
    undefined,
    'Failed to fetch annotations'
  );
}

/**
 * Get graph metrics for a session.
 */
export async function getMetrics(graphId: string): Promise<MetricsResponse> {
  return fetchJson<MetricsResponse>(
    `/api/graph/${graphId}/metrics`,
    undefined,
    'Failed to fetch metrics'
  );
}

/**
 * Get list of available frameworks.
 */
export async function getFrameworks(): Promise<FrameworkListResponse> {
  return fetchJson<FrameworkListResponse>(
    '/api/frameworks',
    undefined,
    'Failed to fetch frameworks'
  );
}

/**
 * Delete a session.
 */
export async function deleteSession(
  sessionId: string
): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(
    `/api/session/${sessionId}`,
    { method: 'DELETE' },
    'Failed to delete session'
  );
}
