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
import type { WorkflowGraphSnapshot, ErrorResponse } from '@/lib/models/types';

interface WorkflowResponse {
  workflow: WorkflowGraphSnapshot;
}

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
          message: 'Workflow view is only available for Claude Code logs'
        },
        { status: 400 }
      );
    }

    // Get the workflow graph
    let workflow = getWorkflowGraph(id);

    if (!workflow) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Workflow graph not found for this session' },
        { status: 404 }
      );
    }

    // Parse step parameter and filter if needed
    if (stepParam !== null) {
      const step = parseInt(stepParam, 10);
      if (isNaN(step) || step < 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid step parameter' },
          { status: 400 }
        );
      }

      // Get filtered snapshot at specific step
      const builder = new WorkflowGraphBuilder();
      workflow = builder.getSnapshotAtStep(workflow, step);
    }

    return NextResponse.json({ workflow });
  } catch (e) {
    console.error('Workflow retrieval error:', e);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: e instanceof Error ? e.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
