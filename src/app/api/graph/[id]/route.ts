/**
 * GET /api/graph/[id] - Get graph snapshot
 *
 * Query params:
 * - step (optional): Maximum step to include (for time-slider filtering)
 *
 * Returns: GraphResponse with filtered GraphSnapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGraphBuilder } from '@/lib/services/session-manager';
import type { GraphResponse, ErrorResponse } from '@/lib/models/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<GraphResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const stepParam = searchParams.get('step');

    // Get the graph builder for this session
    const graphBuilder = getGraphBuilder(id);

    if (!graphBuilder) {
      return NextResponse.json(
        { error: 'Not Found', message: `Graph with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Parse step parameter
    let step: number | undefined;
    if (stepParam !== null) {
      step = parseInt(stepParam, 10);
      if (isNaN(step) || step < 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid step parameter' },
          { status: 400 }
        );
      }
    }

    // Get the graph snapshot (filtered if step provided)
    const snapshot = graphBuilder.toGraphSnapshot(step);

    return NextResponse.json({ graph: snapshot });
  } catch (e) {
    console.error('Graph retrieval error:', e);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: e instanceof Error ? e.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
