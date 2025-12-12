'use client';

/**
 * MainLayout - 3-column application layout
 *
 * Left: Chat Log with cross-highlighting
 * Center: Graph Canvas (Topology/Sequence views) + Timeline Controls
 * Right: Insights Engine (placeholder for MVP)
 *
 * For Claude Code logs, shows WorkflowView or AnnotationView with tab toggle
 */

import { GraphViewWrapper } from '@/components/graph/GraphViewWrapper';
import { TimelineControls } from '@/components/graph/TimelineControls';
import { ChatLog } from '@/components/chat/ChatLog';
import { WorkflowViewWrapper, WorkflowTimelineControls } from '@/components/workflow';
import { AnnotationViewWrapper } from '@/components/annotation';
import { useAppContext } from '@/context/app-context';
import { GitBranch, Tag } from 'lucide-react';

/**
 * View Mode Tabs for Claude Code
 */
function ViewModeTabs() {
  const { viewMode, setViewMode } = useAppContext();

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 border-b border-slate-200">
      <button
        onClick={() => setViewMode('workflow')}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors
          ${viewMode === 'workflow'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-600 hover:bg-slate-200'
          }
        `}
      >
        <GitBranch className="w-4 h-4" />
        Workflow
      </button>
      <button
        onClick={() => setViewMode('annotation')}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors
          ${viewMode === 'annotation'
            ? 'bg-white text-purple-600 shadow-sm'
            : 'text-slate-600 hover:bg-slate-200'
          }
        `}
      >
        <Tag className="w-4 h-4" />
        Annotation
      </button>
    </div>
  );
}

export function MainLayout() {
  const { framework, viewMode } = useAppContext();
  const isClaudeCode = framework === 'claudecode';

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Chat Log */}
      <div className="w-1/4 border-r bg-slate-50 overflow-hidden">
        <ChatLog />
      </div>

      {/* Center Panel - Graph Canvas / Workflow View / Annotation View + Timeline */}
      <div className="flex-1 flex flex-col">
        {/* View Mode Tabs (only for Claude Code) */}
        {isClaudeCode && <ViewModeTabs />}

        {/* Main View Area */}
        <div className="flex-1 overflow-hidden">
          {isClaudeCode ? (
            viewMode === 'annotation' ? (
              <AnnotationViewWrapper />
            ) : (
              <WorkflowViewWrapper />
            )
          ) : (
            <GraphViewWrapper />
          )}
        </div>

        {/* Timeline controls (only for workflow view) */}
        {isClaudeCode && viewMode === 'workflow' && <WorkflowTimelineControls />}
        {!isClaudeCode && <TimelineControls />}
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
