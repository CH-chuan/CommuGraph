"""
Graph builder service for constructing temporal communication graphs.

Takes parsed messages and builds a NetworkX graph with:
- Nodes representing agents
- Edges with temporal interaction history
- Support for time-based filtering
"""

from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple
import networkx as nx
from app.models.types import (
    EdgeData,
    GraphSnapshot,
    Interaction,
    IntentLabel,
    Message,
    NodeData,
)


class GraphBuilder:
    """
    Service for building temporal communication graphs from message lists.

    The graph uses a time-aware edge model where edges store a list of
    Interaction objects, enabling time-slider visualization and temporal analysis.
    """

    def __init__(self):
        self.graph: Optional[nx.DiGraph] = None
        self.messages: List[Message] = []

    def build_graph(self, messages: List[Message]) -> nx.DiGraph:
        """
        Build a directed graph from a list of messages.

        Args:
            messages: List of Message objects in chronological order

        Returns:
            NetworkX DiGraph with temporal edge data
        """
        if not messages:
            raise ValueError("Cannot build graph from empty message list")

        self.messages = sorted(messages, key=lambda m: m.step_index)
        self.graph = nx.DiGraph()

        # Track node metadata
        node_metadata: Dict[str, Dict] = {}

        # Build nodes and edges
        for message in self.messages:
            # Add sender node
            self._add_or_update_node(message.sender, message, node_metadata)

            # Add edge if there's a receiver
            if message.receiver:
                # Add receiver node
                self._add_or_update_node(message.receiver, message, node_metadata)

                # Add interaction to edge
                self._add_interaction(message)

        # Convert node metadata to NodeData and attach to graph
        for node_id, metadata in node_metadata.items():
            self.graph.nodes[node_id].update(metadata)

        return self.graph

    def _add_or_update_node(
        self,
        node_id: str,
        message: Message,
        node_metadata: Dict[str, Dict]
    ) -> None:
        """
        Add a new node or update existing node metadata.

        Args:
            node_id: The agent/node identifier
            message: The message being processed
            node_metadata: Dictionary tracking node metadata
        """
        if node_id not in node_metadata:
            node_metadata[node_id] = {
                'id': node_id,
                'label': node_id,
                'message_count': 0,
                'first_appearance': message.timestamp,
                'last_activity': message.timestamp,
                'metadata': {}
            }
            self.graph.add_node(node_id)

        # Update metadata
        if message.sender == node_id:
            node_metadata[node_id]['message_count'] += 1
            node_metadata[node_id]['last_activity'] = max(
                node_metadata[node_id]['last_activity'],
                message.timestamp
            )

    def _add_interaction(self, message: Message) -> None:
        """
        Add an interaction to the edge between sender and receiver.

        Args:
            message: The message creating this interaction
        """
        sender = message.sender
        receiver = message.receiver

        if not receiver:
            return

        # Create interaction object
        interaction = Interaction(
            step_index=message.step_index,
            timestamp=message.timestamp,
            intent=self._infer_intent(message),
            message_id=message.step_index,
            metadata={
                'message_type': message.message_type.value,
                'content_preview': message.content[:100] if message.content else ''
            }
        )

        # Add or update edge
        if self.graph.has_edge(sender, receiver):
            # Edge exists - append interaction
            self.graph[sender][receiver]['interactions'].append(interaction)
            self.graph[sender][receiver]['weight'] += 1
        else:
            # New edge
            self.graph.add_edge(
                sender,
                receiver,
                interactions=[interaction],
                weight=1,
                source=sender,
                target=receiver
            )

    def _infer_intent(self, message: Message) -> IntentLabel:
        """
        Infer the intent label from a message.

        This is a simple rule-based approach. In Phase 3, this will be
        replaced with LLM-based abstraction.

        Args:
            message: The message to analyze

        Returns:
            IntentLabel enum value
        """
        message_type = message.message_type

        # Map message types to intent labels
        type_to_intent = {
            'delegation': IntentLabel.DELEGATION,
            'action': IntentLabel.COORDINATION,
            'response': IntentLabel.INFORMATION_RESPONSE,
            'feedback': IntentLabel.FEEDBACK,
        }

        return type_to_intent.get(message_type.value, IntentLabel.UNKNOWN)

    def filter_graph_by_step(self, max_step: int) -> nx.DiGraph:
        """
        Return a filtered graph containing only interactions up to max_step.

        This is critical for time-slider functionality.

        Args:
            max_step: Maximum step index to include

        Returns:
            New NetworkX DiGraph filtered to the specified step
        """
        if not self.graph:
            raise ValueError("No graph built yet. Call build_graph() first.")

        filtered = self.graph.copy()

        # Filter edges
        edges_to_remove = []
        for u, v, data in filtered.edges(data=True):
            interactions = [
                i for i in data['interactions']
                if i.step_index <= max_step
            ]

            if interactions:
                filtered[u][v]['interactions'] = interactions
                filtered[u][v]['weight'] = len(interactions)
            else:
                edges_to_remove.append((u, v))

        # Remove edges with no interactions
        for u, v in edges_to_remove:
            filtered.remove_edge(u, v)

        # Remove isolated nodes (nodes with no edges)
        isolated_nodes = list(nx.isolates(filtered))
        filtered.remove_nodes_from(isolated_nodes)

        return filtered

    def to_graph_snapshot(self, max_step: Optional[int] = None) -> GraphSnapshot:
        """
        Convert the graph to a GraphSnapshot for API response.

        Args:
            max_step: Optional maximum step to filter to

        Returns:
            GraphSnapshot object ready for JSON serialization
        """
        if not self.graph:
            raise ValueError("No graph built yet. Call build_graph() first.")

        # Use filtered graph if max_step provided
        graph_to_use = self.filter_graph_by_step(max_step) if max_step else self.graph

        # Convert nodes
        nodes = []
        for node_id in graph_to_use.nodes():
            node_data_dict = graph_to_use.nodes[node_id]
            nodes.append(NodeData(**node_data_dict))

        # Convert edges
        edges = []
        for u, v, data in graph_to_use.edges(data=True):
            edges.append(EdgeData(
                source=data['source'],
                target=data['target'],
                interactions=data['interactions'],
                weight=data['weight']
            ))

        total_steps = max(m.step_index for m in self.messages) if self.messages else 0

        return GraphSnapshot(
            nodes=nodes,
            edges=edges,
            current_step=max_step,
            total_steps=total_steps,
            metadata={
                'node_count': len(nodes),
                'edge_count': len(edges),
                'message_count': len(self.messages)
            }
        )

    def get_graph_metrics(self) -> Dict:
        """
        Calculate basic graph metrics.

        Returns:
            Dictionary of metrics (centrality, density, etc.)
        """
        if not self.graph:
            raise ValueError("No graph built yet. Call build_graph() first.")

        metrics = {
            'node_count': self.graph.number_of_nodes(),
            'edge_count': self.graph.number_of_edges(),
            'density': nx.density(self.graph),
        }

        # Calculate centrality measures
        if self.graph.number_of_nodes() > 0:
            try:
                metrics['degree_centrality'] = nx.degree_centrality(self.graph)
                metrics['in_degree_centrality'] = nx.in_degree_centrality(self.graph)
                metrics['out_degree_centrality'] = nx.out_degree_centrality(self.graph)
            except Exception:
                # Some graphs might not support certain centrality measures
                pass

        return metrics
