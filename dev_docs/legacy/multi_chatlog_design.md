# Multi-ChatLog Support: Interaction Design & Critique

**Author**: Claude Code
**Date**: 2025-12-10
**Status**: Design Proposal
**Related Docs**: `UI_design.md`, `graph_system_implementation.md`

---

## Executive Summary

**Feasibility**: ✅ **YES** - Current framework can support multiple chat logs with moderate frontend refactoring

**Backend**: Already supports multiple concurrent graphs via `SessionManager`
**Frontend**: Requires refactoring AppContext and MainLayout to manage multiple graph states
**Estimated Complexity**: Medium (3-5 days for MVP)
**Recommended Approach**: Single-graph-at-a-time view with graph list sidebar

---

## 1. Current State Analysis

### What Works Today

**Backend (SessionManager)**:
- ✅ Supports unlimited concurrent sessions in memory
- ✅ Each session has unique ID (UUID-based 8-char shorthand)
- ✅ Session stores: messages, graph, metadata, timestamps
- ✅ RESTful API: `GET /api/sessions` lists all sessions
- ✅ Cleanup mechanism: `cleanup_expired_sessions()`

**Frontend (Single Graph)**:
- ❌ AppContext stores only ONE `graphId` at a time
- ❌ MainLayout renders only if `graphId !== null`
- ❌ Uploading new file **overwrites** existing `graphId`
- ❌ No persistence: refresh loses all session IDs
- ❌ No multi-graph UI components

### Key Constraint

**Current Left Panel = ChatLog**
The 3-column layout currently dedicates the left panel to showing messages from the **active chatlog**. To support multiple chatlogs, we need to:
1. **Replace ChatLog** with a **Chatlog List** in the left panel
2. **Show ChatLog** only when it was selected

So the actual UX is:
  State 1: Chatlog Selection View (Default)
  ┌─────────────┬─────────────────────────┐
  │Chatlog List │  Graph Canvas           │
  │             │(Empty prompt select     │
  │             │ chatlog or last viewed) │
  │ [Log 1]     │                         │
  │ [Log 2]     │                         │
  │ [Log 3]     │                         │
  └─────────────┴─────────────────────────┘

  User clicks Log 1 →

  State 2: Chatlog Detail View
  ┌─────────────┬─────────────────────────┐
  │ Chat Log    │  Graph Canvas           │
  │ (for Log 1) │  Timeline               │
  │             │  (for Log 1)            │
  │ [← Back]    │                         │
  │             │                         │
  │ Messages... │                         │
  └─────────────┴─────────────────────────┘

---

## 2. User Requirements:
1. **Multi-Chatlog Management**: Users can upload and switch between multiple chat logs
2. **Chatlog List View**: Left panel shows list of available graphs
3. **Single Chatlog Selection**: Clicking a Chatlog shows its full UI (chat log, graph canvas, timeline, insights)
4. **Close Behavior**: Closing a Chatlog keep its last view, until next graph is selected
5. **No Chat log Selected**: When no graph is active, prompt for selecting / uploading chatlog

---

## 3. Proposed Interaction Design

### 3.1 UI Layout: Single-Graph-at-a-Time (Recommended)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ Header: CommuGraph | [Upload New Log] [Settings]                                      │
├──────────────────┬──────────────────────────────────────────────┬─────────────────────┤
│                  │                                              │                     │
│  Chatlog List    │  Main Workspace (Visualizer)                 │  Insights Panel     │
│  (Left Panel)    │                                              │  (Right Panel)      │
│                  │  ┌────────────────────────────────────────┐  │                     │
│  ┌────────────┐  │  │                                        │  │  ┌───────────────┐  │
│  │ ID: 082    │  │  │  Graph Canvas (React Flow)             │  │  │               │  │
│  │ auto_gen.j │  │  │                                        │  │  │ [Metrics]     │  │
│  │ 25 msgs    │  │  │  [Nodes & Edges Visualization]         │  │  │               │  │
│  │ [View Log] │  │  │                                        │  │  └───────────────┘  │
│  └────────────┘  │  │                                        │  │                     │
│                  │  │                                        │  │  ┌───────────────┐  │
│  ┌────────────┐  │  └────────────────────────────────────────┘  │  │               │  │
│  │ ID: 104    │  │                                              │  │ [Structure]   │  │
│  │ crew_ai.j  │  │  ┌────────────────────────────────────────┐  │  │               │  │
│  │ 50 msgs    │  │  │                                        │  │  └───────────────┘  │
│  │ [View Log] │  │  │  Timeline Controls                     │  │                     │
│  └────────────┘  │  │                                        │  │  ┌───────────────┐  │
│                  │  │  [Gantt / Playback Interface]          │  │  │               │  │
│                  │  │                                        │  │  │ [AI Summary]  │  │
│    [+ Upload]    │  └────────────────────────────────────────┘  │  │               │  │
│                  │                                              │  └───────────────┘  │
│                  │                                              │                     │
└──────────────────┴──────────────────────────────────────────────┴─────────────────────┘
```


**Key Changes**:
1. **Left Panel State Transition**: Toggles between "Chatlog List" (cards view) and "Chat Log Detail" (messages view)
2. **Main Workspace**: Vertical stack of Graph Canvas → Timeline
3. **Right Panel**: Insights (unchanged from current design)
4. **Empty State**: When no chat log selected, prompt for selecting / uploading chatlog

---

### 3.2 Chatlog Card Anatomy

Each card in the Chatlog List shows:

```
┌────────────────────────────────┐
│ filename_v1.json               │ ← Original Filename
│ ID: #8291                      │ ← Unique ID / Number
│ ────────────────────────────── │
│ Framework: AutoGen             │ 
│ 25 Messages                    │
│ 2025-12-10 14:23               │
│                                │
│       [View Full Log]          │ ← Interaction Trigger
└────────────────────────────────┘
```
[View Full Log] triggers State 2: Graph Detail View


---

### 3.3 User Interaction Flow

#### Upload & Initialize (Empty → Active State)

```
1. User Action:
   - Clicks [+ Upload] button in the Header or the Empty State placeholder.

2. Interaction (Modal):
   - PreFlightModal appears.
   - User selects file (e.g., `autogen.json`) + Framework.
   - Clicks "Analyze".

3. System Process (Backend):
   - Validates file and creates session.
   - Generates graph structure.
   - Returns `chatlog_id` and metadata.

4. UI Update (Transition to Detail View):
   - Left Panel: A new "Chatlog Card" is added and highlighted as active.
   - Main Workspace:
     a. Graph Canvas (Top): Renders the node/edge graph.
     b. Timeline (Bottom): Initializes Gantt view.
```

#### **Flow 2: Switching Active Chatlogs**

```
1. User Action:
   - User Go back to the Chatlog List
   - User identifies a different session in the Left Panel (Chatlog List).
   - User clicks the [View Log] button or the card body of an inactive chatlog.

2. State Management (Frontend):
   - Current Chat Log: State (zoom level, timeline position) is cached to localStorage.
   - Target Chat Log: `activeChatlogId` is updated.
   - Loading State: Main Workspace shows a brief skeleton loader.

3. UI Update (Refresh All Components):
   - Left Panel: Transitions to Chat Log Detail View showing Target Graph's messages.
   - Graph Canvas: Unmounts old graph, fetches and renders nodes for Target Graph.
   - Timeline: Resets to Target Graph's time range.
   - Insights Panel: Updates metrics specific to the Target Graph.
```

#### Flow 3: Session Management (Close vs. Delete)

```
1. User Action:
   - User hovers over a card in the Left Panel and clicks the [X] / [Trash] icon.

2. Interaction (Confirmation):
   - Modal appears: "Manage Session for 'crew_ai_001.json'?"
   - Options: [Remove from View] or [Delete Permanently].

3. Outcome A: Remove from View (Hide):
   - Card is removed from Left Panel.
   - Chat Log ID is removed from `localStorage`.
   - Backend session remains alive (recoverable via history/re-upload).

3. Outcome B: Delete Permanently (Destroy):
   - DELETE request sent to `/api/session/{graph_id}`.
   - Backend memory cleared.
   - Card removed from UI.
   - But never delete the raw json file!!!

4. Post-Close Navigation:
   - If the *Active* Chat Log was closed:
     - Perform no interaction until the next chat log is selected for detailed view
   - If the *Active* Chat Log was deleted:
     - Go back to prompt for selecting / uploading chatlog
```

#### **Flow 4: Empty State (Dashboard View)

```
1. Layout Configuration:
   - Left Panel: Shows "Chatlog List" header, but list is empty.
   - Main Workspace: Shows "Welcome / Empty State" placeholder.
   - Insight Panel: Hidden or shows generic "How to use" info.

2. User Options:
   - Primary Call-to-Action: Large "Upload Chat Log" button in center screen.
   - Secondary: "Supported Frameworks" documentation links.
```

---

## 4. Technical Architecture Changes

### 4.1 AppContext Refactoring

**Current AppContext** (`frontend/src/context/AppContext.tsx`):
```typescript
interface AppContextType {
  graphId: string | null;           // Single graph
  currentStep: number;
  totalSteps: number;
  abstractionMode: string | null;
  highlightedAgentId: string | null;
  highlightedStepIndex: number | null;
  setGraphId: (id: string | null) => void;
  setCurrentStep: (step: number) => void;
  // ... other setters
}
```

**Proposed Multi-Graph AppContext**:
```typescript
interface GraphState {
  id: string;
  filename: string;
  framework: string;
  totalSteps: number;
  currentStep: number;              // Each graph has its own timeline position
  highlightedAgentId: string | null;
  highlightedStepIndex: number | null;
  metadata: {
    messageCount: number;
    nodeCount: number;
    uploadedAt: string;
  };
}

interface AppContextType {
  graphs: Map<string, GraphState>;  // All loaded graphs
  activeChatlogId: string | null;     // Currently visible graph
  abstractionMode: string | null;   // Global setting

  // Graph management
  addGraph: (graph: GraphState) => void;
  removeGraph: (id: string) => void;
  setActiveGraph: (id: string) => void;

  // Active graph state (convenience getters/setters)
  activeGraph: GraphState | null;   // Computed from activeChatlogId
  setCurrentStep: (step: number) => void;  // Updates activeGraph's step
  setHighlightedAgent: (id: string | null) => void;
  setHighlightedStep: (step: number | null) => void;
}
```

**Persistence Layer**:
```typescript
// Save to localStorage on state change
useEffect(() => {
  const graphsArray = Array.from(graphs.values());
  localStorage.setItem('commugraph_graphs', JSON.stringify({
    graphs: graphsArray,
    activeChatlogId,
  }));
}, [graphs, activeChatlogId]);

// Load from localStorage on mount
useEffect(() => {
  const saved = localStorage.getItem('commugraph_graphs');
  if (saved) {
    const { graphs: savedGraphs, activeChatlogId: savedActiveId } = JSON.parse(saved);
    // Validate sessions still exist on backend
    savedGraphs.forEach(g => validateSession(g.id).then(valid => {
      if (valid) addGraph(g);
    }));
  }
}, []);
```

---

### 4.2 New Components

#### **GraphLibrary Component** (`frontend/src/components/graph/GraphLibrary.tsx`)
```typescript
interface GraphLibraryProps {
  graphs: Map<string, GraphState>;
  activeChatlogId: string | null;
  onSelectGraph: (id: string) => void;
  onCloseGraph: (id: string) => void;
  onUploadNew: () => void;
}

export const GraphLibrary: React.FC<GraphLibraryProps> = ({
  graphs,
  activeChatlogId,
  onSelectGraph,
  onCloseGraph,
  onUploadNew,
}) => {
  return (
    <div className="graph-library">
      <div className="library-header">
        <h2>Chatlog List</h2>
        <Button onClick={onUploadNew}>
          <Plus /> Upload New
        </Button>
      </div>

      <div className="graph-cards">
        {Array.from(graphs.values()).map(graph => (
          <GraphCard
            key={graph.id}
            graph={graph}
            isActive={graph.id === activeChatlogId}
            onSelect={() => onSelectGraph(graph.id)}
            onClose={() => onCloseGraph(graph.id)}
          />
        ))}
      </div>

      {graphs.size === 0 && (
        <div className="empty-state">
          <p>No graphs loaded</p>
          <Button onClick={onUploadNew}>Upload First Log</Button>
        </div>
      )}
    </div>
  );
};
```

#### **GraphCard Component** (`frontend/src/components/graph/GraphCard.tsx`)
```typescript
interface GraphCardProps {
  graph: GraphState;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export const GraphCard: React.FC<GraphCardProps> = ({
  graph,
  isActive,
  onSelect,
  onClose,
}) => {
  return (
    <div
      className={`graph-card ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <div className="card-header">
        <FileIcon className="file-icon" />
        <span className="filename" title={graph.filename}>
          {truncate(graph.filename, 20)}
        </span>
      </div>

      <div className="card-meta">
        <Badge>{graph.framework}</Badge>
        <span className="timestamp">
          {formatDate(graph.metadata.uploadedAt)}
        </span>
      </div>

      <div className="card-stats">
        <div>{graph.metadata.messageCount} messages</div>
        <div>{graph.metadata.nodeCount} agents</div>
        <div>{graph.totalSteps} steps</div>
      </div>

      <div className="card-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X /> Close
        </Button>
      </div>
    </div>
  );
};
```

---

### 4.3 MainLayout Refactoring

**Current Layout**:
```typescript
// 3 columns: ChatLog | GraphCanvas | Insights
<div className="flex h-full">
  <div className="w-1/4">{graphId && <ChatLog />}</div>
  <div className="flex-1">{graphId && <GraphCanvas />}</div>
  <div className="w-1/4">{/* Insights */}</div>
</div>
```

**Proposed Layout**:
```typescript
<div className="flex h-full">
  {/* Left Panel: State Transition (Chatlog List ↔ Chat Log Detail) */}
  <div className="w-1/4 border-r">
    {showChatLogDetail ? (
      // State 2: Chat Log Detail View
      <ChatLogDetailView
        graphId={activeChatlogId}
        onBack={() => setShowChatLogDetail(false)}
      />
    ) : (
      // State 1: Chatlog List View
      <GraphLibrary
        graphs={graphs}
        activeChatlogId={activeChatlogId}
        onSelectGraph={(id) => {
          setActiveGraph(id);
          setShowChatLogDetail(true);  // Transition to detail view
        }}
        onCloseGraph={handleCloseGraph}
        onUploadNew={() => setShowPreFlight(true)}
      />
    )}
  </div>

  {/* Main Workspace: Vertical Stack (Graph + Timeline) */}
  <div className="flex-1 flex flex-col">
    {activeChatlogId ? (
      <>
        {/* Graph Canvas */}
        <div className="flex-1">
          <GraphCanvas graphId={activeChatlogId} />
        </div>

        {/* Timeline Controls */}
        <div className="h-48 border-t">
          <TimelineControls />
        </div>
      </>
    ) : (
      <EmptyState onUpload={() => setShowPreFlight(true)} />
    )}
  </div>

  {/* Right Panel: Insights (unchanged) */}
  <div className="w-1/4 border-l">
    {activeChatlogId && <InsightsPanel graphId={activeChatlogId} />}
  </div>
</div>
```

---

### 4.4 Backend API: Session Listing

**New Endpoint** (or enhance existing):
```python
# backend/app/api/endpoints/sessions.py

@router.get("/sessions", response_model=List[SessionListItem])
async def list_sessions():
    """List all active sessions with metadata."""
    sessions = session_manager.list_sessions()
    return [
        SessionListItem(
            id=s['id'],
            filename=s['metadata'].get('filename'),
            framework=s['framework'],
            message_count=len(s['messages']),
            node_count=s['graph_builder'].graph.number_of_nodes(),
            total_steps=s['graph_builder'].total_steps,
            created_at=s['created_at'],
            last_accessed=s['last_accessed'],
        )
        for s in sessions
    ]
```

**Frontend Hook**:
```typescript
export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
    refetchInterval: 30000,  // Poll every 30s to detect backend restarts
  });
};
```

---

## 5. Design Critique & Trade-offs

### 5.1 Strengths of This Approach

✅ **Backend-Ready**: No backend changes needed (SessionManager already supports multiple graphs)
✅ **Incremental Migration**: Can be implemented in phases without breaking existing single-graph workflow
✅ **User-Friendly**: Familiar pattern (graph list sidebar) seen in tools like Postman, Figma, VS Code
✅ **Persistence**: localStorage ensures users don't lose work on refresh
✅ **Scalable**: Can extend to multi-graph comparison views later

### 5.2 Weaknesses & Concerns

❌ **Left Panel State Transition**: User must navigate back to Chatlog List to switch graphs
- **Mitigation**: Add keyboard shortcuts (Ctrl+L) or breadcrumb navigation, allow quick switch via dropdown

❌ **State Complexity**: Managing state for N graphs increases complexity
- **Mitigation**: Use Map for O(1) lookups, memoize derived values

❌ **Memory Usage**: Each graph stores full NetworkX graph in backend memory
- **Mitigation**: Implement session expiry (e.g., 24 hours), lazy cleanup

❌ **No Cross-Graph Features**: Can't compare two graphs side-by-side (yet)
- **Mitigation**: Phase 2 feature - add split-view mode

❌ **localStorage Limits**: Large graph metadata may exceed 5MB localStorage limit
- **Mitigation**: Store only graph IDs + minimal metadata, fetch full data from backend

### 5.3 Alternative Approaches Considered

#### **Alternative A: Tab-Based Navigation**
```
[Log1] [Log2] [Log3] [+ New]
├─ Graph Canvas
├─ Timeline
└─ ChatLog
```

**Pros**:
- Familiar browser-tab UX
- Full width for each graph

**Cons**:
- No visual overview of all graphs
- Hidden graphs consume memory
- Harder to drag-and-drop between graphs

**Verdict**: Less suitable for process mining (users need to see multiple logs at once)

---

#### **Alternative B: Multi-Graph Comparison Mode**
```
[Graph 1]  |  [Graph 2]  |  [Graph 3]
Timeline 1 |  Timeline 2 |  Timeline 3
ChatLog 1  |  ChatLog 2  |  ChatLog 3
```

**Pros**:
- Perfect for comparing agent behaviors across conversations
- Aligns with research use case

**Cons**:
- High complexity to implement
- Requires synchronized scrolling, timeline sync
- May overwhelm users

**Verdict**: Phase 2 feature, requires single-graph mode first

---

#### **Alternative C: Modal-Based Graph Viewer**
```
Chatlog List (Full Screen)
Click graph → Opens modal with Graph Canvas + Timeline + ChatLog
Close modal → Returns to library
```

**Pros**:
- Clean separation of concerns
- Simple state management

**Cons**:
- Can't see library while viewing graph
- Feels like context switch
- Harder to quickly switch between graphs

**Verdict**: Not recommended for power users

---

### 5.4 Open Questions for User

**Q1: Left Panel Navigation**
How should users switch between Chatlog List and Chat Log Detail?
- **Option A**: [← Back] button in Chat Log Detail header (simple, clear)
- **Option B**: Dropdown in header to quick-switch between graphs (faster navigation)
- **Option C**: Keyboard shortcut (Ctrl+L) to toggle between list/detail views
- **Option D**: Breadcrumb navigation (e.g., "Chatlog List > log_1.json")

**Q2: Close Behavior**
When user closes a graph, should we:
- **Option A**: Remove from UI only (session stays in backend for 24h)
- **Option B**: Immediately delete backend session (free memory)
- **Option C**: Ask user every time (modal with options)

**Q3: Session Persistence**
Should we persist sessions across browser sessions?
- **Option A**: Yes, via localStorage (pro: convenience, con: stale sessions)
- **Option B**: No, clear on refresh (pro: clean state, con: lose work)
- **Option C**: Optional "Remember this session" checkbox

**Q4: Multi-Graph Comparison**
Is side-by-side comparison a must-have for v1, or defer to later?
- **Impact**: Significant scope increase if required for v1

**Q5: Chatlog List Collapsibility**
Should the Chatlog List panel be collapsible to give more space to main workspace?
- **Benefit**: More screen real estate when working with single graph
- **Cost**: User loses overview of available graphs

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Backend** (Minimal Changes):
- [ ] Add `GET /api/sessions` endpoint (list all sessions with metadata)
- [ ] Enhance `DELETE /api/session/{id}` to return success/failure
- [ ] Add session metadata fields: `filename`, `uploaded_at`

**Frontend** (Core Refactoring):
- [ ] Refactor AppContext to support `Map<string, GraphState>`
- [ ] Implement localStorage persistence layer
- [ ] Create `GraphLibrary` component (graph cards list)
- [ ] Create `GraphCard` component (individual card UI)
- [ ] Refactor `MainLayout` to show GraphLibrary in left panel

**Testing**:
- [ ] Upload multiple logs, verify they all appear in library
- [ ] Switch between graphs, verify state isolation
- [ ] Refresh page, verify graphs restored from localStorage

---

### Phase 2: Enhanced UX (Week 2)

**Left Panel State Management**:
- [ ] Implement smooth transitions between Chatlog List ↔ Chat Log Detail
- [ ] Add [← Back] button in Chat Log Detail header
- [ ] Implement auto-scroll to current step when changing graphs
- [ ] Add keyboard shortcuts for navigation (Ctrl+L to toggle views)

**Graph Management**:
- [ ] Implement close confirmation modal
- [ ] Add "Delete Permanently" vs "Close" options
- [ ] Backend session cleanup on delete

**Polish**:
- [ ] Loading states for graph switching
- [ ] Empty state UI when no graphs loaded
- [ ] Keyboard shortcuts (e.g., Ctrl+1/2/3 to switch graphs)

---

### Phase 3: Advanced Features (Week 3+)

**Multi-Graph Comparison** (Optional):
- [ ] Design split-view layout (2-up, 3-up, 4-up grids)
- [ ] Implement synchronized timeline scrubbing across graphs
- [ ] Cross-graph agent matching (by name/role)

**Export & Sharing**:
- [ ] Export graph metadata as JSON
- [ ] Import saved sessions (reload from JSON)
- [ ] Share graph URLs (requires backend session persistence to DB)

**Performance**:
- [ ] Lazy load graph data (only fetch when graph selected)
- [ ] Virtualize Chatlog List (if >50 graphs)
- [ ] Web worker for graph layout computation

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **State Management Bugs** | High | High | Extensive testing, use Zustand instead of Context if complexity grows |
| **localStorage Quota** | Medium | Medium | Store only IDs, lazy load metadata from backend |
| **Backend Memory Overflow** | Low | High | Implement session expiry, max session limit (e.g., 100) |
| **Navigation Friction** | Medium | Medium | Add keyboard shortcuts, dropdown quick-switcher, breadcrumb navigation |
| **Session Staleness** | Medium | Low | Poll backend for session validity, show warning if session expired |

---

## 8. Recommendation

**Proceed with Single-Graph-at-a-Time Approach (Option A)**

**Why**:
1. **Feasible**: Backend already supports it, frontend changes are well-scoped
2. **User-Friendly**: Familiar sidebar + main workspace pattern
3. **Scalable**: Foundation for future multi-graph comparison
4. **Low Risk**: Can implement incrementally, fallback to single-graph mode if issues arise

**Next Steps**:
1. **User Decision**: Answer open questions (Q1-Q5 above)
2. **Prototype**: Build Phase 1 in feature branch
3. **User Testing**: Validate UX with 2-3 graphs
4. **Iterate**: Refine based on feedback before committing to Phase 2

---

## Appendix A: File Structure Changes

### New Files
```
frontend/src/components/graph/
├─ GraphLibrary.tsx          # Left panel graph list
├─ GraphCard.tsx             # Individual graph card
└─ EmptyState.tsx            # No graphs loaded view

frontend/src/hooks/
└─ useSessions.ts            # Fetch all sessions from backend

backend/app/api/endpoints/
└─ sessions.py               # New endpoint for listing sessions (or enhance existing)

backend/app/schemas/
└─ session.py                # SessionListItem Pydantic model
```

### Modified Files
```
frontend/src/context/AppContext.tsx       # Multi-graph state
frontend/src/components/layout/MainLayout.tsx  # 3-column layout with left panel state transition
frontend/src/hooks/useGraphData.ts        # Support switching graphId
frontend/src/components/chat/ChatLog.tsx  # Wrap in ChatLogDetailView with [← Back] button
frontend/src/App.tsx                      # Load graphs from localStorage
```

---

## Appendix B: Example User Scenarios

### Scenario 1: Research Comparison
**User**: PhD student studying agent collaboration patterns

**Workflow**:
1. Upload 5 AutoGen logs from different experiments
2. Click each graph in library to review
3. Spot anomaly in Graph 3 (loop detected)
4. Switch to Graph 1 to compare normal flow
5. Take screenshots of both for paper
6. Close Graphs 2, 4, 5 (no longer needed)
7. Export Graph 1 & 3 metadata for analysis

---

### Scenario 2: System Architect
**User**: Developer debugging production multi-agent system

**Workflow**:
1. Upload failing conversation log (Graph A)
2. Upload similar successful log for comparison (Graph B)
3. Scrub timeline in Graph A to step 25 (where failure occurs)
4. Switch to Graph B, scrub to same step
5. Compare agent states at step 25 across both graphs
6. Identify missing delegation edge in Graph A
7. Fix code, re-run, upload new log (Graph C)
8. Verify Graph C now matches Graph B pattern
9. Close Graph A, keep B & C for documentation

---

## Appendix C: Design Mockup (ASCII)

### State 1: Chatlog List View (No Active Graph)
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ CommuGraph | [Upload New Log] [Settings] [Help]                                       │
├────────────────────┬─────────────────────────────────────┬────────────────────────────┤
│                    │                                     │                            │
│  📚 Chatlog List  │  Main Workspace (Empty State)       │  🔍 Key Insights          │
│                    │                                     │                            │
│  ┌──────────────┐  │  ┌───────────────────────────────┐  │  (Hidden when no graph    │
│  │ ⚪ Log 1     │  │  │                               │  │   is selected)            │
│  │ log_1.json   │  │  │   📊 No Graph Selected        │  │                            │
│  │ AutoGen      │  │  │                               │  │                            │
│  │ 25 msgs      │  │  │   Click a chatlog to view     │  │                            │
│  │ [View Log]   │  │  │   or upload a new one         │  │                            │
│  └──────────────┘  │  │                               │  │                            │
│                    │  └───────────────────────────────┘  │                            │
│  ┌──────────────┐  │                                     │                            │
│  │ ⚪ Log 2     │  │                                     │                            │
│  │ log_2.json   │  │                                     │                            │
│  │ CrewAI       │  │                                     │                            │
│  │ 50 msgs      │  │                                     │                            │
│  │ [View Log]   │  │                                     │                            │
│  └──────────────┘  │                                     │                            │
│                    │                                     │                            │
│  [+ Upload New]    │                                     │                            │
│                    │                                     │                            │
└────────────────────┴─────────────────────────────────────┴────────────────────────────┘
```

### State 2: Chat Log Detail View (Active Graph)
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ CommuGraph | [Upload New Log] [Settings] [Help]                                       │
├────────────────────┬─────────────────────────────────────┬────────────────────────────┤
│                    │                                     │                            │
│ 💬 Chat Log       │  Main Workspace                     │  🔍 Key Insights          │
│ [← Back to List]  │                                     │                            │
│                    │  ┌───────────────────────────────┐  │  ┌──────────────────────┐ │
│ log_1.json         │  │                               │  │  │ 📊 Metrics           │ │
│ AutoGen            │  │   Graph Canvas (React Flow)   │  │  │                      │ │
│ 25 messages        │  │   - Rich card nodes           │  │  │ Total Messages: 25   │ │
│                    │  │   - Ghost trail edges         │  │  │ Agents: 4            │ │
│ Step 1:            │  │   - Agent highlighting        │  │  │ Steps: 42            │ │
│ Manager → Coder    │  │                               │  │  └──────────────────────┘ │
│ "Implement the..." │  └───────────────────────────────┘  │                            │
│                    │                                     │  ┌──────────────────────┐ │
│ Step 2:            │  ┌───────────────────────────────┐  │  │ 🏗️ Structure        │ │
│ Coder → Manager    │  │ Timeline Controls (Gantt)     │  │  │                      │ │
│ "I've implemen..." │  │ [◀] [▶ Play] [▶] [Step 15/42]│  │  │ Manager → Coder: 8   │ │
│                    │  │                               │  │  │ Coder → Manager: 6   │ │
│ Step 3:            │  └───────────────────────────────┘  │  │ ...                  │ │
│ Manager → QA       │                                     │  └──────────────────────┘ │
│ "Please test..."   │                                     │                            │
│                    │                                     │  ┌──────────────────────┐ │
│ ...                │                                     │  │ 🤖 AI Summary        │ │
│                    │                                     │  │                      │ │
│                    │                                     │  │ (LLM-generated)      │ │
│                    │                                     │  └──────────────────────┘ │
│                    │                                     │                            │
└────────────────────┴─────────────────────────────────────┴────────────────────────────┘
```

**Note**: Left panel transitions between two states:
- **State 1** (Chatlog List): Shows all uploaded graphs as cards
- **State 2** (Chat Log Detail): Shows messages for the selected graph with [← Back] button

This maintains the **3-column layout** throughout: Left (state transition) | Main (Graph + Timeline) | Right (Insights)

---

**End of Design Document**
