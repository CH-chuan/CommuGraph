/**
 * GET /api/graph/[id]/annotations - Get annotation records for Claude Code logs
 *
 * Returns: AnnotationsResponse with annotation records for labeling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnnotationRecords, getSession } from '@/lib/services/session-manager';
import { notFoundResponse, badRequestResponse, errorResponse } from '@/lib/api/responses';
import type { AnnotationsResponse, ErrorResponse } from '@/lib/models/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<AnnotationsResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Get the session
    const session = getSession(id);

    if (!session) {
      return notFoundResponse('Session', id);
    }

    // Check if this is a Claude Code session
    if (session.framework !== 'claudecode') {
      return badRequestResponse('Annotation view is only available for Claude Code logs');
    }

    // Get the annotation records
    const annotations = getAnnotationRecords(id);

    if (!annotations) {
      return notFoundResponse('Annotation records', id);
    }

    // Calculate counts
    const userTurnCount = annotations.filter(a => a.unit_type === 'user_turn').length;
    const assistantTurnCount = annotations.filter(a => a.unit_type === 'assistant_turn').length;
    const systemTurnCount = annotations.filter(a => a.unit_type === 'system_turn').length;

    return NextResponse.json({
      annotations,
      total: annotations.length,
      user_turn_count: userTurnCount,
      assistant_turn_count: assistantTurnCount,
      system_turn_count: systemTurnCount,
    });
  } catch (e) {
    console.error('Annotations retrieval error:', e);
    return errorResponse(e);
  }
}
