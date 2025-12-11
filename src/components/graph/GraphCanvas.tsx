'use client';

/**
 * GraphCanvas - Main visualization container
 *
 * Displays the topology graph with Rich Card nodes and Ghost Trail edges
 */

import { useAppContext } from '@/context/app-context';
import { GraphView } from './GraphView';

export function GraphCanvas() {
  const { graphId } = useAppContext();

  if (!graphId) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-slate-600">
            No graph loaded
          </div>
          <p className="text-sm text-slate-500">
            Upload a log file to visualize the communication graph
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GraphView />
    </div>
  );
}
