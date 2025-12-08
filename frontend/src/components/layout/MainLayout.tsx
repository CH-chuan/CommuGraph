/**
 * MainLayout - 3-column application layout
 *
 * Left: Narrative Log (placeholder for MVP)
 * Center: Graph View + Timeline Controls
 * Right: Insights Engine (placeholder for MVP)
 */

import { GraphView } from '@/components/graph/GraphView';
import { TimelineControls } from '@/components/graph/TimelineControls';

export function MainLayout() {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Placeholder for MVP */}
      <div className="w-1/4 border-r bg-slate-50 p-4 overflow-auto">
        <h3 className="font-semibold text-lg mb-2">Narrative Log</h3>
        <p className="text-sm text-slate-600">
          Message list coming in Phase 2...
        </p>
      </div>

      {/* Center Panel - Graph + Timeline */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <GraphView />
        </div>
        <TimelineControls />
      </div>

      {/* Right Panel - Placeholder for MVP */}
      <div className="w-1/4 border-l bg-slate-50 p-4 overflow-auto">
        <h3 className="font-semibold text-lg mb-2">Insights</h3>
        <p className="text-sm text-slate-600">
          Metrics and anomalies coming in Phase 2...
        </p>
      </div>
    </div>
  );
}
