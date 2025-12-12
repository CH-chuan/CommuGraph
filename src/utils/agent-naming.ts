/**
 * Agent Naming Utilities
 *
 * Provides consistent naming for sub-agents across the application.
 * Format: {SubagentType}-{AgentId} (e.g., "Explore-773d7508")
 */

/**
 * Format a sub-agent name combining type and agent ID.
 * @param subagentType - The type of sub-agent (e.g., "Explore", "Plan")
 * @param agentId - The agent ID (typically 8 chars like "773d7508")
 * @returns Formatted name like "Explore-773d7508"
 */
export function formatSubAgentName(subagentType: string, agentId: string): string {
  const type = subagentType || 'Agent';
  return `${type}-${agentId}`;
}

/**
 * Extract agent ID from a lane ID (removes 'agent-' prefix if present).
 */
export function extractAgentIdFromLaneId(laneId: string): string | null {
  if (laneId.startsWith('agent-')) {
    return laneId.substring(6);
  }
  return null;
}
