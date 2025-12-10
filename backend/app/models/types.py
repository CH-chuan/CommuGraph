"""
Core Pydantic models for CommuGraph.

These models define the data structures for:
- Messages: Individual chat log entries
- Interactions: Time-stamped edge traversals
- Graph elements: Nodes and edges with temporal data
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Types of messages in multi-agent conversations."""
    THOUGHT = "thought"
    ACTION = "action"
    OBSERVATION = "observation"
    DELEGATION = "delegation"
    RESPONSE = "response"
    SYSTEM = "system"


class IntentLabel(str, Enum):
    """Intent labels for edge interactions (abstraction layer)."""
    DELEGATION = "delegation"
    INFORMATION_REQUEST = "information_request"
    INFORMATION_RESPONSE = "information_response"
    FEEDBACK = "feedback"
    COORDINATION = "coordination"
    UNKNOWN = "unknown"


class Message(BaseModel):
    """
    Represents a single message in a multi-agent conversation log.

    This is the core unit parsed from log files (AutoGen, CrewAI, etc.).
    """
    step_index: int = Field(..., description="Sequential step number in the conversation")
    timestamp: datetime = Field(..., description="When the message was sent")
    sender: str = Field(..., description="Agent/node that sent the message")
    receiver: Optional[str] = Field(None, description="Agent/node that received the message")
    message_type: MessageType = Field(..., description="Classification of message type")
    content: str = Field(..., description="The actual message text")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional framework-specific data")

    class Config:
        json_schema_extra = {
            "example": {
                "step_index": 5,
                "timestamp": "2024-01-15T10:30:00Z",
                "sender": "Manager",
                "receiver": "Coder",
                "message_type": "delegation",
                "content": "Please implement the user authentication feature",
                "metadata": {"token_count": 12}
            }
        }


class Interaction(BaseModel):
    """
    Represents a single interaction on an edge at a specific point in time.

    This enables temporal edge modeling - edges accumulate interactions over time.
    """
    step_index: int = Field(..., description="Step when this interaction occurred")
    timestamp: datetime = Field(..., description="When this interaction occurred")
    intent: IntentLabel = Field(default=IntentLabel.UNKNOWN, description="Semantic intent of interaction")
    message_id: Optional[int] = Field(None, description="Reference to the message that created this interaction")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional interaction data")

    class Config:
        json_schema_extra = {
            "example": {
                "step_index": 5,
                "timestamp": "2024-01-15T10:30:00Z",
                "intent": "delegation",
                "message_id": 5,
                "metadata": {}
            }
        }


class EdgeData(BaseModel):
    """
    Represents an edge between two nodes with temporal interaction history.

    This is the core innovation: edges store a list of interactions rather than
    just a static weight, enabling time-slider visualization.
    """
    source: str = Field(..., description="Source node/agent ID")
    target: str = Field(..., description="Target node/agent ID")
    interactions: List[Interaction] = Field(default_factory=list, description="Chronological list of interactions")
    weight: int = Field(default=0, description="Total number of interactions (cached for performance)")

    class Config:
        json_schema_extra = {
            "example": {
                "source": "Manager",
                "target": "Coder",
                "interactions": [
                    {
                        "step_index": 5,
                        "timestamp": "2024-01-15T10:30:00Z",
                        "intent": "delegation",
                        "message_id": 5
                    }
                ],
                "weight": 1
            }
        }


class NodeData(BaseModel):
    """
    Represents a node (agent) in the communication graph.
    """
    id: str = Field(..., description="Unique agent identifier")
    label: str = Field(..., description="Display name for the agent")
    message_count: int = Field(default=0, description="Total messages sent by this agent (deprecated, use messages_sent)")
    messages_sent: int = Field(default=0, description="Total messages sent by this agent")
    messages_received: int = Field(default=0, description="Total messages received by this agent")
    first_appearance: Optional[datetime] = Field(None, description="First time agent appeared in conversation")
    last_activity: Optional[datetime] = Field(None, description="Last time agent sent a message")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional node properties")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "Manager",
                "label": "Manager",
                "message_count": 15,
                "messages_sent": 15,
                "messages_received": 8,
                "first_appearance": "2024-01-15T10:00:00Z",
                "last_activity": "2024-01-15T11:00:00Z",
                "metadata": {"role": "coordinator"}
            }
        }


class GraphSnapshot(BaseModel):
    """
    Represents a complete graph state at a specific point in time.

    This is what gets returned by API endpoints for visualization.
    """
    nodes: List[NodeData] = Field(default_factory=list, description="All nodes in the graph")
    edges: List[EdgeData] = Field(default_factory=list, description="All edges with interaction history")
    current_step: Optional[int] = Field(None, description="Current step index (if time-filtered)")
    total_steps: int = Field(..., description="Total steps in the conversation")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Graph-level metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "nodes": [
                    {"id": "Manager", "label": "Manager", "message_count": 15},
                    {"id": "Coder", "label": "Coder", "message_count": 10}
                ],
                "edges": [
                    {
                        "source": "Manager",
                        "target": "Coder",
                        "interactions": [],
                        "weight": 5
                    }
                ],
                "current_step": 10,
                "total_steps": 25,
                "metadata": {"framework": "autogen"}
            }
        }


class AnomalyType(str, Enum):
    """Types of anomalies detected in conversation flow."""
    CIRCULAR_LOOP = "circular_loop"
    STAGNATION = "stagnation"
    ISOLATION = "isolation"
    EXCESSIVE_TOKENS = "excessive_tokens"


class Anomaly(BaseModel):
    """
    Represents a detected anomaly in the conversation flow.

    Anomalies are detected using rule-based logic (not LLMs) for reliability.
    """
    type: AnomalyType = Field(..., description="Type of anomaly detected")
    step_index: int = Field(..., description="Step where anomaly was detected")
    severity: int = Field(..., ge=1, le=5, description="Severity level (1=low, 5=critical)")
    description: str = Field(..., description="Human-readable description of the anomaly")
    affected_agents: List[str] = Field(default_factory=list, description="Agents involved in the anomaly")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional anomaly details")

    class Config:
        json_schema_extra = {
            "example": {
                "type": "circular_loop",
                "step_index": 45,
                "severity": 4,
                "description": "Agents A and B repeated the same 3-step sequence 5 times",
                "affected_agents": ["Manager", "Coder"],
                "metadata": {"loop_count": 5, "pattern": ["Manager->Coder", "Coder->Manager"]}
            }
        }
