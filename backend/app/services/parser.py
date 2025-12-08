"""
Parser service for coordinating different framework-specific parsers.

Provides a unified interface for parsing logs from different MAS frameworks.
"""

from pathlib import Path
from typing import Dict, List, Type
from app.models.types import Message
from app.parsers.base_parser import BaseParser
from app.parsers.autogen_parser import AutoGenParser


# Registry of available parsers
PARSER_REGISTRY: Dict[str, Type[BaseParser]] = {
    "autogen": AutoGenParser,
    # Future parsers will be added here:
    # "crewai": CrewAIParser,
    # "langgraph": LangGraphParser,
}


class ParserService:
    """
    Service for managing and executing log file parsers.

    Provides a unified interface for parsing logs from different frameworks.
    """

    @staticmethod
    def get_available_parsers() -> List[str]:
        """
        Get list of available parser names.

        Returns:
            List of parser names (e.g., ["autogen", "crewai"])
        """
        return list(PARSER_REGISTRY.keys())

    @staticmethod
    def parse_log(file_path: Path, framework: str) -> List[Message]:
        """
        Parse a log file using the appropriate parser.

        Args:
            file_path: Path to the log file
            framework: Framework name (e.g., "autogen", "crewai")

        Returns:
            List of Message objects

        Raises:
            ValueError: If framework is not supported
            FileNotFoundError: If file does not exist
            ParserError: If parsing fails
        """
        if framework not in PARSER_REGISTRY:
            raise ValueError(
                f"Unsupported framework: {framework}. "
                f"Available parsers: {', '.join(PARSER_REGISTRY.keys())}"
            )

        parser_class = PARSER_REGISTRY[framework]
        parser = parser_class()

        return parser.parse(file_path)

    @staticmethod
    def detect_framework(file_path: Path) -> str:
        """
        Attempt to auto-detect the framework from log file content.

        This is a best-effort approach. Users should specify the framework
        explicitly when possible.

        Args:
            file_path: Path to the log file

        Returns:
            Detected framework name or "unknown"
        """
        # TODO: Implement framework detection heuristics
        # For now, default to autogen
        return "autogen"
