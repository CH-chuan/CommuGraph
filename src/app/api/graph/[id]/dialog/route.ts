/**
 * GET /api/graph/[id]/dialog - Get dialog records for Claude Code logs
 *
 * Returns: DialogResponse with dialog records for labeling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDialogRecords, getSession } from '@/lib/services/session-manager';
import { notFoundResponse, badRequestResponse, errorResponse } from '@/lib/api/responses';
import type { DialogResponse, ErrorResponse } from '@/lib/models/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DialogResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Get the session
    const session = getSession(id);

    if (!session) {
      return notFoundResponse('Session', id);
    }

    // Check if this is a Claude Code session
    if (session.framework !== 'claudecode') {
      return badRequestResponse('Dialog view is only available for Claude Code logs');
    }

    // Get the dialog records
    const records = getDialogRecords(id);

    if (!records) {
      return notFoundResponse('Dialog records', id);
    }

    // Calculate counts
    const userTurnCount = records.filter(a => a.unit_type === 'user_turn').length;
    const assistantTurnCount = records.filter(a => a.unit_type === 'assistant_turn').length;
    const systemTurnCount = records.filter(a => a.unit_type === 'system_turn').length;

    return NextResponse.json({
      records,
      total: records.length,
      user_turn_count: userTurnCount,
      assistant_turn_count: assistantTurnCount,
      system_turn_count: systemTurnCount,
    });
  } catch (e) {
    console.error('Dialog retrieval error:', e);
    return errorResponse(e);
  }
}
