from abc import ABC, abstractmethod
from typing import List, Union
from pathlib import Path
from commugraph.models.types import Message

class BaseParser(ABC):
    """
    Abstract base class for all log parsers.
    """
    
    @abstractmethod
    def parse(self, file_path: Union[str, Path]) -> List[Message]:
        """
        Parse a log file and return a list of normalized Message objects.
        
        Args:
            file_path: Path to the log file (jsonl, txt, etc.)
            
        Returns:
            List[Message]: Chronologically ordered list of messages.
        """
        pass

