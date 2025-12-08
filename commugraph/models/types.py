from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class Interaction(BaseModel):
    """
    Represents a single point of contact/message exchange within an edge.
    Crucial for temporal analysis.
    """
    timestamp: datetime
    step_index: int
    intent: str = "unknown"
    message_id: str
    content_preview: Optional[str] = None  # First 50 chars for tooltips

class EdgeData(BaseModel):
    """
    Rich data attached to a directional edge (Source -> Target).
    """
    source: str
    target: str
    weight: int = 0
    interactions: List[Interaction] = Field(default_factory=list)
    
    def add_interaction(self, interaction: Interaction):
        self.interactions.append(interaction)
        self.weight = len(self.interactions)

class Agent(BaseModel):
    """
    Node attributes for an agent.
    """
    name: str
    role: Optional[str] = None
    system_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class Message(BaseModel):
    """
    Normalized message format after parsing raw logs.
    """
    id: str
    sender: str
    receiver: Optional[str] = None  # None implies broadcast or 'all'
    content: str
    timestamp: datetime
    step_index: int
    intent: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

