'use client';

/**
 * MainLayout - 3-column application layout
 *
 * Left: Chat Log with cross-highlighting
 * Center: Graph Canvas (Topology/Sequence views) + Timeline Controls
 * Right: Insights Engine (placeholder for MVP)
 *
 * For Claude Code logs, shows WorkflowView instead of GraphView
 */

import { GraphViewWrapper } from '@/components/graph/GraphViewWrapper';
import { TimelineControls } from '@/components/graph/TimelineControls';
import { ChatLog } from '@/components/chat/ChatLog';
import { WorkflowViewWrapper, WorkflowTimelineControls } from '@/components/workflow';
import { useAppContext } from '@/context/app-context';

export function MainLayout() {
  const { framework } = useAppContext();
  const isClaudeCode = framework === 'claudecode';

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Chat Log */}
      <div className="w-1/4 border-r bg-slate-50 overflow-hidden">
        <ChatLog />
      </div>

      {/* Center Panel - Graph Canvas / Workflow View + Timeline */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden">
          {isClaudeCode ? <WorkflowViewWrapper /> : <GraphViewWrapper />}
        </div>
        {/* Timeline controls - different component for each framework */}
        {isClaudeCode ? <WorkflowTimelineControls /> : <TimelineControls />}
      </div>

      {/* Right Panel - Insights (only for non-Claude Code) */}
      {!isClaudeCode && (
        <div className="w-1/4 border-l bg-slate-50 p-4 overflow-auto">
          <h3 className="font-semibold text-lg mb-2">Insights</h3>
          <p className="text-sm text-slate-600">Metrics and anomalies...</p>
        </div>
      )}
    </div>
  );
}
