/**
 * GraphView - React Flow Graph Visualization
 *
 * Displays the communication graph with automatic layout
 */

import { useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppContext } from '@/context/AppContext';
import { useGraphData } from '@/hooks/useGraphData';
import {
  convertNodesToReactFlow,
  convertEdgesToReactFlow,
  getLayoutedElements,
} from '@/utils/graphAdapters';

export function GraphView() {
  const { graphId, currentStep } = useAppContext();
  const { data, isLoading, isError } = useGraphData(graphId, currentStep);

  const { nodes, edges } = useMemo(() => {
    if (!data?.graph) return { nodes: [], edges: [] };

    const reactFlowNodes = convertNodesToReactFlow(data.graph.nodes);
    const reactFlowEdges = convertEdgesToReactFlow(data.graph.edges);

    return getLayoutedElements(reactFlowNodes, reactFlowEdges);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-slate-700">
            Loading graph...
          </div>
          <div className="text-sm text-slate-500">
            Step {currentStep}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-red-600">
            Error loading graph
          </div>
          <div className="text-sm text-slate-500">
            Please try refreshing the page
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-right"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
