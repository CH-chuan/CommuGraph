This document formalizes the **Requirements and Use Cases** for CommuGraph. It synthesizes the academic goals from your proposal, the "Process Mining" focus from your notes, and the specific functional constraints we established during the UI design phase.

# CommuGraph: Iterative Requirements & Use Case Specification (v2.0)

## 1. Refined Problem Statement
[cite_start]Current multi-agent systems (MAS) and Human-AI teams generate lengthy, unstructured chat logs that are difficult to analyze manually[cite: 4]. Researchers and developers face three specific friction points:
1.  [cite_start]**Opacity:** Reading raw text fails to reveal structural dynamics like dominance or isolation[cite: 5, 7].
2.  [cite_start]**Lack of Temporal Context:** Static graphs miss *how* a conversation evolved over time or where it got stuck[cite: 2, 15].
3.  **Reporting Friction:** There is no bridge between observing an anomaly (debugging) and formalizing it into a research finding or audit report.

**Solution:** A "Process Mining" workbench that abstracts raw chat logs into structured events, visualizes them as a dynamic graph, and allows "human-in-the-loop" annotation for reporting.

---

## 2. Core Use Cases (The "Who" and "Why")

### UC-1: The System Architect (Debugging & Optimization)
* **Goal:** Identify why a multi-agent workflow failed or consumed excessive tokens.
* **Scenario:** A developer runs an AutoGen coding swarm. The system hangs.
* **Workflow in CommuGraph:**
    1.  Uploads logs using **"Raw Mode"** (Low latency).
    2.  Uses **Precision Navigation** to jump to the end of the log.
    3.  Observes a **"Red Diamond" (Rule-Based Anomaly)** on the timeline.
    4.  Identifies a **Circular Loop** where Agent A and Agent B repeated the same 3 steps endlessly.
    5.  [cite_start]**Outcome:** Modifies the system prompt to prevent this loop in the next run[cite: 20].

### UC-2: The Socio-Technical Researcher (Simulation Analysis)
* **Goal:** Analyze how different agent personalities or roles impact team coordination.
* [cite_start]**Scenario:** A researcher pairs a "Manager" agent with a "Coder" agent to study delegation patterns[cite: 35, 43].
* **Workflow in CommuGraph:**
    1.  Uploads logs and selects the **"Human-AI Delegation" Abstraction Lens** (Pre-flight).
    2.  Plays the **Dynamic Graph** to watch the relationship evolve.
    3.  Notices that the "Coder" agent is dominating the conversation (Large Node Size), ignoring the "Manager."
    4.  Logs this observation in the **Thought Stream**.
    5.  [cite_start]**Outcome:** Confirms the hypothesis that specific personality prompts lead to poor delegation[cite: 36].

### UC-3: The Ethical Auditor (Compliance & Auditing)
* [cite_start]**Goal:** Post-hoc analysis to identify problematic steps, data misuse, or black-box failures[cite: 38, 41].
* **Scenario:** An auditor reviews a session where an agent team was given sensitive data.
* **Workflow in CommuGraph:**
    1.  Uploads logs with **"ISO Speech Act" Abstraction**.
    2.  [cite_start]Scrubs through the timeline to find specific "Action" steps (e.g., File Write, Data Export)[cite: 10].
    3.  Uses the **Thought Stream** to annotate specific timestamps where the agent accessed data without proper "Permission Request" acts.
    4.  Generates a **PDF Report** comprising the graph snapshot and the flagged violations.

---

## 3. Functional Requirements (FR)

### FR-1: Data Ingestion & Abstraction (The "Mining" Layer)
* [cite_start]**FR-1.1:** The system must support file uploads for common MAS frameworks (AutoGen, CrewAI) and generic CSV[cite: 16].
* **FR-1.2:** The system must provide a **"Pre-Flight" Configuration** to select the abstraction method before visualization begins.
* **FR-1.3:** The system must support at least three abstraction modes:
    * [cite_start]*Rule-Based/Raw:* Fast, based on message types (Thought/Action)[cite: 10].
    * *Theory-Based:* Using LLMs to tag messages (e.g., ISO Standard, Delegation Theory).
    * *Custom:* Allowing user-defined few-shot examples.

### FR-2: Dynamic Visualization (The "Replay" Layer)
* **FR-2.1:** The visualization must use a **Directly-Follows Graph (DFG)** or Petri Net layout to emphasize process flow.
* [cite_start]**FR-2.2:** The graph must support **Time-Based Growth**, where nodes and edges appear cumulatively as the user advances the timeline[cite: 2, 15].
* **FR-2.3:** The system must provide **Precision Navigation**, allowing users to jump to specific step numbers (e.g., `Step [M] / N`) via text input.
* **FR-2.4:** The timeline must utilize a **Swimlane Chart** to visualize agent activity periods parallel to the graph growth.

### FR-3: Analytics & Anomaly Detection (The "Insight" Layer)
* **FR-3.1:** The system must strictly use **Rule-Based Logic** (not generative AI) to detect anomalies to ensure reliability.
    * *Circular Loops:* Repeating sequences of node traversal.
    * *Stagnation:* Consecutive identical actions by one agent.
* **FR-3.2:** The system must visualize these anomalies as **Checkpoints (Diamonds)** on the timeline.
* [cite_start]**FR-3.3:** The system must calculate real-time metrics: Token Cost and Agent Dominance (Node Size/Centrality)[cite: 14, 25].

### FR-4: Reporting & Annotation (The "Output" Layer)
* **FR-4.1:** The system must provide an always-available **"Thought Stream"** input for users to log observations during playback.
* **FR-4.2:** The Report Generator must allow users to **Select/Filter** which thoughts and system-detected anomalies to include.
* **FR-4.3:** The system must use an LLM agent to synthesize the selected inputs into a structured final report (PDF/Markdown).

---

## 4. Non-Functional Requirements
* **NFR-1 (Usability):** The main workspace must use a **3-Column Resizable Layout** to accommodate different user workflows (Reading vs. Viewing vs. Analyzing).
* **NFR-2 (Performance):** Abstraction (LLM calling) must occur during the "Pre-Flight" stage to prevent lag during the visualization phase.
* [cite_start]**NFR-3 (Visual Clarity):** The graph must employ "Ghosting" or fading for older edges to prevent the "hairball" effect during long simulations[cite: 4].