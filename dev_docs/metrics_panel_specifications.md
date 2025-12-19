# Metrics Panel Specifications

This document details the right-hand side metrics panels for each view in CommuGraph.

---

## Table of Contents

1. [AutoGen Graph View - Graph Insights](#1-autogen-graph-view---graph-insights)
2. [Claude Code Workflow View - Session Metrics](#2-claude-code-workflow-view---session-metrics)
3. [Claude Code Annotation View - Dialog Stats](#3-claude-code-annotation-view---dialog-stats)

---

## 1. AutoGen Graph View - Graph Insights

**Component**: `src/components/insights/AutoGenMetricsPanel.tsx`

**Panel Header**: "Graph Insights"

### 1.1 Overview Cards (2×2 Grid)

| Card | Icon | Label | Value | Color |
|------|------|-------|-------|-------|
| Agents | Users | AGENTS | `node_count` | Blue |
| Connections | ArrowRightLeft | CONNECTIONS | `edge_count` | Green |
| Density | Network | DENSITY | `{density * 100}%` | Amber |
| Step | Activity | STEP | `{currentStep}/{totalSteps}` | Slate |

**Density SubValue** (interpretation):

| Range | Label | Color |
|-------|-------|-------|
| ≥70% | Highly Connected | text-green-600 |
| ≥40% | Moderately Connected | text-amber-600 |
| ≥20% | Sparsely Connected | text-orange-600 |
| <20% | Very Sparse | text-red-600 |

### 1.2 Dominant Agents (Collapsible, default: open)

**Description**: "Ranked by degree centrality (overall influence)"

**Content**: Top 5 agents ranked by centrality score

**Per Agent Row**:
- Rank number (#1-#5)
- Crown icon (for #1 only)
- Agent name (truncated)
- Centrality bar (visual 0-100%)
- Score percentage

**Centrality Bar**:
```
Background: bg-slate-100 h-2 rounded-full
Fill: bg-blue-500
Width: (score / maxScore) * 100%
```

### 1.3 Centrality Details (Collapsible, default: closed)

**Sub-sections**:

#### Degree Centrality (Overall Influence)
- Icon: TrendingUp
- Lists all agents sorted by score (descending)
- Format: `{agent_name} | {score * 100}%`

#### In-Degree Centrality (Receives Messages)
- Lists all agents sorted by score
- Format: `{agent_name} | {score * 100}%`

#### Out-Degree Centrality (Sends Messages)
- Lists all agents sorted by score
- Format: `{agent_name} | {score * 100}%`

### 1.4 Communication Frequency (Collapsible, default: open)

**Metrics**:

| Metric | Value | Description |
|--------|-------|-------------|
| Total Interactions | Integer | Sum of all edge interactions |
| Avg per Step | Decimal (1 place) | `totalInteractions / totalSteps` |
| Current Step | Integer | Interactions at current step |

**By Agent** (sorted by total activity):
- Format: `{agent_name} | {sent} / {received} (sent/recv)`
- Colors: sent = green-600, received = blue-600

### 1.5 Interaction Density (Collapsible, default: open)

**Visual Density Bar**:
```
Background: bg-slate-200 h-4 rounded-full
Fill: gradient-to-r from-blue-400 to-blue-600
Width: density * 100%
Transition: duration-500
```

**Displayed Values**:
- Density Score: `{density * 100}%`
- Interpretation label (see 1.1)

**Definition Text**: "Graph density measures how many of the possible connections between agents actually exist. A fully connected graph has 100% density."

---

## 2. Claude Code Workflow View - Session Metrics

**Component**: `src/components/workflow/MetricsDashboard.tsx`

**Panel Header**: "Session Metrics"

### 2.1 Agent Filter Dropdown

**Options**:
- Main Agent (default)
- All Agents (aggregated metrics)
- Sub-agent-X (for each spawned sub-agent)

**Purpose**: Filter metrics by agent scope

### 2.2 Summary Cards (2×2 Grid)

| Card | Icon | Label | Value | Color | Notes |
|------|------|-------|-------|-------|-------|
| Duration | Clock | DURATION | Formatted time | Blue | Format: Xh Ym, Xm Ys, or Xs |
| Tokens | Coins | TOKENS | Formatted count | Amber | Format: X, X.Xk, or X.XXM |
| Tool Calls | Wrench | TOOL CALLS | Integer | Green | Count of tool_call nodes |
| Success Rate | CheckCircle | ACTION SUCCESS RATE | Percentage | Dynamic | Color based on rate |

**Success Rate Color Logic**:

| Rate | Color |
|------|-------|
| >90% | Green |
| >70% | Amber |
| ≤70% | Red |

### 2.3 Activity Breakdown (Collapsible)

**Node Type Distribution** (bar chart):

| Activity Type | Label | Color |
|---------------|-------|-------|
| user_input | User Input | #3B82F6 (Blue) |
| agent_reasoning | Reasoning | #8B5CF6 (Purple) |
| tool_call | Tool Calls | #10B981 (Emerald) |
| result_success | Success | #22C55E (Green) |
| result_failure | Failure | #EF4444 (Red) |
| tool_result | Results | #22C55E (Green) |
| system_notice | System | #64748B (Slate) |

**Bar Format**: `{label} | [===] | {count}`

### 2.4 Tool Usage (Collapsible)

**Content**: Top 10 tools by usage count

**Per Tool Row**:
- Tool name
- Usage bar (green)
- Count

**Bar Color**: #10B981 (Emerald)

### 2.5 Sub-agents (Collapsible)

**Shown**: Only if sub-agent lanes exist

**Per Sub-agent Card**:
- Bot icon (purple)
- Agent name (formatted: `{type}: {shortId}`)
- Status badge: completed (green) / error (red)
- Metrics row:
  - Duration (formatted)
  - Tokens (formatted with "tok" suffix)
  - Tool count (with "tools" suffix)

### 2.6 Warning Alert

**Condition**: Shown when `successRate < 90%`

**Content**:
- Icon: AlertTriangle (amber)
- Title: "Attention"
- Message: "Tool success rate is below 90%. Check failed operations for potential issues."

---

## 3. Claude Code Annotation View - Dialog Stats

**Component**: `src/components/annotation/AnnotationViewWrapper.tsx` (embedded)

**Panel Header**: "Dialog Stats"

### 3.1 Turn Count Cards

| Card | Value | Label | Color |
|------|-------|-------|-------|
| Total | `data.total` | Total Records | Slate-800 |
| User | `data.user_turn_count` | User Turns | Blue-600 |
| Assistant | `data.assistant_turn_count` | Assistant Turns | Purple-600 |
| System | `data.system_turn_count` | System Turns | Slate-600 |

### 3.2 Conversation Timing (Collapsible, default: closed)

#### User Prompt Intervals

**Condition**: Shown when ≥2 user turns exist

**Metrics**:

| Metric | Value | Action |
|--------|-------|--------|
| Min | Shortest interval between user prompts | - |
| Max | Longest interval between user prompts | "Go" button → jumps to annotation |
| Avg | Average interval | - |

**Calculation**: Time between consecutive user_turn timestamps

#### Agent Burst Duration

**Condition**: Shown when consecutive assistant turns exist

**Metrics**:

| Metric | Value | Action |
|--------|-------|--------|
| Min | Shortest agent burst duration | - |
| Max | Longest agent burst duration | "Go" button → jumps to annotation |
| Avg | Average burst duration | - |

**Definition**: A "burst" is a sequence of consecutive assistant_turn records without interruption by user_turn or system_turn.

**Calculation**: Time from first to last assistant_turn in each burst

### 3.3 Labels Section

**Header**: "Labels"

**Content**: Placeholder for future labeling feature

**Current Text**: "Dialog labels will appear here after labeling."

---

## Comparison Summary

| Aspect | AutoGen | Workflow (Claude) | Annotation (Claude) |
|--------|---------|-------------------|---------------------|
| **Focus** | Graph theory | Session performance | Conversation flow |
| **Primary Metrics** | Agents, Connections, Density | Duration, Tokens, Tools | Turn counts |
| **Agent Analysis** | Centrality rankings | Agent filter dropdown | - |
| **Temporal** | Step-based interactions | Duration-based | Interval analysis |
| **Tool Tracking** | - | Tool usage breakdown | - |
| **Timing** | Interactions per step | Session duration | User/Agent intervals |
| **Unique Feature** | Density interpretation | Sub-agent metrics | Burst duration |

---

## Key Files

| View | Component | Path |
|------|-----------|------|
| AutoGen | AutoGenMetricsPanel | `src/components/insights/AutoGenMetricsPanel.tsx` |
| Workflow | MetricsDashboard | `src/components/workflow/MetricsDashboard.tsx` |
| Annotation | AnnotationViewWrapper | `src/components/annotation/AnnotationViewWrapper.tsx` |
