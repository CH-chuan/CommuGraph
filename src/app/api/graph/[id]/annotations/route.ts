/**
 * GET /api/graph/[id]/annotations - Get annotation records for Claude Code logs
 *
 * Returns: AnnotationsResponse with annotation records for labeling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnnotationRecords, getSession } from '@/lib/services/session-manager';
import type { AnnotationRecord } from '@/lib/annotation/types';
import type { ErrorResponse } from '@/lib/models/types';

interface AnnotationsResponse {
  annotations: AnnotationRecord[];
  total: number;
  user_turn_count: number;
  assistant_turn_count: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<AnnotationsResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Get the session
    const session = getSession(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Not Found', message: `Session with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Check if this is a Claude Code session
    if (session.framework !== 'claudecode') {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Annotation view is only available for Claude Code logs'
        },
        { status: 400 }
      );
    }

    // Get the annotation records
    const annotations = getAnnotationRecords(id);

    if (!annotations) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Annotation records not found for this session' },
        { status: 404 }
      );
    }

    // Calculate counts
    const userTurnCount = annotations.filter(a => a.unit_type === 'user_turn').length;
    const assistantTurnCount = annotations.filter(a => a.unit_type === 'assistant_turn').length;

    return NextResponse.json({
      annotations,
      total: annotations.length,
      user_turn_count: userTurnCount,
      assistant_turn_count: assistantTurnCount,
    });
  } catch (e) {
    console.error('Annotations retrieval error:', e);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: e instanceof Error ? e.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
