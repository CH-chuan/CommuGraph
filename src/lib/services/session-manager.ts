/**
 * Session Manager - In-memory session storage for processed graphs
 *
 * Uses a module-level Map that persists across requests in the same server instance.
 * Note: Sessions are cleared on server restart (acceptable for dev/demo).
 */

import type { Message } from '@/lib/models/types';
import type { GraphBuilder } from './graph-builder';

export interface Session {
  id: string;
  messages: Message[];
  framework: string;
  graphBuilder: GraphBuilder;
  createdAt: Date;
  lastAccessed: Date;
  metadata: Record<string, unknown>;
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

// Module-level storage - persists across requests in the same server instance
const sessions = new Map<string, Session>();

// Session expiry time (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a short unique session ID (8 characters).
 */
function generateSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Create a new session with parsed messages and graph.
 *
 * @param messages - Parsed message list
 * @param framework - Framework name used for parsing
 * @param graphBuilder - GraphBuilder instance with built graph
 * @returns Session ID
 */
export function createSession(
  messages: Message[],
  framework: string,
  graphBuilder: GraphBuilder
): string {
  // Generate unique session ID
  let sessionId = generateSessionId();
  while (sessions.has(sessionId)) {
    sessionId = generateSessionId();
  }

  const now = new Date();

  const session: Session = {
    id: sessionId,
    messages,
    framework,
    graphBuilder,
    createdAt: now,
    lastAccessed: now,
    metadata: {},
  };

  sessions.set(sessionId, session);

  // Clean up expired sessions in the background
  cleanupExpiredSessions();

  return sessionId;
}

/**
 * Get a session by ID.
 *
 * @param sessionId - Session ID to look up
 * @returns Session object or null if not found
 */
export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Update last accessed time
  session.lastAccessed = new Date();

  return session;
}

/**
 * Get the GraphBuilder for a session.
 *
 * @param sessionId - Session ID
 * @returns GraphBuilder or null if session not found
 */
export function getGraphBuilder(sessionId: string): GraphBuilder | null {
  const session = getSession(sessionId);
  return session?.graphBuilder ?? null;
}

/**
 * Delete a session by ID.
 *
 * @param sessionId - Session ID to delete
 * @returns true if deleted, false if not found
 */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/**
 * Get session info without the full graph data.
 *
 * @param sessionId - Session ID
 * @returns SessionInfo or null if not found
 */
export function getSessionInfo(sessionId: string): SessionInfo | null {
  const session = getSession(sessionId);

  if (!session) {
    return null;
  }

  const graph = session.graphBuilder.getGraph();

  return {
    id: session.id,
    framework: session.framework,
    message_count: session.messages.length,
    node_count: graph?.numberOfNodes() ?? 0,
    edge_count: graph?.numberOfEdges() ?? 0,
    created_at: session.createdAt.toISOString(),
    last_accessed: session.lastAccessed.toISOString(),
  };
}

/**
 * List all active sessions.
 *
 * @returns Array of session info objects
 */
export function listSessions(): SessionInfo[] {
  const result: SessionInfo[] = [];

  for (const [id, session] of sessions) {
    const graph = session.graphBuilder.getGraph();
    result.push({
      id,
      framework: session.framework,
      message_count: session.messages.length,
      node_count: graph?.numberOfNodes() ?? 0,
      edge_count: graph?.numberOfEdges() ?? 0,
      created_at: session.createdAt.toISOString(),
      last_accessed: session.lastAccessed.toISOString(),
    });
  }

  return result;
}

/**
 * Clean up expired sessions.
 *
 * @returns Number of sessions cleaned up
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, session] of sessions) {
    const age = now - session.lastAccessed.getTime();
    if (age > SESSION_EXPIRY_MS) {
      sessions.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get the number of active sessions.
 */
export function getSessionCount(): number {
  return sessions.size;
}

/**
 * Clear all sessions (useful for testing).
 */
export function clearAllSessions(): void {
  sessions.clear();
}
