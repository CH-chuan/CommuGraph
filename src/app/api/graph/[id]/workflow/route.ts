/**
 * GET /api/graph/[id]/workflow - Get workflow graph for Claude Code logs
 *
 * Query params:
 * - step (optional): Maximum step to include (for time-slider filtering)
 *
 * Returns: WorkflowGraphSnapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowGraph, getSession } from '@/lib/services/session-manager';
import { WorkflowGraphBuilder } from '@/lib/services/workflow-graph-builder';
import { notFoundResponse, badRequestResponse, errorResponse } from '@/lib/api/responses';
import type { WorkflowResponse, ErrorResponse } from '@/lib/models/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<WorkflowResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const stepParam = searchParams.get('step');

    // Get the session
    const session = getSession(id);

    if (!session) {
      return notFoundResponse('Session', id);
    }

    // Check if this is a Claude Code session
    if (session.framework !== 'claudecode') {
      return badRequestResponse('Workflow view is only available for Claude Code logs');
    }

    // Get the workflow graph
    let workflow = getWorkflowGraph(id);

    if (!workflow) {
      return notFoundResponse('Workflow graph', id);
    }

    // Parse step parameter and filter if needed
    if (stepParam !== null) {
      const step = parseInt(stepParam, 10);
      if (isNaN(step) || step < 0) {
        return badRequestResponse('Invalid step parameter');
      }

      // Get filtered snapshot at specific step
      const builder = new WorkflowGraphBuilder();
      workflow = builder.getSnapshotAtStep(workflow, step);
    }

    return NextResponse.json({ workflow });
  } catch (e) {
    console.error('Workflow retrieval error:', e);
    return errorResponse(e);
  }
}
