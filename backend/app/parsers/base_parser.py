"""
Base parser abstract class for multi-agent framework log parsing.

All framework-specific parsers (AutoGen, CrewAI, LangGraph, etc.) must
inherit from BaseParser and implement the parse() method.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import List
from app.models.types import Message


class BaseParser(ABC):
    """
    Abstract base class for all log file parsers.

    Each framework (AutoGen, CrewAI, etc.) has its own log format.
    This class defines the common interface for parsing logs into
    a standardized Message list.
    """

    def __init__(self):
        """Initialize the parser."""
        self.framework_name = self.__class__.__name__.replace("Parser", "").lower()

    @abstractmethod
    def parse(self, file_path: Path) -> List[Message]:
        """
        Parse a log file into a list of Message objects.

        Args:
            file_path: Path to the log file (typically JSONL or JSON)

        Returns:
            List of Message objects in chronological order

        Raises:
            ValueError: If the file format is invalid or cannot be parsed
            FileNotFoundError: If the file does not exist
        """
        pass

    def validate_file(self, file_path: Path) -> None:
        """
        Validate that the file exists and is readable.

        Args:
            file_path: Path to the file to validate

        Raises:
            FileNotFoundError: If file does not exist
            PermissionError: If file is not readable
        """
        if not file_path.exists():
            raise FileNotFoundError(f"Log file not found: {file_path}")

        if not file_path.is_file():
            raise ValueError(f"Path is not a file: {file_path}")

        if not file_path.stat().st_size > 0:
            raise ValueError(f"File is empty: {file_path}")

    def __str__(self) -> str:
        return f"{self.__class__.__name__}(framework={self.framework_name})"

    def __repr__(self) -> str:
        return self.__str__()


class ParserError(Exception):
    """Custom exception for parser-specific errors."""

    def __init__(self, message: str, line_number: int = None, original_error: Exception = None):
        self.message = message
        self.line_number = line_number
        self.original_error = original_error
        super().__init__(self.format_error())

    def format_error(self) -> str:
        """Format the error message with context."""
        error_msg = f"Parser Error: {self.message}"
        if self.line_number:
            error_msg += f" (line {self.line_number})"
        if self.original_error:
            error_msg += f" - Original error: {str(self.original_error)}"
        return error_msg
