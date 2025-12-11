/**
 * GET /api/graph/[id]/metrics - Get graph metrics
 *
 * Returns: MetricsResponse with node_count, edge_count, density, centrality
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGraphBuilder } from '@/lib/services/session-manager';
import type { MetricsResponse, ErrorResponse } from '@/lib/models/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<MetricsResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Get the graph builder for this session
    const graphBuilder = getGraphBuilder(id);

    if (!graphBuilder) {
      return NextResponse.json(
        { error: 'Not Found', message: `Graph with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // Get metrics
    const metrics = graphBuilder.getGraphMetrics();

    const response: MetricsResponse = {
      node_count: metrics.node_count as number,
      edge_count: metrics.edge_count as number,
      density: metrics.density as number,
      centrality: metrics.degree_centrality as Record<string, number> | undefined,
      in_degree_centrality: metrics.in_degree_centrality as Record<string, number> | undefined,
      out_degree_centrality: metrics.out_degree_centrality as Record<string, number> | undefined,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error('Metrics retrieval error:', e);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: e instanceof Error ? e.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
