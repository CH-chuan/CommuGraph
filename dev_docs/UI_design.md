# CommuGraph: User Interface Design Specifications

## 1. Design Philosophy & Layout Strategy
The interface follows a **"Process Mining Workbench"** metaphor. It prioritizes clarity over complexity, using a fluid **3-Column Layout** where the user can adjust the focus between text (Log), structure (Graph), and analysis (Insights).

* **Global Architecture:** Single-Page Application (SPA).
* **Responsive Grid:** Three vertical columns separated by **draggable sashes (gutters)**, allowing the user to resize panels (e.g., expand the graph while shrinking the log).

---

## 2. Phase 0: The "Pre-Flight" Stage (Data Ingestion)
**Location:** Modal Overlay / Landing Page.
**Purpose:** To handle heavy compute tasks (LLM abstraction) *before* the visualization loads.

1.  **File Drop Zone:**
    * Supports: `AutoGen JSON`, `CrewAI`, `CSV`, `json`, `jsonl`, `text`.
2.  **The "Abstraction Lens" Configurator:**
    * *Label:* "Select Analysis Framework."
    * *Mechanism:* Radio Card Selection (Single Choice).
        * **[A] Raw Mode:** No abstraction. Nodes = Agents; Edges = Message Count. (Fastest).
        * **[B] ISO Dialogue Acts:** Messages tagged as *Inform, Question, Offer, Commit*.
        * [cite_start]**[C] Human-AI Delegation:** Messages tagged as *Delegate, Monitor, Evaluate, Execute*[cite: 5, 16].
        * **[D] Custom Schema:** User inputs 3 example pairs; LLM generalizes.
3.  **Primary Action:** `[ Process & Launch Dashboard ]`

---

## 3. Phase 1: The Main Workspace (3-Column View)

### Column A: The Narrative Log (Left Panel)
* **Content:** A chronological list of chat "Cards."
* **Card Design:**
    * *Header:* Agent Avatar + Name + Timestamp.
    * *Body:* The message content.
    * *Visual State:* The card corresponding to the current graph step is highlighted (Active State).
* **Interaction:**
    * **Sync:** Auto-scrolls to match the Timeline position.
    * **Context:** If "Abstraction Labels" are toggled ON (see Col C), the card body text is replaced or overlaid with its classification tag (e.g., `<Code Generation>`).

### Column B: The CommuGraph Canvas (Center Panel)
**1. The Graph Container (Top 80%)**
* **Visual Metaphor:** **Directly-Follows Graph (DFG)** or **Petri Net** layout.
    * *Nodes:* Represent Agents. [cite_start]Size dynamically pulsates based on "Activity Count" at the current step[cite: 36].
    * *Edges:* Represent communication flow. [cite_start]Thickness = Volume[cite: 37].
    * *Animation:* Nodes fade in/out based on the timeline. Edges older than $N$ steps apply a "Ghosting" effect (transparency 50%) to reduce clutter.

**2. The Navigation Dock (Bottom 20%)**
* **The "Swimlane" Timeline:**
    * *X-Axis:* Normalized Step Index.
    * *Y-Axis:* One horizontal lane per Agent.
    * *Blocks:* Colored segments indicating active turns.
    * *Markers:* Diamond icons overlay the tracks for Rule-Based Checkpoints.
        * **Green:** Success.
        * **Red:** Failure/Error.
        * **Yellow:** Circular Loop Detected.
* **The Precision Controls:**
    * Located on the control bar (Play/Pause/Speed).
    * **Step Input:** A direct manipulation field showing `Step [ M ] / N`.
    * *Interaction:* The user can click inside `[ M ]`, type `45`, and press Enter. The visualization instantly snaps to the state at Step 45.

### Column C: The Insight Engine (Right Panel)
This panel is split vertically (50/50, adjustable).

**1. Metrics & Filters (Top Half)**
* **Abstraction Toggle:** `[ Show Semantic Labels ]` (Switch).
    * *Effect:* Changes graph edge labels from "Count" to "Intent" (e.g., "Delegation") without re-processing data.
* **Live Metrics:**
    * [cite_start]*Cost Ticker:* "Est. Token Cost: $0.45"[cite: 49].
    * [cite_start]*Dominance Chart:* Real-time bar chart of steps-per-agent[cite: 31].

**2. The "Thought Stream" (Bottom Half)**
* **Stream View:** A scrollable list of previous user notes.
    * *Format:* `[Step 24] User: "Agent B ignored the context here."`
* **Input Area:** A fixed "Quick Note" bar at the bottom.
    * *Placeholder:* "Log an observation..."
    * *Action:* Pressing Enter saves the text + current Timestamp.

---

## 4. Phase 2: The Reporting Workflow
**Trigger:** `[ Generate Report ]` button in the Global Header.
**Interface:** A "Shopping Cart" style Modal.

1.  **Column 1: System Findings (Auto-Generated)**
    * List of Rule-Based Anomalies (e.g., "Circular Loop at Step 50").
    * *Action:* User unchecks "False Positives."
2.  **Column 2: User Thoughts (The "Stream")**
    * List of all notes typed into the Thought Stream during the session.
    * *Action:* User checks the insights to include in the final narrative.
3.  **Output:**
    * The system sends the *selected* System Findings + *selected* User Thoughts to an LLM Summarizer.
    * [cite_start]**Result:** A Downloadable PDF/Markdown report with an "Executive Summary," "Process Flow Analysis," and "Failures & Anomalies" section[cite: 14].

---

## 5. Technical Stack Recommendations
* **Frontend Framework:** React.js or Vue.js.
* **Layout Engine:** `react-split` (for the draggable 3-column layout).
* **Graph Engine:** `React Flow` (preferred for process-oriented/node-link diagrams) or `Cytoscape.js`.
* **Timeline:** `Recharts` (Scatter chart customized as Swimlanes).
* **Icons:** Lucide React or FontAwesome.