"""
Graph endpoints for retrieving and analyzing graph data.

Provides endpoints for fetching graph snapshots with time-filtering.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.schemas.api import GraphResponse, MetricsResponse
from app.services.session_manager import session_manager


router = APIRouter()


@router.get("/graph/{graph_id}", response_model=GraphResponse)
async def get_graph(
    graph_id: str,
    step: Optional[int] = Query(
        None,
        description="Maximum step to include (for time-slider). If not provided, returns full graph.",
        ge=0
    )
):
    """
    Retrieve a graph snapshot, optionally filtered by step.

    This is the core endpoint for the visualization stage. The frontend
    calls this repeatedly as the user scrubs the timeline.

    **Query Parameters:**
    - `step`: Optional maximum step index to include
      - If provided: Returns graph filtered to show only interactions up to that step
      - If omitted: Returns complete graph with all interactions

    **Example Usage:**
    - `/api/graph/abc123` - Get full graph
    - `/api/graph/abc123?step=25` - Get graph up to step 25 (for time-slider)

    **Performance:**
    This operation is optimized for real-time interaction:
    - No re-parsing or re-computation
    - Simple filtering of pre-built graph
    - Typical response time: <100ms
    """
    # Get session
    graph_builder = session_manager.get_graph_builder(graph_id)

    if not graph_builder:
        raise HTTPException(
            status_code=404,
            detail=f"Graph not found: {graph_id}. It may have expired or been deleted."
        )

    try:
        # Get graph snapshot with optional filtering
        snapshot = graph_builder.to_graph_snapshot(max_step=step)

        return GraphResponse(graph=snapshot)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve graph: {str(e)}"
        )


@router.get("/graph/{graph_id}/metrics", response_model=MetricsResponse)
async def get_graph_metrics(graph_id: str):
    """
    Get graph metrics and centrality measures.

    Returns computed metrics including:
    - Node count
    - Edge count
    - Graph density
    - Degree centrality measures

    These metrics are useful for the "Insights" panel in the UI.
    """
    graph_builder = session_manager.get_graph_builder(graph_id)

    if not graph_builder:
        raise HTTPException(
            status_code=404,
            detail=f"Graph not found: {graph_id}"
        )

    try:
        metrics = graph_builder.get_graph_metrics()

        # Extract centrality for response
        centrality = None
        if 'degree_centrality' in metrics:
            centrality = metrics['degree_centrality']

        return MetricsResponse(
            node_count=metrics['node_count'],
            edge_count=metrics['edge_count'],
            density=metrics['density'],
            centrality=centrality
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate metrics: {str(e)}"
        )


@router.get("/graph/{graph_id}/info")
async def get_graph_info(graph_id: str):
    """
    Get basic information about a graph session.

    Returns metadata without the full graph data.
    """
    session = session_manager.get_session(graph_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Graph not found: {graph_id}"
        )

    return {
        "graph_id": session['id'],
        "framework": session['framework'],
        "message_count": len(session['messages']),
        "created_at": session['created_at'].isoformat(),
        "last_accessed": session['last_accessed'].isoformat()
    }
