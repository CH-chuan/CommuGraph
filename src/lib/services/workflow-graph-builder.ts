/**
 * Workflow Graph Builder - Builds DAG structure from Claude Code parsed messages
 *
 * Handles:
 * - Fork pattern: Single reasoning node → multiple parallel tool calls
 * - Join pattern: Multiple tool results → next reasoning node
 * - Sub-agent lanes: Parallel execution tracks
 * - Duration calculation: Time between consecutive nodes
 *
 * @see /dev_docs/claude_code_chat_log/PROCESS_MINING_IMPLEMENTATION_PLAN.md
 */

import {
  WorkflowNodeType,
  DurationClass,
  type WorkflowNode,
  type WorkflowEdge,
  type WorkflowLane,
  type WorkflowGraphSnapshot,
  type WorkflowNodeType as WorkflowNodeTypeValue,
  type SubAgentInfo as SubAgentInfoType,
} from '@/lib/models/types';
import type {
  ClaudeCodeMessage,
  ClaudeCodeParseResult,
  SubAgentInfo,
} from '@/lib/parsers/claude-code-parser';

// ============================================================================
// Configuration
// ============================================================================

/** Duration thresholds for edge coloring (in ms) */
const DURATION_THRESHOLDS = {
  FAST: 500,      // < 500ms = green
  MEDIUM: 2000,   // 500ms - 2s = yellow
  SLOW: 5000,     // 2s - 5s = orange
  // > 5s = red
};

/** Content preview length */
const PREVIEW_LENGTH = 100;

/** Tool result preview length */
const RESULT_PREVIEW_LENGTH = 200;

// ============================================================================
// WorkflowGraphBuilder
// ============================================================================

export class WorkflowGraphBuilder {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: Map<string, WorkflowEdge> = new Map();
  private lanes: Map<string, WorkflowLane> = new Map();

  private sessionId: string = '';
  private messages: ClaudeCodeMessage[] = [];
  private subAgents: Map<string, SubAgentInfo> = new Map();

  // Tracking for fork/join patterns
  private pendingToolCalls: Map<string, string[]> = new Map(); // requestId -> toolUseIds
  private pendingResults: Map<string, string> = new Map(); // toolUseId -> resultNodeId

  /**
   * Build workflow graph from parsed Claude Code messages.
   */
  build(parseResult: ClaudeCodeParseResult): WorkflowGraphSnapshot {
    this.reset();

    this.sessionId = parseResult.sessionId;
    this.messages = parseResult.messages;
    this.subAgents = parseResult.subAgents;

    // Step 1: Create lanes (main + sub-agents)
    this.createLanes();

    // Step 2: Create nodes from messages
    this.createNodes();

    // Step 3: Create session start node
    this.createSessionStartNode(parseResult);

    // Step 4: Detect and mark parallel tool call groups
    this.detectParallelGroups();

    // Step 5: Mark sub-agent container nodes
    this.markSubAgentContainers();

    // Step 6: Create edges based on workflow patterns
    this.createEdges();

    // Step 7: Compute metrics
    const snapshot = this.buildSnapshot(parseResult);

    return snapshot;
  }

  /**
   * Get snapshot filtered to a specific step.
   */
  getSnapshotAtStep(
    fullSnapshot: WorkflowGraphSnapshot,
    maxStep: number
  ): WorkflowGraphSnapshot {
    const filteredNodes = fullSnapshot.nodes.filter(n => n.stepIndex <= maxStep);
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    const filteredEdges = fullSnapshot.edges.filter(
      e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );

    // Filter lanes to only those with nodes
    const activeLaneIds = new Set(filteredNodes.map(n => n.laneId));
    const filteredLanes = fullSnapshot.lanes.filter(l => activeLaneIds.has(l.id));

    return {
      ...fullSnapshot,
      nodes: filteredNodes,
      edges: filteredEdges,
      lanes: filteredLanes,
      currentStep: maxStep,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private reset(): void {
    this.nodes.clear();
    this.edges.clear();
    this.lanes.clear();
    this.pendingToolCalls.clear();
    this.pendingResults.clear();
    this.sessionId = '';
    this.messages = [];
    this.subAgents = new Map();
  }

  /**
   * Create lanes for main agent and sub-agents.
   */
  private createLanes(): void {
    // Main agent lane
    this.lanes.set('main', {
      id: 'main',
      label: 'Main Agent',
    });

    // Sub-agent lanes
    for (const [agentId, info] of this.subAgents) {
      this.lanes.set(`agent-${agentId}`, {
        id: `agent-${agentId}`,
        label: `Sub-agent: ${info.subagentType || agentId}`,
        agentId,
        subagentType: info.subagentType,
        prompt: info.prompt,
        totalDurationMs: info.totalDurationMs,
        totalTokens: info.totalTokens,
        totalToolUseCount: info.totalToolUseCount,
        status: info.status,
      });
    }
  }

  /**
   * Create workflow nodes from parsed messages.
   */
  private createNodes(): void {
    for (const msg of this.messages) {
      const node = this.messageToNode(msg);
      this.nodes.set(node.id, node);

      // Track tool calls for fork/join pattern
      if (msg.workflowNodeType === WorkflowNodeType.TOOL_CALL && msg.requestId) {
        const existing = this.pendingToolCalls.get(msg.requestId) || [];
        existing.push(msg.toolUseId || msg.uuid);
        this.pendingToolCalls.set(msg.requestId, existing);
      }

      // Track tool results
      if (
        msg.workflowNodeType === WorkflowNodeType.RESULT_SUCCESS ||
        msg.workflowNodeType === WorkflowNodeType.RESULT_FAILURE ||
        msg.workflowNodeType === WorkflowNodeType.TOOL_RESULT
      ) {
        // Try to find the matching tool_use_id from metadata
        const toolUseResult = msg.metadata?.tool_use_result as Record<string, unknown> | undefined;
        const toolUseId = toolUseResult?.tool_use_id as string | undefined;
        if (toolUseId) {
          this.pendingResults.set(toolUseId, node.id);
        }
      }
    }
  }

  /**
   * Convert a ClaudeCodeMessage to a WorkflowNode.
   */
  private messageToNode(msg: ClaudeCodeMessage): WorkflowNode {
    const laneId = msg.isSidechain && msg.agentId
      ? `agent-${msg.agentId}`
      : 'main';

    // Extract tool result info for result nodes
    const toolUseResult = msg.metadata?.tool_use_result as Record<string, unknown> | undefined;
    let toolResultPreview: string | undefined;
    let toolResultStatus: 'success' | 'failure' | undefined;
    let toolResultStdout: string | undefined;
    let toolResultStderr: string | undefined;

    if (
      msg.workflowNodeType === WorkflowNodeType.RESULT_SUCCESS ||
      msg.workflowNodeType === WorkflowNodeType.RESULT_FAILURE ||
      msg.workflowNodeType === WorkflowNodeType.TOOL_RESULT
    ) {
      // Determine status
      toolResultStatus = msg.workflowNodeType === WorkflowNodeType.RESULT_FAILURE ? 'failure' : 'success';
      if (toolUseResult?.status === 'failed') {
        toolResultStatus = 'failure';
      }

      // Extract preview from content or stdout
      const content = toolUseResult?.content as Array<{ type: string; text: string }> | undefined;
      if (content && Array.isArray(content)) {
        const textContent = content.find(c => c.type === 'text')?.text;
        if (textContent) {
          toolResultPreview = this.truncate(textContent, RESULT_PREVIEW_LENGTH);
        }
      }

      // Bash-specific outputs
      if (toolUseResult?.stdout) {
        toolResultStdout = this.truncate(String(toolUseResult.stdout), RESULT_PREVIEW_LENGTH);
        if (!toolResultPreview) {
          toolResultPreview = toolResultStdout;
        }
      }
      if (toolUseResult?.stderr) {
        toolResultStderr = this.truncate(String(toolUseResult.stderr), RESULT_PREVIEW_LENGTH);
        if (!toolResultPreview && toolResultStderr) {
          toolResultPreview = toolResultStderr;
        }
      }

      // Fallback to content
      if (!toolResultPreview && msg.content) {
        toolResultPreview = this.truncate(msg.content, RESULT_PREVIEW_LENGTH);
      }
    }

    return {
      id: msg.uuid,
      stepIndex: msg.step_index,
      timestamp: msg.timestamp,
      nodeType: msg.workflowNodeType,

      label: this.getNodeLabel(msg),
      content: msg.content,
      contentPreview: this.truncate(msg.content, PREVIEW_LENGTH),

      laneId,
      isSidechain: msg.isSidechain,
      agentId: msg.agentId,

      toolName: msg.toolName,
      toolInput: msg.toolInput,
      toolUseId: msg.toolUseId,

      // Tool result enhancements
      toolResultPreview,
      toolResultStatus,
      toolResultStdout,
      toolResultStderr,

      inputTokens: msg.inputTokens,
      outputTokens: msg.outputTokens,
      durationMs: msg.durationMs,

      uuid: msg.uuid,
      parentUuid: msg.parentUuid,
      logicalParentUuid: msg.logicalParentUuid,
      requestId: msg.requestId,

      parentNodeIds: [],
      childNodeIds: [],
    };
  }

  /**
   * Get human-readable label for a node.
   */
  private getNodeLabel(msg: ClaudeCodeMessage): string {
    switch (msg.workflowNodeType) {
      case WorkflowNodeType.USER_INPUT:
        return 'User Input';
      case WorkflowNodeType.AGENT_REASONING:
        return 'Agent Reasoning';
      case WorkflowNodeType.TOOL_CALL:
        // Special case: Task tool calls are named "call-sub-agent"
        if (msg.toolName === 'Task') {
          return 'call-sub-agent';
        }
        return msg.toolName || 'Tool Call';
      case WorkflowNodeType.TOOL_RESULT:
      case WorkflowNodeType.RESULT_SUCCESS:
        return 'Success';
      case WorkflowNodeType.RESULT_FAILURE:
        return 'Failure';
      case WorkflowNodeType.SYSTEM_NOTICE:
        return 'System';
      default:
        return 'Node';
    }
  }

  /**
   * Create edges based on the new graph building logic:
   *
   * 1. Messages in same requestId are grouped:
   *    - Thinking/text combined into one reasoning node
   *    - Multiple tool_uses are parallel (all point FROM reasoning node, no links between them)
   *
   * 2. Tool results connect TO their tool_use via tool_use_id matching
   *
   * 3. All tool results connect TO the next assistant response
   *    (the last tool result's uuid matches next response's parentUuid)
   *
   * 4. For sub-agent calls (Task tool), a sub-agent card is inserted between call and result
   */
  private createEdges(): void {
    let stepIndex = 0;

    // Build lookup maps
    const nodeByUuid = new Map<string, WorkflowNode>();
    const nodeByToolUseId = new Map<string, WorkflowNode>(); // tool_use_id -> tool_call node
    const toolResultByToolUseId = new Map<string, WorkflowNode>(); // tool_use_id -> tool_result node

    for (const node of this.nodes.values()) {
      nodeByUuid.set(node.uuid, node);

      // Map tool calls by their tool_use_id
      if (node.nodeType === WorkflowNodeType.TOOL_CALL && node.toolUseId) {
        nodeByToolUseId.set(node.toolUseId, node);
      }

      // Map tool results by their tool_use_id
      if (
        node.nodeType === WorkflowNodeType.TOOL_RESULT ||
        node.nodeType === WorkflowNodeType.RESULT_SUCCESS ||
        node.nodeType === WorkflowNodeType.RESULT_FAILURE
      ) {
        // Use toolUseId directly from the node (set by parser)
        if (node.toolUseId) {
          toolResultByToolUseId.set(node.toolUseId, node);
        }
      }
    }

    // Group nodes by requestId
    const nodesByRequestId = new Map<string, WorkflowNode[]>();
    for (const node of this.nodes.values()) {
      if (node.requestId) {
        const existing = nodesByRequestId.get(node.requestId) || [];
        existing.push(node);
        nodesByRequestId.set(node.requestId, existing);
      }
    }

    // Track processed nodes to avoid duplicate edges
    const processedNodes = new Set<string>();

    // Process each requestId group
    for (const [requestId, nodesInGroup] of nodesByRequestId) {
      // Separate reasoning nodes and tool call nodes
      const reasoningNodes = nodesInGroup.filter(
        n => n.nodeType === WorkflowNodeType.AGENT_REASONING
      );
      const toolCallNodes = nodesInGroup.filter(
        n => n.nodeType === WorkflowNodeType.TOOL_CALL
      );

      // Get the reasoning node (should be one per requestId)
      const reasoningNode = reasoningNodes[0];

      if (reasoningNode) {
        processedNodes.add(reasoningNode.id);

        // Connect reasoning node to its parent (using parentUuid or logicalParentUuid)
        const effectiveParentUuid = reasoningNode.parentUuid || reasoningNode.logicalParentUuid;
        if (effectiveParentUuid) {
          const parentNode = nodeByUuid.get(effectiveParentUuid);
          if (parentNode) {
            this.createEdge(parentNode, reasoningNode, stepIndex++, false);
          }
        }

        // Connect all tool calls FROM the reasoning node (parallel)
        const isParallel = toolCallNodes.length > 1;
        for (const toolCall of toolCallNodes) {
          processedNodes.add(toolCall.id);
          this.createEdge(reasoningNode, toolCall, stepIndex++, isParallel);

          // Mark parallel info on tool call nodes
          if (isParallel) {
            toolCall.parallelGroupId = requestId;
            toolCall.parallelIndex = toolCallNodes.indexOf(toolCall);
            toolCall.parallelCount = toolCallNodes.length;
          }
        }
      }
    }

    // Connect tool results to their tool calls via tool_use_id
    // Track which results belong to which parallel group (for join pattern)
    const parallelGroupResults = new Map<string, WorkflowNode[]>(); // requestId -> result nodes

    for (const [toolUseId, toolResultNode] of toolResultByToolUseId) {
      const toolCallNode = nodeByToolUseId.get(toolUseId);
      if (toolCallNode) {
        processedNodes.add(toolResultNode.id);

        // Connect tool call directly to result (same for all tools including Task)
        this.createEdge(toolCallNode, toolResultNode, stepIndex++, false);

        // Copy toolName to result node for display
        toolResultNode.toolName = toolCallNode.toolName;

        // Track parallel group membership for join pattern
        if (toolCallNode.parallelGroupId) {
          const existing = parallelGroupResults.get(toolCallNode.parallelGroupId) || [];
          existing.push(toolResultNode);
          parallelGroupResults.set(toolCallNode.parallelGroupId, existing);
        }
      }
    }

    // Implement JOIN pattern: connect ALL results from a parallel group to the next Agent Reasoning
    // Use timestamp-based detection instead of parentUuid
    const mainNodes = Array.from(this.nodes.values())
      .filter(n => n.laneId === 'main' && !n.isSessionStart)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const [_parallelGroupId, results] of parallelGroupResults) {
      if (results.length <= 1) continue; // Not a parallel group

      // Find the latest result timestamp in this group
      const latestResultTime = Math.max(
        ...results.map(r => new Date(r.timestamp).getTime())
      );

      // Find the next Agent Reasoning node after all results complete
      const nextReasoningNode = mainNodes.find(n =>
        n.nodeType === WorkflowNodeType.AGENT_REASONING &&
        new Date(n.timestamp).getTime() > latestResultTime
      );

      if (nextReasoningNode) {
        // Connect ALL results to this reasoning node (JOIN pattern)
        for (const resultNode of results) {
          if (!this.edges.has(`${resultNode.id}->${nextReasoningNode.id}`)) {
            this.createEdge(resultNode, nextReasoningNode, stepIndex++, false);
          }
        }
        processedNodes.add(nextReasoningNode.id);
      }
    }

    // Process remaining non-requestId nodes (user input, system notices)
    for (const node of this.nodes.values()) {
      if (processedNodes.has(node.id) || node.isSessionStart) continue;

      // Try parentUuid relationship
      const effectiveParentUuid = node.parentUuid || node.logicalParentUuid;
      if (effectiveParentUuid) {
        const parentNode = nodeByUuid.get(effectiveParentUuid);
        if (parentNode && !this.edges.has(`${parentNode.id}->${node.id}`)) {
          this.createEdge(parentNode, node, stepIndex++, false);
          processedNodes.add(node.id);
        }
      }
    }

    // Connect session start node to first real node
    this.connectSessionStartNode(nodeByUuid);

    // Create cross-lane edges (Task tool -> sub-agent start, sub-agent end -> task result)
    this.createCrossLaneEdges();

    // Connect orphan nodes (nodes with no incoming edges) to maintain flow
    this.connectOrphanNodes(nodeByUuid, stepIndex);
  }

  /**
   * Connect session start node to the first main lane node.
   */
  private connectSessionStartNode(nodeByUuid: Map<string, WorkflowNode>): void {
    const sessionStartNode = this.nodes.get('session-start');
    if (!sessionStartNode) return;

    // Find the first node in main lane (by timestamp) that has no parent or orphan
    const mainNodes = Array.from(this.nodes.values())
      .filter(n => n.laneId === 'main' && !n.isSessionStart)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (mainNodes.length > 0) {
      // Find nodes that have no incoming edges yet
      const nodesWithIncoming = new Set<string>();
      for (const edge of this.edges.values()) {
        nodesWithIncoming.add(edge.target);
      }

      // Connect to the first node without incoming edge, or just the first node
      const firstOrphan = mainNodes.find(n => !nodesWithIncoming.has(n.id));
      const targetNode = firstOrphan || mainNodes[0];

      this.createEdge(sessionStartNode, targetNode, -1, false);
    }
  }

  /**
   * Connect orphan nodes (no incoming edges) to maintain graph connectivity.
   */
  private connectOrphanNodes(
    nodeByUuid: Map<string, WorkflowNode>,
    startStepIndex: number
  ): void {
    let stepIndex = startStepIndex;

    // Find nodes with no incoming edges (except session start)
    const nodesWithIncoming = new Set<string>();
    nodesWithIncoming.add('session-start'); // Don't count session start as needing parent

    for (const edge of this.edges.values()) {
      nodesWithIncoming.add(edge.target);
    }

    // Group orphans by lane and sort by timestamp
    const orphansByLane = new Map<string, WorkflowNode[]>();
    for (const node of this.nodes.values()) {
      if (!nodesWithIncoming.has(node.id) && !node.isSessionStart) {
        const existing = orphansByLane.get(node.laneId) || [];
        existing.push(node);
        orphansByLane.set(node.laneId, existing);
      }
    }

    // For each lane, connect orphans to the previous node by timestamp
    for (const [laneId, orphans] of orphansByLane) {
      const laneNodes = Array.from(this.nodes.values())
        .filter(n => n.laneId === laneId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      for (const orphan of orphans) {
        // Find the node just before this orphan by timestamp
        const orphanTime = new Date(orphan.timestamp).getTime();
        let prevNode: WorkflowNode | null = null;

        for (const candidate of laneNodes) {
          if (candidate.id === orphan.id) break;
          const candidateTime = new Date(candidate.timestamp).getTime();
          if (candidateTime < orphanTime) {
            prevNode = candidate;
          }
        }

        if (prevNode) {
          this.createEdge(prevNode, orphan, stepIndex++, false);
        }
      }
    }
  }

  /**
   * Create cross-lane edges for sub-agent spawning.
   */
  private createCrossLaneEdges(): void {
    // Find Task tool calls and their corresponding results
    const taskCalls: WorkflowNode[] = [];
    const taskResults: WorkflowNode[] = [];

    for (const node of this.nodes.values()) {
      if (node.toolName === 'Task') {
        taskCalls.push(node);
      }
      // Task results have agentId in metadata
      if (
        node.nodeType === WorkflowNodeType.TOOL_RESULT &&
        node.laneId === 'main'
      ) {
        const metadata = this.messages.find(m => m.uuid === node.uuid)?.metadata;
        const toolUseResult = metadata?.tool_use_result as Record<string, unknown> | undefined;
        if (toolUseResult?.agentId) {
          taskResults.push(node);
        }
      }
    }

    // Connect Task calls to sub-agent first nodes
    for (const taskCall of taskCalls) {
      const input = taskCall.toolInput as Record<string, unknown> | undefined;
      const subagentType = input?.subagent_type as string | undefined;

      // Find sub-agent lane
      for (const [laneId, lane] of this.lanes) {
        if (laneId !== 'main' && lane.subagentType === subagentType) {
          // Find first node in sub-agent lane
          const subAgentNodes = Array.from(this.nodes.values())
            .filter(n => n.laneId === laneId)
            .sort((a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

          if (subAgentNodes.length > 0) {
            this.createEdge(taskCall, subAgentNodes[0], taskCall.stepIndex, false, true);

            // Find last node in sub-agent lane
            const lastSubAgentNode = subAgentNodes[subAgentNodes.length - 1];

            // Find matching task result
            const taskResult = taskResults.find(r => {
              const metadata = this.messages.find(m => m.uuid === r.uuid)?.metadata;
              const toolUseResult = metadata?.tool_use_result as Record<string, unknown> | undefined;
              return toolUseResult?.agentId === lane.agentId;
            });

            if (taskResult) {
              this.createEdge(
                lastSubAgentNode,
                taskResult,
                lastSubAgentNode.stepIndex,
                false,
                true
              );
            }
          }
        }
      }
    }
  }

  /**
   * Create an edge between two nodes.
   */
  private createEdge(
    source: WorkflowNode,
    target: WorkflowNode,
    stepIndex: number,
    isParallel: boolean,
    isCrossLane: boolean = false
  ): void {
    const edgeId = `${source.id}->${target.id}`;

    // Don't create duplicate edges
    if (this.edges.has(edgeId)) return;

    const durationMs = Math.max(
      0,
      new Date(target.timestamp).getTime() - new Date(source.timestamp).getTime()
    );

    const edge: WorkflowEdge = {
      id: edgeId,
      source: source.id,
      target: target.id,
      durationMs,
      durationClass: this.classifyDuration(durationMs),
      isParallel,
      isCrossLane: isCrossLane || source.laneId !== target.laneId,
      stepIndex,
    };

    this.edges.set(edgeId, edge);

    // Update node parent/child references
    source.childNodeIds.push(target.id);
    target.parentNodeIds.push(source.id);
  }

  /**
   * Classify duration for edge coloring.
   */
  private classifyDuration(durationMs: number): DurationClass {
    if (durationMs < DURATION_THRESHOLDS.FAST) {
      return DurationClass.FAST;
    } else if (durationMs < DURATION_THRESHOLDS.MEDIUM) {
      return DurationClass.MEDIUM;
    } else if (durationMs < DURATION_THRESHOLDS.SLOW) {
      return DurationClass.SLOW;
    } else {
      return DurationClass.VERY_SLOW;
    }
  }

  /**
   * Create session start node with metadata.
   */
  private createSessionStartNode(parseResult: ClaudeCodeParseResult): void {
    // Find the earliest timestamp
    const sortedNodes = Array.from(this.nodes.values())
      .filter(n => n.laneId === 'main')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sortedNodes.length === 0) return;

    const firstNode = sortedNodes[0];
    const startTime = parseResult.timeRange.start;
    const endTime = parseResult.timeRange.end;
    const totalDurationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

    // Format duration
    let totalDuration: string;
    if (totalDurationMs < 60000) {
      totalDuration = `${(totalDurationMs / 1000).toFixed(1)}s`;
    } else if (totalDurationMs < 3600000) {
      totalDuration = `${(totalDurationMs / 60000).toFixed(1)}m`;
    } else {
      totalDuration = `${(totalDurationMs / 3600000).toFixed(1)}h`;
    }

    // Create session start node
    const sessionNode: WorkflowNode = {
      id: 'session-start',
      stepIndex: -1, // Before all other nodes
      timestamp: startTime,
      nodeType: WorkflowNodeType.SYSTEM_NOTICE,

      label: 'Session Start',
      content: '',
      contentPreview: '',

      laneId: 'main',
      isSidechain: false,

      isSessionStart: true,
      sessionMetadata: {
        agentLabel: 'Main Agent',
        totalDuration,
        totalTokens: parseResult.totalTokens,
        nodeCount: this.nodes.size,
      },

      uuid: 'session-start',
      parentUuid: null,

      parentNodeIds: [],
      childNodeIds: [firstNode.id],
    };

    this.nodes.set(sessionNode.id, sessionNode);

    // Update first node to have session start as parent
    firstNode.parentNodeIds.push(sessionNode.id);
  }

  /**
   * Detect parallel tool call groups and mark them.
   */
  private detectParallelGroups(): void {
    // Group tool calls by requestId
    const toolCallsByRequestId = new Map<string, WorkflowNode[]>();

    for (const node of this.nodes.values()) {
      if (node.nodeType === WorkflowNodeType.TOOL_CALL && node.requestId) {
        const existing = toolCallsByRequestId.get(node.requestId) || [];
        existing.push(node);
        toolCallsByRequestId.set(node.requestId, existing);
      }
    }

    // Mark parallel groups (requestId with more than 1 tool call)
    for (const [requestId, toolCalls] of toolCallsByRequestId) {
      if (toolCalls.length > 1) {
        // Sort by timestamp
        toolCalls.sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Mark each node
        toolCalls.forEach((node, index) => {
          node.parallelGroupId = requestId;
          node.parallelIndex = index;
          node.parallelCount = toolCalls.length;
        });
      }
    }
  }

  /**
   * Mark Task tool calls as sub-agent containers with their info.
   * Matches by toolUseId (tool_use_id from the tool call matches the key in subAgents map).
   */
  private markSubAgentContainers(): void {
    for (const node of this.nodes.values()) {
      if (node.toolName === 'Task' && node.laneId === 'main') {
        const input = node.toolInput as Record<string, unknown> | undefined;
        const subagentType = input?.subagent_type as string | undefined;
        const prompt = input?.prompt as string | undefined;

        // Match by toolUseId (sub-agents are keyed by tool_use_id in the map)
        const info = this.subAgents.get(node.toolUseId || '');
        if (info) {
          node.isSubAgentContainer = true;
          node.subAgentInfo = {
            agentId: info.agentId,
            subagentType: subagentType || 'unknown',  // Get from tool call input
            prompt: info.prompt || prompt || '',
            promptPreview: this.truncate(info.prompt || prompt || '', PREVIEW_LENGTH),
            totalDurationMs: info.totalDurationMs || 0,
            totalTokens: info.totalTokens || 0,
            totalToolCalls: info.totalToolUseCount || 0,
            status: info.status === 'completed' ? 'completed' : 'failed',
          };
        }
      }
    }
  }

  /**
   * Build the final snapshot.
   */
  private buildSnapshot(parseResult: ClaudeCodeParseResult): WorkflowGraphSnapshot {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());
    const lanes = Array.from(this.lanes.values());

    // Calculate metrics
    const toolCallNodes = nodes.filter(n => n.nodeType === WorkflowNodeType.TOOL_CALL);
    const successNodes = nodes.filter(n => n.nodeType === WorkflowNodeType.RESULT_SUCCESS);
    const failureNodes = nodes.filter(n => n.nodeType === WorkflowNodeType.RESULT_FAILURE);

    const totalToolCalls = toolCallNodes.length;
    const toolSuccessRate = totalToolCalls > 0
      ? successNodes.length / (successNodes.length + failureNodes.length)
      : 1;

    const startTime = parseResult.timeRange.start;
    const endTime = parseResult.timeRange.end;
    const totalDurationMs =
      new Date(endTime).getTime() - new Date(startTime).getTime();

    return {
      nodes,
      edges,
      lanes,

      sessionId: this.sessionId,
      currentStep: null,
      totalSteps: nodes.length,

      startTime,
      endTime,
      totalDurationMs,

      totalTokens: parseResult.totalTokens,
      totalToolCalls,
      toolSuccessRate,
    };
  }

  /**
   * Truncate string to specified length.
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Build a workflow graph from a Claude Code parse result.
 */
export function buildWorkflowGraph(
  parseResult: ClaudeCodeParseResult
): WorkflowGraphSnapshot {
  const builder = new WorkflowGraphBuilder();
  return builder.build(parseResult);
}
