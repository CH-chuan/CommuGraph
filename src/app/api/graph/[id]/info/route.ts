/**
 * GET /api/graph/[id]/info - Get session info without full graph data
 *
 * Returns: SessionInfo with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/services/session-manager';
import { notFoundResponse, errorResponse } from '@/lib/api/responses';
import type { SessionInfo } from '@/lib/services/session-manager';
import type { ErrorResponse } from '@/lib/models/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SessionInfo | ErrorResponse>> {
  try {
    const { id } = await params;

    // Get session info
    const info = getSessionInfo(id);

    if (!info) {
      return notFoundResponse('Session', id);
    }

    return NextResponse.json(info);
  } catch (e) {
    console.error('Session info retrieval error:', e);
    return errorResponse(e);
  }
}
