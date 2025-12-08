# CommuGraph - Architecture & Design Document

## 🧠 Core Philosophy
**Python-Native First.**
This project minimizes JavaScript dependencies, leveraging Python's strong data science ecosystem (`pandas`, `networkx`) and Python-wrapper visualization tools (`Streamlit`, `PyVis`, `Plotly`).

## 📂 Project Structure

```text
commugraph/                   ← Main Python package
│
├── __init__.py
├── cli.py                    ← CLI entry point (Typer)
│
├── analytics/                ← Deep insights & statistics
│   ├── __init__.py
│   ├── patterns.py           ← Delegation, role emergence detection
│   ├── distributions.py      ← Message frequency distributions
│   └── sequences.py          ← Interaction sequence mining
│
├── configs/                  ← Configuration management
│   ├── __init__.py
│   └── default.yaml          ← Default colors, layout settings, parser rules
│
├── data/                     ← Internal assets (optional)
│   └── sample_logs.jsonl
│
├── graph/                    ← Graph construction & Algorithms
│   ├── __init__.py
│   ├── builder.py            ← Conversion from logs to NetworkX graphs
│   ├── metrics.py            ← Centrality, density, clustering coefficients
│   └── temporal.py           ← Time-slicing logic (dynamic graph states)
│
├── io/                       ← Input/Output operations
│   ├── __init__.py
│   ├── loader.py             ← Load JSONL/Text logs into internal models
│   ├── writer.py             ← Export graph data (GML, JSON, HTML)
│   └── config_loader.py      ← YAML config parser
│
├── models/                   ← Pydantic Data Models (Strict Typing)
│   ├── __init__.py
│   └── types.py              ← Message, Agent, Edge (Temporal-aware)
│
├── parsers/                  ← Framework-specific Log Parsers
│   ├── __init__.py
│   ├── base_parser.py        ← Abstract base class
│   ├── autogen_parser.py
│   ├── camel_parser.py
│   └── crewai_parser.py
│
├── ui/                       ← Streamlit Web Application
│   ├── __init__.py
│   ├── app.py                ← Main entry point (`streamlit run ...`)
│   ├── components.py         ← Reusable UI widgets
│   └── pages/
│       ├── graph_view.py     ← Interactive network visualizer
│       ├── timeline.py       ← Temporal evolution view
│       └── analytics.py      ← Charts and metrics dashboard
│
├── visualization/            ← Plotting Logic
│   ├── __init__.py
│   ├── interactive.py        ← Plotly (Timeline/Charts)
│   ├── network_viz.py        ← PyVis (Network Graph HTML generation)
│   └── static.py             ← Matplotlib/Seaborn (Static exports)
│
└── utils/                    ← Shared Utilities
    ├── __init__.py
    ├── logging.py
    └── helpers.py

notebooks/                    ← Jupyter Notebooks for experimentation
│   └── 01_parsing_demo.ipynb
│   └── 02_graph_analysis.ipynb

tests/                        ← Pytest suite
│   ├── test_parsers.py
│   └── test_graph.py

pyproject.toml                ← Dependencies & Metadata
README.md
```

---

## 🏗️ Data Modeling (The "Temporal" Edge)

Since standard graphs flatten interactions into a single weight, we lose the "story" of the conversation. Our `Edge` model must preserve time to enable temporal filtering and playback.

**Target Data Structure (`commugraph/models/types.py`):**

```python
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Interaction(BaseModel):
    """A single message event within an edge."""
    timestamp: datetime
    step_index: int
    intent: Optional[str] = "unknown"  # e.g., "query", "response", "delegation"
    message_id: str

class EdgeData(BaseModel):
    """Rich edge data connecting two agents."""
    source: str
    target: str
    weight: int = 0
    interactions: List[Interaction] = []  # <--- Critical for temporal analysis
```

**Why this matters:**
- Allows the UI to have a **Time Slider**: "Show me the graph structure at Step 10 vs Step 50".
- Allows **Intent Coloring**: "Show me only edges where 'delegation' happened".

---

## 🛠️ Technology Stack Breakdown

| Component | Tech Choice | Rationale |
|-----------|------------|-----------|
| **CLI** | **Typer** | Type-safe, auto-documented, modern Pythonic CLI building. |
| **Data validation** | **Pydantic** | Essential for cleaning messy LLM JSON logs before processing. |
| **Graph Core** | **NetworkX** | Standard for graph algos. Fast enough for <500 node graphs. |
| **Visualization** | **PyVis** | Generates interactive HTML networks using physics engines without writing JS. |
| **Charts** | **Plotly** | Interactive charts for timelines and distributions in Python. |
| **UI Framework** | **Streamlit** | Rapid dashboarding. `st.components.v1.html` integrates PyVis easily. |
| **Storage** | **Pandas / JSONL** | Simple in-memory processing. No DB required for <1000 message logs. |

---

## 🔄 Workflow

1.  **Ingest:** CLI/UI reads `log.jsonl`.
2.  **Parse:** `parsers/*` converts raw JSON into `List[Message]` (Pydantic models).
3.  **Build:** `graph.builder` iterates messages to create a NetworkX MultiDiGraph (or DiGraph with rich attributes).
4.  **Analyze:** `analytics/*` calculates centrality, detects bottlenecks.
5.  **Visualize:**
    - `visualization.network_viz` converts NetworkX → PyVis HTML.
    - Streamlit renders the HTML iframe.

