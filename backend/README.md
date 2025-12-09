# CommuGraph Backend

FastAPI backend for CommuGraph - Process mining and analytics for multi-agent chat logs.

## Quick Start

### Installation

```bash
# Install dependencies with Poetry
poetry install

# Or with pip
pip install -e .
```

### Running the Server

```bash
# With Poetry
poetry run uvicorn app.main:app --reload --port 8001

# Or directly with uvicorn
uvicorn app.main:app --reload --port 8001
```

The API will be available at:
- **API**: http://localhost:8001
- **Interactive Docs**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

### Running Tests

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=app

# Run specific test file
poetry run pytest tests/test_parsers.py
```

### Code Quality

```bash
# Linting
poetry run ruff check .

# Formatting
poetry run black .

# Type checking
poetry run mypy app/

# Run all checks
poetry run ruff check . && poetry run black . && poetry run mypy app/ && poetry run pytest
```

## API Endpoints

### Upload & Parse
- `POST /api/upload` - Upload and parse a log file
- `GET /api/frameworks` - List supported frameworks
- `GET /api/sessions` - List active sessions
- `DELETE /api/session/{session_id}` - Delete a session

### Graph Retrieval
- `GET /api/graph/{graph_id}` - Get graph snapshot (with optional time-filtering)
- `GET /api/graph/{graph_id}?step=25` - Get graph filtered to step 25
- `GET /api/graph/{graph_id}/metrics` - Get graph metrics
- `GET /api/graph/{graph_id}/info` - Get session info

### Health
- `GET /` - API information
- `GET /health` - Health check

## Architecture

```
backend/
├── app/
│   ├── api/
│   │   └── endpoints/       # API route handlers
│   ├── core/                # Config and settings
│   ├── models/              # Pydantic models
│   ├── parsers/             # Framework-specific parsers
│   ├── schemas/             # API request/response schemas
│   ├── services/            # Business logic
│   └── main.py              # FastAPI app
├── tests/
│   ├── fixtures/            # Test data files
│   └── test_*.py            # Test modules
├── pyproject.toml           # Poetry dependencies
└── README.md
```

## Development

### Adding a New Parser

1. Create `app/parsers/<framework>_parser.py`
2. Inherit from `BaseParser`
3. Implement `parse()` method
4. Register in `app/services/parser.py`
5. Add tests in `tests/test_parsers.py`

See `app/parsers/autogen_parser.py` for an example.

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key settings:
- `CORS_ORIGINS`: Frontend URLs for CORS
- `UPLOAD_DIR`: Directory for temporary file uploads
- `SESSION_DIR`: Directory for session data

## Current Features (Phase 1)

✅ Pydantic models for temporal graph data
✅ AutoGen log parser
✅ Graph builder with NetworkX
✅ Time-based graph filtering
✅ FastAPI endpoints with auto-generated docs
✅ In-memory session management
✅ Comprehensive test suite

## Roadmap

**Phase 2**: Frontend integration
**Phase 3**: LLM abstraction service, anomaly detection
**Phase 4**: WebSocket support, advanced analytics

## License

See root LICENSE file.
