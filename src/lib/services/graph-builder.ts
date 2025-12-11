/**
 * Graph Builder Service - Constructs temporal communication graphs
 *
 * Takes parsed messages and builds a DiGraph with:
 * - Nodes representing agents
 * - Edges with temporal interaction history
 * - Support for time-based filtering
 */

import { DiGraph } from '@/lib/graph/digraph';
import {
  IntentLabel,
  MessageType,
  type Message,
  type Interaction,
  type EdgeData,
  type NodeData,
  type GraphSnapshot,
  type NodeMetadata,
  type EdgeMetadata,
} from '@/lib/models/types';

export class GraphBuilder {
  private graph: DiGraph<NodeMetadata, EdgeMetadata> | null = null;
  private messages: Message[] = [];

  /**
   * Build a directed graph from a list of messages.
   */
  buildGraph(messages: Message[]): DiGraph<NodeMetadata, EdgeMetadata> {
    if (messages.length === 0) {
      throw new Error('Cannot build graph from empty message list');
    }

    // Sort messages by step_index
    this.messages = [...messages].sort((a, b) => a.step_index - b.step_index);
    this.graph = new DiGraph<NodeMetadata, EdgeMetadata>();

    // Track node metadata separately during construction
    const nodeMetadata: Map<string, NodeMetadata> = new Map();

    // Build nodes and edges
    for (const message of this.messages) {
      // Add sender node
      this.addOrUpdateNode(message.sender, message, nodeMetadata);

      // Add edge if there's a receiver
      if (message.receiver) {
        // Add receiver node
        this.addOrUpdateNode(message.receiver, message, nodeMetadata);

        // Add interaction to edge
        this.addInteraction(message);
      }
    }

    // Update node data in graph
    for (const [nodeId, metadata] of nodeMetadata) {
      this.graph.updateNodeData(nodeId, metadata);
    }

    return this.graph;
  }

  /**
   * Add a new node or update existing node metadata.
   */
  private addOrUpdateNode(
    nodeId: string,
    message: Message,
    nodeMetadata: Map<string, NodeMetadata>
  ): void {
    if (!nodeMetadata.has(nodeId)) {
      nodeMetadata.set(nodeId, {
        id: nodeId,
        label: nodeId,
        message_count: 0,
        messages_sent: 0,
        messages_received: 0,
        first_appearance: message.timestamp,
        last_activity: message.timestamp,
        metadata: {},
      });
      this.graph!.addNode(nodeId);
    }

    const meta = nodeMetadata.get(nodeId)!;

    // Update metadata for sender
    if (message.sender === nodeId) {
      meta.message_count += 1;
      meta.messages_sent += 1;
      if (message.timestamp > meta.last_activity) {
        meta.last_activity = message.timestamp;
      }
    }

    // Track received messages
    if (message.receiver === nodeId) {
      meta.messages_received += 1;
    }
  }

  /**
   * Add an interaction to the edge between sender and receiver.
   */
  private addInteraction(message: Message): void {
    const sender = message.sender;
    const receiver = message.receiver;

    if (!receiver) return;

    // Create interaction object
    const interaction: Interaction = {
      step_index: message.step_index,
      timestamp: message.timestamp,
      intent: this.inferIntent(message),
      message_id: message.step_index,
      metadata: {
        message_type: message.message_type,
        content: message.content || '', // Store full content
        content_preview: message.content?.slice(0, 100) || '', // Keep preview for compatibility
      },
    };

    // Add or update edge
    if (this.graph!.hasEdge(sender, receiver)) {
      // Edge exists - append interaction
      const edgeData = this.graph!.getEdgeData(sender, receiver)!;
      edgeData.interactions.push(interaction);
      edgeData.weight += 1;
    } else {
      // New edge
      this.graph!.addEdge(sender, receiver, {
        source: sender,
        target: receiver,
        interactions: [interaction],
        weight: 1,
      });
    }
  }

  /**
   * Infer the intent label from a message.
   */
  private inferIntent(message: Message): IntentLabel {
    const messageType = message.message_type;

    // Map message types to intent labels
    const typeToIntent: Record<string, IntentLabel> = {
      [MessageType.DELEGATION]: IntentLabel.DELEGATION,
      [MessageType.ACTION]: IntentLabel.COORDINATION,
      [MessageType.RESPONSE]: IntentLabel.INFORMATION_RESPONSE,
      [MessageType.OBSERVATION]: IntentLabel.INFORMATION_RESPONSE,
      [MessageType.THOUGHT]: IntentLabel.UNKNOWN,
      [MessageType.SYSTEM]: IntentLabel.UNKNOWN,
    };

    return typeToIntent[messageType] || IntentLabel.UNKNOWN;
  }

  /**
   * Return a filtered graph containing only interactions up to maxStep.
   * Critical for time-slider functionality.
   */
  filterGraphByStep(maxStep: number): DiGraph<NodeMetadata, EdgeMetadata> {
    if (!this.graph) {
      throw new Error('No graph built yet. Call buildGraph() first.');
    }

    const filtered = this.graph.copy();

    // Filter edges
    const edgesToRemove: Array<{ source: string; target: string }> = [];

    for (const { source, target, data } of filtered.edges()) {
      const filteredInteractions = data.interactions.filter(
        (i) => i.step_index <= maxStep
      );

      if (filteredInteractions.length > 0) {
        // Update edge with filtered interactions
        filtered.setEdgeData(source, target, {
          ...data,
          interactions: filteredInteractions,
          weight: filteredInteractions.length,
        });
      } else {
        edgesToRemove.push({ source, target });
      }
    }

    // Remove edges with no interactions
    for (const { source, target } of edgesToRemove) {
      filtered.removeEdge(source, target);
    }

    // Remove isolated nodes
    const isolatedNodes = filtered.isolates();
    filtered.removeNodesFrom(isolatedNodes);

    return filtered;
  }

  /**
   * Convert the graph to a GraphSnapshot for API response.
   */
  toGraphSnapshot(maxStep?: number): GraphSnapshot {
    if (!this.graph) {
      throw new Error('No graph built yet. Call buildGraph() first.');
    }

    // Use filtered graph if maxStep provided
    const graphToUse =
      maxStep !== undefined ? this.filterGraphByStep(maxStep) : this.graph;

    // Calculate time-based message counts if maxStep is provided
    const timeBasedSentCounts: Record<string, number> = {};
    const timeBasedReceivedCounts: Record<string, number> = {};

    if (maxStep !== undefined) {
      // Count messages sent and received by each agent up to maxStep
      for (const message of this.messages) {
        if (message.step_index <= maxStep) {
          const sender = message.sender;
          timeBasedSentCounts[sender] =
            (timeBasedSentCounts[sender] || 0) + 1;

          if (message.receiver) {
            const receiver = message.receiver;
            timeBasedReceivedCounts[receiver] =
              (timeBasedReceivedCounts[receiver] || 0) + 1;
          }
        }
      }
    }

    // Convert nodes
    const nodes: NodeData[] = [];
    for (const nodeId of graphToUse.nodeIds()) {
      const nodeData = graphToUse.getNodeData(nodeId);
      if (!nodeData) continue;

      // Override counts with time-based counts if maxStep is provided
      const sentCount =
        maxStep !== undefined
          ? timeBasedSentCounts[nodeId] || 0
          : nodeData.messages_sent;
      const receivedCount =
        maxStep !== undefined
          ? timeBasedReceivedCounts[nodeId] || 0
          : nodeData.messages_received;

      nodes.push({
        id: nodeData.id,
        label: nodeData.label,
        message_count: sentCount, // For backwards compatibility
        messages_sent: sentCount,
        messages_received: receivedCount,
        first_appearance: nodeData.first_appearance,
        last_activity: nodeData.last_activity,
        metadata: nodeData.metadata,
      });
    }

    // Convert edges
    const edges: EdgeData[] = graphToUse.edges().map(({ data }) => ({
      source: data.source,
      target: data.target,
      interactions: data.interactions,
      weight: data.weight,
    }));

    const totalSteps =
      this.messages.length > 0
        ? Math.max(...this.messages.map((m) => m.step_index))
        : 0;

    return {
      nodes,
      edges,
      current_step: maxStep ?? null,
      total_steps: totalSteps,
      metadata: {
        node_count: nodes.length,
        edge_count: edges.length,
        message_count: this.messages.length,
      },
    };
  }

  /**
   * Calculate basic graph metrics.
   */
  getGraphMetrics(): Record<string, unknown> {
    if (!this.graph) {
      throw new Error('No graph built yet. Call buildGraph() first.');
    }

    const metrics: Record<string, unknown> = {
      node_count: this.graph.numberOfNodes(),
      edge_count: this.graph.numberOfEdges(),
      density: this.graph.density(),
    };

    // Calculate centrality measures
    if (this.graph.numberOfNodes() > 0) {
      metrics.degree_centrality = this.graph.degreeCentrality();
      metrics.in_degree_centrality = this.graph.inDegreeCentrality();
      metrics.out_degree_centrality = this.graph.outDegreeCentrality();
    }

    return metrics;
  }

  /**
   * Get the messages array.
   */
  getMessages(): Message[] {
    return this.messages;
  }

  /**
   * Get the raw graph.
   */
  getGraph(): DiGraph<NodeMetadata, EdgeMetadata> | null {
    return this.graph;
  }
}
