"""
Upload endpoint for log file processing.

Handles file uploads, parsing, and graph construction.
"""

import shutil
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from app.core.config import settings
from app.schemas.api import ErrorResponse, UploadResponse, FrameworkListResponse
from app.services.parser import ParserService
from app.services.graph_builder import GraphBuilder
from app.services.session_manager import session_manager
from app.parsers.base_parser import ParserError


router = APIRouter()


@router.get("/frameworks", response_model=FrameworkListResponse)
async def list_frameworks():
    """
    Get list of supported log frameworks.

    Returns a list of framework names that can be used for parsing.
    """
    frameworks = ParserService.get_available_parsers()
    return FrameworkListResponse(frameworks=frameworks)


@router.post("/upload", response_model=UploadResponse, responses={400: {"model": ErrorResponse}})
async def upload_log_file(
    file: UploadFile = File(..., description="Log file (JSONL or JSON)"),
    framework: str = Form(..., description="Framework name (e.g., 'autogen', 'crewai')")
):
    """
    Upload and process a multi-agent conversation log file.

    This endpoint performs the "Pre-Flight" stage:
    1. Receives the uploaded file
    2. Parses it using the specified framework parser
    3. Builds the temporal graph
    4. Stores the session in memory
    5. Returns a graph_id for subsequent queries

    **Supported Frameworks:**
    - autogen: AutoGen conversation logs

    **File Format:**
    - JSONL (JSON Lines): One JSON object per line
    - JSON: Single JSON array of message objects
    """
    # Validate framework
    if framework not in ParserService.get_available_parsers():
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported framework: {framework}. "
                   f"Available: {', '.join(ParserService.get_available_parsers())}"
        )

    # Validate file size
    if file.size and file.size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE / (1024*1024)}MB"
        )

    # Save uploaded file temporarily
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    temp_file_path = upload_dir / f"temp_{file.filename}"

    try:
        # Save the uploaded file
        with temp_file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Parse the log file
        try:
            messages = ParserService.parse_log(temp_file_path, framework)
        except ParserError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error during parsing: {str(e)}"
            )

        # Build the graph
        try:
            graph_builder = GraphBuilder()
            graph_builder.build_graph(messages)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to build graph: {str(e)}"
            )

        # Create session
        session_id = session_manager.create_session(
            messages=messages,
            framework=framework,
            graph_builder=graph_builder
        )

        # Get graph snapshot for response
        snapshot = graph_builder.to_graph_snapshot()

        return UploadResponse(
            graph_id=session_id,
            message_count=len(messages),
            node_count=len(snapshot.nodes),
            edge_count=len(snapshot.edges),
            total_steps=snapshot.total_steps,
            framework=framework
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file_path.exists():
            temp_file_path.unlink()


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session and free up memory.

    Args:
        session_id: The session identifier to delete
    """
    if session_manager.delete_session(session_id):
        return {"message": f"Session {session_id} deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/sessions")
async def list_sessions():
    """
    List all active sessions.

    Useful for debugging and monitoring.
    """
    sessions = session_manager.list_sessions()
    return {
        "count": len(sessions),
        "sessions": sessions
    }
