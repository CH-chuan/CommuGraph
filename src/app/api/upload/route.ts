/**
 * POST /api/upload - Upload and process log file
 *
 * Accepts multipart form data with:
 * - file: The log file (JSONL or JSON)
 * - framework: Framework name (e.g., 'autogen')
 *
 * Returns: UploadResponse with graph_id and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseLog } from '@/lib/services/parser-service';
import { GraphBuilder } from '@/lib/services/graph-builder';
import { createSession } from '@/lib/services/session-manager';
import { ParserError } from '@/lib/parsers/base-parser';
import type { UploadResponse, ErrorResponse } from '@/lib/models/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse | ErrorResponse>> {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const framework = formData.get('framework') as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No file provided' },
        { status: 400 }
      );
    }

    if (!framework) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No framework specified' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Bad Request', message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Parse the log file
    let messages;
    try {
      messages = parseLog(content, framework);
    } catch (e) {
      if (e instanceof ParserError) {
        return NextResponse.json(
          {
            error: 'Parse Error',
            message: e.message,
            details: { lineNumber: e.lineNumber },
          },
          { status: 400 }
        );
      }
      throw e;
    }

    // Build the graph
    const graphBuilder = new GraphBuilder();
    graphBuilder.buildGraph(messages);

    // Create session
    const sessionId = createSession(messages, framework, graphBuilder);

    // Get graph info
    const graph = graphBuilder.getGraph();
    const totalSteps = messages.length > 0
      ? Math.max(...messages.map((m) => m.step_index))
      : 0;

    const response: UploadResponse = {
      graph_id: sessionId,
      message_count: messages.length,
      node_count: graph?.numberOfNodes() ?? 0,
      edge_count: graph?.numberOfEdges() ?? 0,
      total_steps: totalSteps,
      framework,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: e instanceof Error ? e.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
