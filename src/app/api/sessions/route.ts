/**
 * GET /api/sessions - List all active sessions
 *
 * Returns: Array of SessionInfo objects
 */

import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/services/session-manager';
import type { SessionInfo } from '@/lib/services/session-manager';

export async function GET(): Promise<NextResponse<{ sessions: SessionInfo[] }>> {
  const sessions = listSessions();
  return NextResponse.json({ sessions });
}
