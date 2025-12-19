/**
 * DELETE /api/session/[id] - Delete a session
 *
 * Returns: Success message or 404 if not found
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/services/session-manager';
import { notFoundResponse, errorResponse } from '@/lib/api/responses';
import type { ErrorResponse } from '@/lib/models/types';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ message: string } | ErrorResponse>> {
  try {
    const { id } = await params;

    const deleted = deleteSession(id);

    if (!deleted) {
      return notFoundResponse('Session', id);
    }

    return NextResponse.json({ message: `Session '${id}' deleted successfully` });
  } catch (e) {
    console.error('Session deletion error:', e);
    return errorResponse(e);
  }
}
