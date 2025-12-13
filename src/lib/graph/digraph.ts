/**
 * DiGraph - Custom Directed Graph implementation
 *
 * Replaces Python NetworkX for TypeScript.
 * Provides methods for building temporal communication graphs.
 */

export interface EdgeEntry<E> {
  source: string;
  target: string;
  data: E;
}

export class DiGraph<N = Record<string, unknown>, E = Record<string, unknown>> {
  private _nodes: Map<string, N> = new Map();
  private _outEdges: Map<string, Map<string, E>> = new Map();
  private _inEdges: Map<string, Set<string>> = new Map();

  /**
   * Add a node to the graph. If node exists, merge data.
   */
  addNode(id: string, data?: N): void {
    if (!this._nodes.has(id)) {
      this._nodes.set(id, data ?? ({} as N));
      this._outEdges.set(id, new Map());
      this._inEdges.set(id, new Set());
    } else if (data) {
      this._nodes.set(id, { ...this._nodes.get(id), ...data });
    }
  }

  /**
   * Add a directed edge from source to target.
   * Creates nodes if they don't exist.
   */
  addEdge(source: string, target: string, data?: E): void {
    // Ensure nodes exist
    if (!this._nodes.has(source)) this.addNode(source);
    if (!this._nodes.has(target)) this.addNode(target);

    this._outEdges.get(source)!.set(target, data ?? ({} as E));
    this._inEdges.get(target)!.add(source);
  }

  /**
   * Check if an edge exists from source to target.
   */
  hasEdge(source: string, target: string): boolean {
    return this._outEdges.get(source)?.has(target) ?? false;
  }

  /**
   * Check if a node exists.
   */
  hasNode(id: string): boolean {
    return this._nodes.has(id);
  }

  /**
   * Get edge data for a specific edge.
   */
  getEdgeData(source: string, target: string): E | undefined {
    return this._outEdges.get(source)?.get(target);
  }

  /**
   * Update edge data (merge with existing).
   */
  updateEdgeData(source: string, target: string, data: Partial<E>): void {
    const existing = this.getEdgeData(source, target);
    if (existing) {
      this._outEdges.get(source)!.set(target, { ...existing, ...data });
    }
  }

  /**
   * Set edge data (replace entirely).
   */
  setEdgeData(source: string, target: string, data: E): void {
    if (this.hasEdge(source, target)) {
      this._outEdges.get(source)!.set(target, data);
    }
  }

  /**
   * Get node data for a specific node.
   */
  getNodeData(id: string): N | undefined {
    return this._nodes.get(id);
  }

  /**
   * Update node data (merge with existing).
   */
  updateNodeData(id: string, data: Partial<N>): void {
    const existing = this._nodes.get(id);
    if (existing) {
      this._nodes.set(id, { ...existing, ...data });
    }
  }

  /**
   * Set node data (replace entirely).
   */
  setNodeData(id: string, data: N): void {
    if (this._nodes.has(id)) {
      this._nodes.set(id, data);
    }
  }

  /**
   * Get all node IDs.
   */
  nodeIds(): string[] {
    return Array.from(this._nodes.keys());
  }

  /**
   * Get a copy of the nodes map.
   */
  nodes(): Map<string, N> {
    return new Map(this._nodes);
  }

  /**
   * Get all edges as an array.
   */
  edges(): EdgeEntry<E>[] {
    const result: EdgeEntry<E>[] = [];
    for (const [source, targets] of this._outEdges) {
      for (const [target, data] of targets) {
        result.push({ source, target, data });
      }
    }
    return result;
  }

  /**
   * Iterate over edges with data (similar to NetworkX edges(data=True)).
   */
  *edgesWithData(): Generator<[string, string, E]> {
    for (const [source, targets] of this._outEdges) {
      for (const [target, data] of targets) {
        yield [source, target, data];
      }
    }
  }

  /**
   * Remove an edge from the graph.
   */
  removeEdge(source: string, target: string): void {
    this._outEdges.get(source)?.delete(target);
    this._inEdges.get(target)?.delete(source);
  }

  /**
   * Remove a node and all its edges from the graph.
   */
  removeNode(id: string): void {
    // Remove all outgoing edges
    const outTargets = this._outEdges.get(id);
    if (outTargets) {
      for (const target of outTargets.keys()) {
        this._inEdges.get(target)?.delete(id);
      }
    }

    // Remove all incoming edges
    const inSources = this._inEdges.get(id);
    if (inSources) {
      for (const source of inSources) {
        this._outEdges.get(source)?.delete(id);
      }
    }

    // Remove the node itself
    this._nodes.delete(id);
    this._outEdges.delete(id);
    this._inEdges.delete(id);
  }

  /**
   * Remove multiple nodes from the graph.
   */
  removeNodesFrom(ids: string[]): void {
    for (const id of ids) {
      this.removeNode(id);
    }
  }

  /**
   * Get number of nodes.
   */
  numberOfNodes(): number {
    return this._nodes.size;
  }

  /**
   * Get number of edges.
   */
  numberOfEdges(): number {
    let count = 0;
    for (const targets of this._outEdges.values()) {
      count += targets.size;
    }
    return count;
  }

  /**
   * Get out-degree (number of outgoing edges) for a node.
   */
  outDegree(nodeId: string): number {
    return this._outEdges.get(nodeId)?.size ?? 0;
  }

  /**
   * Get in-degree (number of incoming edges) for a node.
   */
  inDegree(nodeId: string): number {
    return this._inEdges.get(nodeId)?.size ?? 0;
  }

  /**
   * Get total degree (in + out) for a node.
   */
  degree(nodeId: string): number {
    return this.inDegree(nodeId) + this.outDegree(nodeId);
  }

  /**
   * Get all isolated nodes (nodes with no edges).
   */
  isolates(): string[] {
    return this.nodeIds().filter(
      (id) => this.inDegree(id) === 0 && this.outDegree(id) === 0
    );
  }

  /**
   * Calculate graph density.
   * For directed graphs: density = edges / (nodes * (nodes - 1))
   */
  density(): number {
    const n = this.numberOfNodes();
    if (n <= 1) return 0;
    const e = this.numberOfEdges();
    return e / (n * (n - 1));
  }

  /**
   * Calculate degree centrality for all nodes.
   * For directed graphs, uses total degree / (2 * (n - 1))
   */
  degreeCentrality(): Record<string, number> {
    const n = this.numberOfNodes();
    if (n <= 1) return {};

    const result: Record<string, number> = {};
    for (const nodeId of this.nodeIds()) {
      result[nodeId] = this.degree(nodeId) / (2 * (n - 1));
    }
    return result;
  }

  /**
   * Calculate in-degree centrality for all nodes.
   */
  inDegreeCentrality(): Record<string, number> {
    const n = this.numberOfNodes();
    if (n <= 1) return {};

    const result: Record<string, number> = {};
    for (const nodeId of this.nodeIds()) {
      result[nodeId] = this.inDegree(nodeId) / (n - 1);
    }
    return result;
  }

  /**
   * Calculate out-degree centrality for all nodes.
   */
  outDegreeCentrality(): Record<string, number> {
    const n = this.numberOfNodes();
    if (n <= 1) return {};

    const result: Record<string, number> = {};
    for (const nodeId of this.nodeIds()) {
      result[nodeId] = this.outDegree(nodeId) / (n - 1);
    }
    return result;
  }

  /**
   * Create a deep copy of the graph.
   */
  copy(): DiGraph<N, E> {
    const newGraph = new DiGraph<N, E>();

    // Copy nodes with deep clone of data
    for (const [id, data] of this._nodes) {
      newGraph._nodes.set(id, JSON.parse(JSON.stringify(data)));
    }

    // Copy outgoing edges with deep clone of data
    for (const [source, targets] of this._outEdges) {
      const newTargets = new Map<string, E>();
      for (const [target, data] of targets) {
        newTargets.set(target, JSON.parse(JSON.stringify(data)));
      }
      newGraph._outEdges.set(source, newTargets);
    }

    // Copy incoming edges
    for (const [target, sources] of this._inEdges) {
      newGraph._inEdges.set(target, new Set(sources));
    }

    return newGraph;
  }

  /**
   * Get successors (nodes pointed to by outgoing edges).
   */
  successors(nodeId: string): string[] {
    const targets = this._outEdges.get(nodeId);
    return targets ? Array.from(targets.keys()) : [];
  }

  /**
   * Get predecessors (nodes that point to this node).
   */
  predecessors(nodeId: string): string[] {
    const sources = this._inEdges.get(nodeId);
    return sources ? Array.from(sources) : [];
  }

  /**
   * Clear all nodes and edges from the graph.
   */
  clear(): void {
    this._nodes.clear();
    this._outEdges.clear();
    this._inEdges.clear();
  }
}
