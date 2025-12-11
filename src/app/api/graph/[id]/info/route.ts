/**
 * GET /api/graph/[id]/info - Get session info without full graph data
 *
 * Returns: SessionInfo with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/services/session-manager';
import type { ErrorResponse } from '@/lib/models/types';
import type { SessionInfo } from '@/lib/services/session-manager';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SessionInfo | ErrorResponse>> {
  try {
    const { id } = await params;

    // Get session info
    const info = getSessionInfo(id);

    if (!info) {
      return NextResponse.json(
        { error: 'Not Found', message: `Session with ID '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(info);
  } catch (e) {
    console.error('Session info retrieval error:', e);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: e instanceof Error ? e.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
