"""
Pytest configuration and shared fixtures.

This file contains fixtures used across multiple test modules.
"""

import pytest
from pathlib import Path
from datetime import datetime
from app.models.types import Message, MessageType


@pytest.fixture
def fixtures_dir() -> Path:
    """Return the path to the fixtures directory."""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def autogen_sample_file(fixtures_dir: Path) -> Path:
    """Return path to sample AutoGen log file."""
    return fixtures_dir / "autogen_sample.jsonl"


@pytest.fixture
def sample_messages():
    """Return a list of sample Message objects for testing."""
    return [
        Message(
            step_index=0,
            timestamp=datetime(2024, 1, 15, 10, 0, 0),
            sender="Manager",
            receiver="Coder",
            message_type=MessageType.DELEGATION,
            content="Please implement the user authentication feature",
            metadata={"role": "user"}
        ),
        Message(
            step_index=1,
            timestamp=datetime(2024, 1, 15, 10, 0, 5),
            sender="Coder",
            receiver="Manager",
            message_type=MessageType.RESPONSE,
            content="I'll start working on the authentication feature.",
            metadata={"role": "assistant"}
        ),
        Message(
            step_index=2,
            timestamp=datetime(2024, 1, 15, 10, 0, 15),
            sender="Coder",
            receiver="Manager",
            message_type=MessageType.RESPONSE,
            content="I've created the authentication module with JWT token support.",
            metadata={"role": "assistant"}
        ),
        Message(
            step_index=3,
            timestamp=datetime(2024, 1, 15, 10, 0, 30),
            sender="Manager",
            receiver="Tester",
            message_type=MessageType.DELEGATION,
            content="Can you test the new authentication feature?",
            metadata={"role": "user"}
        ),
        Message(
            step_index=4,
            timestamp=datetime(2024, 1, 15, 10, 0, 35),
            sender="Tester",
            receiver="Manager",
            message_type=MessageType.RESPONSE,
            content="Running tests on the authentication module...",
            metadata={"role": "assistant"}
        ),
    ]
