'use client';

/**
 * MainLayout - 3-column application layout with resizable panels
 *
 * Left: Chat Log with cross-highlighting
 * Center: Graph Canvas (Topology/Sequence views) + Timeline Controls
 * Right: Insights Engine (placeholder for MVP)
 *
 * For Claude Code logs, shows WorkflowView or AnnotationView with tab toggle
 */

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GraphViewWrapper } from '@/components/graph/GraphViewWrapper';
import { TimelineControls } from '@/components/graph/TimelineControls';
import { ChatLog } from '@/components/chat/ChatLog';
import { WorkflowViewWrapper, WorkflowTimelineControls } from '@/components/workflow';
import { AnnotationViewWrapper } from '@/components/annotation';
import { AutoGenMetricsPanel } from '@/components/insights/AutoGenMetricsPanel';
import { useAppContext } from '@/context/app-context';
import { GitBranch, Tag, GripVertical } from 'lucide-react';

/**
 * Resize Handle Component
 */
function ResizeHandle() {
  return (
    <PanelResizeHandle className="group w-2 bg-slate-200 hover:bg-blue-400 active:bg-blue-500 transition-colors flex items-center justify-center cursor-col-resize">
      <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
    </PanelResizeHandle>
  );
}

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
    <PanelGroup direction="horizontal" className="flex-1">
      {/* Left Panel - Chat Log */}
      <Panel defaultSize={25} minSize={15} maxSize={50}>
        <div className="h-full bg-slate-50 overflow-hidden">
          <ChatLog />
        </div>
      </Panel>

      <ResizeHandle />

      {/* Center Panel - Graph Canvas / Workflow View / Annotation View + Timeline */}
      <Panel defaultSize={isClaudeCode ? 75 : 50} minSize={30}>
        <div className="h-full flex flex-col">
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
      </Panel>

      {/* Right Panel - Graph Metrics (only for non-Claude Code) */}
      {!isClaudeCode && (
        <>
          <ResizeHandle />
          <Panel defaultSize={25} minSize={15} maxSize={50}>
            <div className="h-full bg-slate-50 overflow-hidden">
              <AutoGenMetricsPanel />
            </div>
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
