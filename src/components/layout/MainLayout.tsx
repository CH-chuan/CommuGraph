'use client';

/**
 * MainLayout - 3-column application layout
 *
 * Left: Chat Log with cross-highlighting
 * Center: Graph Canvas (Topology/Sequence views) + Timeline Controls
 * Right: Insights Engine (placeholder for MVP)
 */

import { GraphViewWrapper } from '@/components/graph/GraphViewWrapper';
import { TimelineControls } from '@/components/graph/TimelineControls';
import { ChatLog } from '@/components/chat/ChatLog';

export function MainLayout() {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Chat Log */}
      <div className="w-1/4 border-r bg-slate-50 overflow-hidden">
        <ChatLog />
      </div>

      {/* Center Panel - Graph Canvas + Timeline */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <GraphViewWrapper />
        </div>
        <TimelineControls />
      </div>

      {/* Right Panel - Insights */}
      <div className="w-1/4 border-l bg-slate-50 p-4 overflow-auto">
        <h3 className="font-semibold text-lg mb-2">Insights</h3>
        <p className="text-sm text-slate-600">Metrics and anomalies...</p>
      </div>
    </div>
  );
}
