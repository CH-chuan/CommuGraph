"""
Unit tests for log file parsers.

Tests the BaseParser and AutoGenParser implementations.
"""

import pytest
from pathlib import Path
from app.parsers.autogen_parser import AutoGenParser
from app.parsers.base_parser import ParserError
from app.models.types import Message, MessageType


class TestAutoGenParser:
    """Test suite for AutoGenParser."""

    def test_parse_valid_jsonl_file(self, autogen_sample_file: Path):
        """Test parsing a valid AutoGen JSONL file."""
        parser = AutoGenParser()
        messages = parser.parse(autogen_sample_file)

        # Verify we got messages
        assert len(messages) > 0
        assert all(isinstance(m, Message) for m in messages)

        # Verify first message
        first_msg = messages[0]
        assert first_msg.sender == "Manager"
        assert first_msg.receiver == "Coder"
        assert "authentication" in first_msg.content.lower()

    def test_parse_extracts_all_fields(self, autogen_sample_file: Path):
        """Test that all message fields are extracted correctly."""
        parser = AutoGenParser()
        messages = parser.parse(autogen_sample_file)

        for msg in messages:
            # All required fields should be present
            assert msg.step_index >= 0
            assert msg.timestamp is not None
            assert msg.sender is not None
            assert msg.content is not None
            assert msg.message_type in MessageType

    def test_parse_maintains_order(self, autogen_sample_file: Path):
        """Test that messages are in chronological order."""
        parser = AutoGenParser()
        messages = parser.parse(autogen_sample_file)

        # Step indices should be sequential
        for i, msg in enumerate(messages):
            assert msg.step_index == i

        # Timestamps should be in order
        timestamps = [msg.timestamp for msg in messages]
        assert timestamps == sorted(timestamps)

    def test_parse_infers_message_types(self, autogen_sample_file: Path):
        """Test that message types are inferred correctly."""
        parser = AutoGenParser()
        messages = parser.parse(autogen_sample_file)

        # First message should be delegation (contains "Please")
        assert messages[0].message_type == MessageType.DELEGATION

        # Response messages should be classified correctly
        assert any(msg.message_type == MessageType.RESPONSE for msg in messages)

    def test_parse_nonexistent_file(self):
        """Test that parsing a nonexistent file raises an error."""
        parser = AutoGenParser()
        fake_path = Path("/nonexistent/file.jsonl")

        with pytest.raises(FileNotFoundError):
            parser.parse(fake_path)

    def test_parse_empty_file(self, tmp_path: Path):
        """Test that parsing an empty file raises an error."""
        empty_file = tmp_path / "empty.jsonl"
        empty_file.write_text("")

        parser = AutoGenParser()

        with pytest.raises(ValueError, match="empty"):
            parser.parse(empty_file)

    def test_parse_invalid_json(self, tmp_path: Path):
        """Test that invalid JSON raises a ParserError."""
        invalid_file = tmp_path / "invalid.jsonl"
        invalid_file.write_text("not valid json\n{incomplete")

        parser = AutoGenParser()

        with pytest.raises(ParserError):
            parser.parse(invalid_file)

    def test_parse_json_array_format(self, tmp_path: Path):
        """Test parsing a JSON array (not JSONL)."""
        json_array_file = tmp_path / "array.json"
        json_array_file.write_text('''[
            {"sender": "A", "recipient": "B", "message": {"content": "Hello"}, "role": "user"},
            {"sender": "B", "recipient": "A", "message": {"content": "Hi"}, "role": "assistant"}
        ]''')

        parser = AutoGenParser()
        messages = parser.parse(json_array_file)

        assert len(messages) == 2
        assert messages[0].sender == "A"
        assert messages[1].sender == "B"

    def test_parser_string_representation(self):
        """Test parser string representation."""
        parser = AutoGenParser()

        assert "AutoGenParser" in str(parser)
        assert "autogen" in str(parser)
