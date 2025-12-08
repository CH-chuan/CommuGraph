"""
Session manager for storing and retrieving graph data.

Provides in-memory storage for processed graphs with optional persistence.
"""

import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional
import networkx as nx
from app.core.config import settings
from app.services.graph_builder import GraphBuilder


class SessionManager:
    """
    Manages graph sessions in memory.

    Each uploaded and processed log file gets a unique session ID.
    The session stores the original messages, built graph, and metadata.
    """

    def __init__(self):
        self._sessions: Dict[str, Dict] = {}

    def create_session(
        self,
        messages: list,
        framework: str,
        graph_builder: GraphBuilder
    ) -> str:
        """
        Create a new session for a processed graph.

        Args:
            messages: List of parsed Message objects
            framework: Framework name used for parsing
            graph_builder: GraphBuilder instance with built graph

        Returns:
            Unique session ID
        """
        session_id = str(uuid.uuid4())[:8]  # Short UUID for convenience

        self._sessions[session_id] = {
            'id': session_id,
            'messages': messages,
            'framework': framework,
            'graph_builder': graph_builder,
            'created_at': datetime.now(),
            'last_accessed': datetime.now(),
            'metadata': {}
        }

        return session_id

    def get_session(self, session_id: str) -> Optional[Dict]:
        """
        Retrieve a session by ID.

        Args:
            session_id: The session identifier

        Returns:
            Session dictionary or None if not found
        """
        if session_id not in self._sessions:
            return None

        # Update last accessed time
        self._sessions[session_id]['last_accessed'] = datetime.now()

        return self._sessions[session_id]

    def get_graph_builder(self, session_id: str) -> Optional[GraphBuilder]:
        """
        Get the GraphBuilder for a session.

        Args:
            session_id: The session identifier

        Returns:
            GraphBuilder instance or None if not found
        """
        session = self.get_session(session_id)
        return session['graph_builder'] if session else None

    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session.

        Args:
            session_id: The session identifier

        Returns:
            True if deleted, False if not found
        """
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def cleanup_expired_sessions(self) -> int:
        """
        Remove sessions older than SESSION_EXPIRY_HOURS.

        Returns:
            Number of sessions cleaned up
        """
        expiry_time = datetime.now() - timedelta(hours=settings.SESSION_EXPIRY_HOURS)
        expired_sessions = [
            sid for sid, session in self._sessions.items()
            if session['last_accessed'] < expiry_time
        ]

        for session_id in expired_sessions:
            del self._sessions[session_id]

        return len(expired_sessions)

    def get_session_count(self) -> int:
        """Get the number of active sessions."""
        return len(self._sessions)

    def list_sessions(self) -> list:
        """
        List all active session IDs with basic metadata.

        Returns:
            List of session info dictionaries
        """
        return [
            {
                'id': session['id'],
                'framework': session['framework'],
                'created_at': session['created_at'].isoformat(),
                'message_count': len(session['messages'])
            }
            for session in self._sessions.values()
        ]


# Global session manager instance
session_manager = SessionManager()
