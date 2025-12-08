import streamlit as st
import sys
from pathlib import Path

# Ensure package is in path for imports
root_path = Path(__file__).parent.parent.parent
sys.path.append(str(root_path))

st.set_page_config(
    page_title="CommuGraph Dashboard",
    page_icon="🕸️",
    layout="wide"
)

st.title("🕸️ CommuGraph Dashboard")

st.markdown("""
Welcome to **CommuGraph**, the analytics platform for multi-agent systems.

### 🚀 Getting Started
1. Upload your chat logs (JSONL).
2. Navigate to **Graph View** to see the network structure.
3. Use **Analytics** for deeper insights.

### 📂 Supported Frameworks
- AutoGen
- CrewAI
- Camel
""")

st.sidebar.info("Select a page from the sidebar to begin analysis.")

