"""
API request and response schemas.

These Pydantic models define the structure of API requests and responses.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.types import GraphSnapshot


class UploadResponse(BaseModel):
    """Response after successful log file upload."""
    graph_id: str = Field(..., description="Unique identifier for the processed graph")
    message_count: int = Field(..., description="Number of messages parsed")
    node_count: int = Field(..., description="Number of nodes (agents) in the graph")
    edge_count: int = Field(..., description="Number of edges in the graph")
    total_steps: int = Field(..., description="Total conversation steps")
    framework: str = Field(..., description="Framework used to parse logs")

    class Config:
        json_schema_extra = {
            "example": {
                "graph_id": "abc123",
                "message_count": 42,
                "node_count": 5,
                "edge_count": 12,
                "total_steps": 42,
                "framework": "autogen"
            }
        }


class ErrorResponse(BaseModel):
    """Error response schema."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict] = Field(None, description="Additional error details")

    class Config:
        json_schema_extra = {
            "example": {
                "error": "ParserError",
                "message": "Failed to parse log file",
                "details": {"line_number": 42}
            }
        }


class GraphRequest(BaseModel):
    """Request parameters for graph retrieval."""
    graph_id: str = Field(..., description="Graph identifier")
    step: Optional[int] = Field(None, description="Maximum step to include (for time-slider)")
    include_metadata: bool = Field(True, description="Include detailed metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "graph_id": "abc123",
                "step": 25,
                "include_metadata": True
            }
        }


class GraphResponse(BaseModel):
    """Response containing graph data."""
    graph: GraphSnapshot = Field(..., description="Graph snapshot data")

    class Config:
        json_schema_extra = {
            "example": {
                "graph": {
                    "nodes": [],
                    "edges": [],
                    "current_step": 25,
                    "total_steps": 42,
                    "metadata": {}
                }
            }
        }


class FrameworkListResponse(BaseModel):
    """Response listing available parsers."""
    frameworks: List[str] = Field(..., description="List of supported frameworks")

    class Config:
        json_schema_extra = {
            "example": {
                "frameworks": ["autogen", "crewai"]
            }
        }


class MetricsResponse(BaseModel):
    """Response containing graph metrics."""
    node_count: int = Field(..., description="Number of nodes")
    edge_count: int = Field(..., description="Number of edges")
    density: float = Field(..., description="Graph density")
    centrality: Optional[Dict] = Field(None, description="Centrality measures")

    class Config:
        json_schema_extra = {
            "example": {
                "node_count": 5,
                "edge_count": 12,
                "density": 0.6,
                "centrality": {
                    "Manager": 0.8,
                    "Coder": 0.6
                }
            }
        }
