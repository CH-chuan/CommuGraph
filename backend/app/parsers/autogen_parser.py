"""
AutoGen log parser implementation.

Parses AutoGen conversation logs (typically JSONL format) into Message objects.
Handles various AutoGen log formats including nested messages and GroupChat logs.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.models.types import Message, MessageType
from app.parsers.base_parser import BaseParser, ParserError


class AutoGenParser(BaseParser):
    """
    Parser for AutoGen framework conversation logs.

    AutoGen logs typically contain:
    - sender: Agent name
    - recipient: Receiver agent name (or "all" for group chat)
    - message: The message content
    - role: "user", "assistant", "system", etc.
    - timestamp: Optional timestamp (may need to be inferred)
    """

    def parse(self, file_path: Path) -> List[Message]:
        """
        Parse AutoGen JSONL log file into Message objects.

        Args:
            file_path: Path to the AutoGen log file (.jsonl or .json)

        Returns:
            List of Message objects in chronological order

        Raises:
            ParserError: If the file cannot be parsed
        """
        self.validate_file(file_path)

        messages: List[Message] = []
        line_number = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # Check if this is a single JSON object or JSONL
                first_char = f.read(1)
                f.seek(0)

                if first_char == '[':
                    # Single JSON array
                    data = json.load(f)
                    for idx, entry in enumerate(data):
                        line_number = idx + 1
                        message = self._parse_entry(entry, idx)
                        if message:
                            messages.append(message)
                else:
                    # JSONL format (one JSON object per line)
                    for idx, line in enumerate(f):
                        line_number = idx + 1
                        line = line.strip()
                        if not line:
                            continue

                        try:
                            entry = json.loads(line)
                            message = self._parse_entry(entry, idx)
                            if message:
                                messages.append(message)
                        except json.JSONDecodeError as e:
                            raise ParserError(
                                f"Invalid JSON on line {line_number}",
                                line_number=line_number,
                                original_error=e
                            )

        except FileNotFoundError:
            raise
        except ParserError:
            raise
        except Exception as e:
            raise ParserError(
                f"Failed to parse AutoGen log file",
                line_number=line_number,
                original_error=e
            )

        if not messages:
            raise ParserError("No valid messages found in log file")

        return messages

    def _parse_entry(self, entry: Dict[str, Any], step_index: int) -> Optional[Message]:
        """
        Parse a single AutoGen log entry into a Message.

        Args:
            entry: Dictionary from JSON log entry
            step_index: The step number in the conversation

        Returns:
            Message object or None if entry should be skipped
        """
        # AutoGen logs can have various formats
        # Common fields: sender, recipient, message, role, content

        # Extract sender
        sender = entry.get('sender') or entry.get('name') or entry.get('from', 'unknown')

        # Extract receiver
        receiver = entry.get('recipient') or entry.get('to')
        if receiver == "all":
            receiver = None  # Broadcast message

        # Extract content
        content = None
        if 'message' in entry:
            msg = entry['message']
            if isinstance(msg, dict):
                content = msg.get('content') or msg.get('text') or str(msg)
            else:
                content = str(msg)
        elif 'content' in entry:
            content = entry['content']
        elif 'text' in entry:
            content = entry['text']

        if not content or content.strip() == '':
            return None  # Skip empty messages

        # Extract or infer timestamp
        timestamp = self._extract_timestamp(entry, step_index)

        # Infer message type
        message_type = self._infer_message_type(entry, content)

        # Extract metadata
        metadata = {
            'role': entry.get('role'),
            'raw_entry': entry  # Keep original for debugging
        }

        # Add token count if available
        if 'token_count' in entry:
            metadata['token_count'] = entry['token_count']

        return Message(
            step_index=step_index,
            timestamp=timestamp,
            sender=str(sender),
            receiver=str(receiver) if receiver else None,
            message_type=message_type,
            content=str(content),
            metadata=metadata
        )

    def _extract_timestamp(self, entry: Dict[str, Any], step_index: int) -> datetime:
        """
        Extract or infer timestamp from log entry.

        Args:
            entry: Log entry dictionary
            step_index: Step number (used for inference if no timestamp)

        Returns:
            datetime object
        """
        # Try to find timestamp field
        timestamp_fields = ['timestamp', 'time', 'created_at', 'date']
        for field in timestamp_fields:
            if field in entry:
                try:
                    ts = entry[field]
                    if isinstance(ts, (int, float)):
                        # Unix timestamp
                        return datetime.fromtimestamp(ts)
                    elif isinstance(ts, str):
                        # ISO format or other string format
                        return datetime.fromisoformat(ts.replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    continue

        # No timestamp found - infer based on step index
        # Use a base time and add step_index seconds
        base_time = datetime(2024, 1, 1, 0, 0, 0)
        return base_time.replace(microsecond=step_index * 1000)

    def _infer_message_type(self, entry: Dict[str, Any], content: str) -> MessageType:
        """
        Infer the message type from entry data and content.

        Args:
            entry: Log entry dictionary
            content: Message content

        Returns:
            MessageType enum value
        """
        # Check if there's an explicit type field
        if 'type' in entry:
            type_str = entry['type'].lower()
            if type_str in MessageType.__members__.values():
                return MessageType(type_str)

        # Check role field
        role = entry.get('role', '').lower()
        if role == 'system':
            return MessageType.SYSTEM

        # Check for common patterns in content
        content_lower = content.lower()

        # Check for delegation patterns
        delegation_keywords = ['please', 'can you', 'could you', 'implement', 'create', 'build']
        if any(keyword in content_lower for keyword in delegation_keywords):
            return MessageType.DELEGATION

        # Check for thought patterns
        thought_keywords = ['thinking', 'analyzing', 'considering', 'let me think']
        if any(keyword in content_lower for keyword in thought_keywords):
            return MessageType.THOUGHT

        # Check for action patterns
        action_keywords = ['executing', 'running', 'calling', 'function_call']
        if any(keyword in content_lower for keyword in action_keywords) or 'function_call' in entry:
            return MessageType.ACTION

        # Default to response
        return MessageType.RESPONSE
