"""
Unit tests for GraphBuilder service.

Tests graph construction and time-based filtering.
"""

import pytest
from app.services.graph_builder import GraphBuilder
from app.models.types import Message


class TestGraphBuilder:
    """Test suite for GraphBuilder."""

    def test_build_graph_from_messages(self, sample_messages):
        """Test basic graph building from messages."""
        builder = GraphBuilder()
        graph = builder.build_graph(sample_messages)

        # Graph should have nodes
        assert graph.number_of_nodes() > 0

        # Graph should have edges
        assert graph.number_of_edges() > 0

    def test_graph_has_correct_nodes(self, sample_messages):
        """Test that all agents appear as nodes."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        # Extract unique agents from messages
        agents = set()
        for msg in sample_messages:
            agents.add(msg.sender)
            if msg.receiver:
                agents.add(msg.receiver)

        # All agents should be nodes
        assert set(builder.graph.nodes()) == agents

    def test_edges_have_temporal_data(self, sample_messages):
        """Test that edges store temporal interaction data."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        # Check that edges have interactions
        for u, v, data in builder.graph.edges(data=True):
            assert 'interactions' in data
            assert len(data['interactions']) > 0
            assert 'weight' in data
            assert data['weight'] == len(data['interactions'])

            # Each interaction should have required fields
            for interaction in data['interactions']:
                assert interaction.step_index >= 0
                assert interaction.timestamp is not None

    def test_filter_graph_by_step(self, sample_messages):
        """Test time-based graph filtering."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        # Filter to step 2
        filtered = builder.filter_graph_by_step(2)

        # Check that all interactions are <= step 2
        for u, v, data in filtered.edges(data=True):
            for interaction in data['interactions']:
                assert interaction.step_index <= 2

    def test_filter_removes_future_edges(self, sample_messages):
        """Test that filtering removes edges that don't exist yet."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        # The edge Manager->Tester appears at step 3
        # If we filter to step 2, it shouldn't exist
        filtered = builder.filter_graph_by_step(2)

        # Check if Manager->Tester edge exists in filtered graph
        manager_to_tester_exists = filtered.has_edge("Manager", "Tester")

        # It should not exist at step 2
        assert not manager_to_tester_exists

    def test_to_graph_snapshot(self, sample_messages):
        """Test conversion to GraphSnapshot."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        snapshot = builder.to_graph_snapshot()

        # Snapshot should have nodes and edges
        assert len(snapshot.nodes) > 0
        assert len(snapshot.edges) > 0
        assert snapshot.total_steps > 0

    def test_to_graph_snapshot_with_filtering(self, sample_messages):
        """Test GraphSnapshot with time filtering."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        snapshot = builder.to_graph_snapshot(max_step=2)

        # Current step should be set
        assert snapshot.current_step == 2

        # All edge interactions should be <= step 2
        for edge in snapshot.edges:
            for interaction in edge.interactions:
                assert interaction.step_index <= 2

    def test_get_graph_metrics(self, sample_messages):
        """Test graph metrics calculation."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        metrics = builder.get_graph_metrics()

        # Should have basic metrics
        assert 'node_count' in metrics
        assert 'edge_count' in metrics
        assert 'density' in metrics

        assert metrics['node_count'] > 0
        assert metrics['edge_count'] > 0
        assert 0 <= metrics['density'] <= 1

    def test_build_graph_empty_messages(self):
        """Test that building graph with empty messages raises error."""
        builder = GraphBuilder()

        with pytest.raises(ValueError, match="empty"):
            builder.build_graph([])

    def test_node_metadata_tracking(self, sample_messages):
        """Test that node metadata is tracked correctly."""
        builder = GraphBuilder()
        builder.build_graph(sample_messages)

        # Check Manager node
        manager_data = builder.graph.nodes['Manager']

        assert manager_data['id'] == 'Manager'
        assert manager_data['message_count'] > 0
        assert manager_data['first_appearance'] is not None
        assert manager_data['last_activity'] is not None
