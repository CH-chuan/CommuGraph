/**
 * Sub-Agent Loader Service - Load sub-agent files based on agentIds found in main session
 *
 * This service extracts agentIds from the main session content and loads
 * corresponding sub-agent files either from already-uploaded files or from
 * a configured filesystem directory.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  extractAgentIdsFromContent,
  buildSubAgentFilename,
  extractAgentIdFromFilename,
} from '../parsers/agent-id-extractor';

/** Result of sub-agent file loading */
export interface SubAgentLoadResult {
  /** Successfully loaded files: filename -> content */
  loadedFiles: Map<string, string>;
  /** Agent IDs for which no file was found */
  missingAgentIds: string[];
  /** Errors encountered during loading */
  errors: Array<{ agentId: string; error: string }>;
}

/** Options for sub-agent file loading */
export interface SubAgentLoaderOptions {
  /** Base directory to search for sub-agent files on filesystem */
  baseDirectory?: string;
  /** Already-uploaded files to check first (filename -> content) */
  uploadedFiles?: Map<string, string>;
}

/**
 * Load sub-agent files based on agentIds found in main session content.
 *
 * Priority:
 * 1. Check if file was already uploaded (in uploadedFiles map)
 * 2. Try to load from baseDirectory on filesystem
 * 3. Mark as missing if not found
 *
 * @param mainContent - Content of the main session JSONL file
 * @param options - Loading options
 * @returns Result with loaded files, missing IDs, and any errors
 */
export async function loadSubAgentFiles(
  mainContent: string,
  options: SubAgentLoaderOptions = {}
): Promise<SubAgentLoadResult> {
  const { baseDirectory, uploadedFiles = new Map() } = options;

  const result: SubAgentLoadResult = {
    loadedFiles: new Map(),
    missingAgentIds: [],
    errors: [],
  };

  // Step 1: Extract agent IDs from main content
  const agentIds = extractAgentIdsFromContent(mainContent);

  if (agentIds.size === 0) {
    return result;
  }

  console.log(`[SubAgentLoader] Found ${agentIds.size} agent IDs: ${Array.from(agentIds).join(', ')}`);

  // Step 2: For each agentId, try to find its file
  for (const agentId of agentIds) {
    const filename = buildSubAgentFilename(agentId);

    // Check uploaded files first
    const uploadedContent = findInUploadedFiles(filename, uploadedFiles);
    if (uploadedContent) {
      console.log(`[SubAgentLoader] Found ${filename} in uploaded files`);
      result.loadedFiles.set(filename, uploadedContent);
      continue;
    }

    // If no base directory configured, mark as missing
    if (!baseDirectory) {
      result.missingAgentIds.push(agentId);
      continue;
    }

    // Try to load from filesystem
    try {
      const filePath = path.join(baseDirectory, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      console.log(`[SubAgentLoader] Loaded ${filename} from ${baseDirectory}`);
      result.loadedFiles.set(filename, content);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        result.missingAgentIds.push(agentId);
      } else {
        result.errors.push({
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Log summary
  console.log(
    `[SubAgentLoader] Loaded: ${result.loadedFiles.size}, Missing: ${result.missingAgentIds.length}, Errors: ${result.errors.length}`
  );

  return result;
}

/**
 * Find a file in uploaded files map.
 * Supports case-insensitive matching and handles path prefixes.
 *
 * @param targetFilename - The filename to find (e.g., "agent-7e0f7211.jsonl")
 * @param uploadedFiles - Map of uploaded files
 * @returns File content if found, null otherwise
 */
function findInUploadedFiles(
  targetFilename: string,
  uploadedFiles: Map<string, string>
): string | null {
  // Exact match
  if (uploadedFiles.has(targetFilename)) {
    return uploadedFiles.get(targetFilename)!;
  }

  // Case-insensitive and basename match
  const lowerTarget = targetFilename.toLowerCase();
  for (const [uploadedName, content] of uploadedFiles) {
    // Get basename (handle both forward and backslash paths)
    const basename = uploadedName.split(/[/\\]/).pop() || uploadedName;

    if (basename.toLowerCase() === lowerTarget) {
      return content;
    }
  }

  return null;
}

/**
 * Get all agent IDs that were found in uploaded files.
 *
 * @param uploadedFiles - Map of uploaded files
 * @returns Set of agent IDs from uploaded sub-agent files
 */
export function getUploadedAgentIds(uploadedFiles: Map<string, string>): Set<string> {
  const agentIds = new Set<string>();

  for (const filename of uploadedFiles.keys()) {
    const basename = filename.split(/[/\\]/).pop() || filename;
    const agentId = extractAgentIdFromFilename(basename);
    if (agentId) {
      agentIds.add(agentId);
    }
  }

  return agentIds;
}

/**
 * Validate that a sub-agent directory path is safe (no path traversal).
 *
 * @param dirPath - The directory path to validate
 * @returns True if the path is safe to use
 */
export function isValidSubAgentDirectory(dirPath: string): boolean {
  // Reject empty paths
  if (!dirPath || dirPath.trim() === '') {
    return false;
  }

  // Reject path traversal attempts
  if (dirPath.includes('..')) {
    return false;
  }

  // Reject absolute paths (for security)
  if (path.isAbsolute(dirPath)) {
    return false;
  }

  return true;
}
