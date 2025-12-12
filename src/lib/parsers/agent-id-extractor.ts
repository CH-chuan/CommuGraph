/**
 * Agent ID Extractor - Utilities for extracting sub-agent IDs from JSONL content
 *
 * Uses regex for efficient extraction without full JSON parsing.
 * Agent IDs appear in toolUseResult.agentId fields when a Task tool completes.
 */

/**
 * Extract unique agent IDs from JSONL content.
 *
 * Looks for patterns like: "agentId":"7e0f7211"
 * Agent IDs are typically 7-8 character hexadecimal strings.
 *
 * @param content - Raw JSONL file content
 * @returns Set of unique agent IDs found in the content
 */
export function extractAgentIdsFromContent(content: string): Set<string> {
  const agentIds = new Set<string>();

  // Match "agentId":"<hex-id>" patterns
  // Agent IDs are typically 7-8 hex characters
  const regex = /"agentId"\s*:\s*"([a-f0-9]{7,8})"/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    agentIds.add(match[1]);
  }

  return agentIds;
}

/**
 * Build the expected filename for a sub-agent from its ID.
 *
 * @param agentId - The agent ID (e.g., "7e0f7211")
 * @returns The expected filename (e.g., "agent-7e0f7211.jsonl")
 */
export function buildSubAgentFilename(agentId: string): string {
  return `agent-${agentId}.jsonl`;
}

/**
 * Check if a filename is a sub-agent file (starts with "agent-").
 *
 * @param filename - The filename to check
 * @returns True if this is a sub-agent file
 */
export function isSubAgentFile(filename: string): boolean {
  return filename.toLowerCase().startsWith('agent-');
}

/**
 * Extract the agent ID from a sub-agent filename.
 *
 * @param filename - The filename (e.g., "agent-7e0f7211.jsonl")
 * @returns The agent ID or null if not a valid sub-agent filename
 */
export function extractAgentIdFromFilename(filename: string): string | null {
  const match = filename.match(/^agent-([a-f0-9]+)\.jsonl$/i);
  return match ? match[1] : null;
}
