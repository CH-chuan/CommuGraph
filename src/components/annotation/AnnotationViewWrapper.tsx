'use client';

/**
 * AnnotationViewWrapper - Dynamic import wrapper for AnnotationView
 *
 * React Flow requires browser APIs that aren't available during SSR.
 * This wrapper uses dynamic import with ssr: false.
 *
 * Handles cross-highlighting between annotation nodes and chat log.
 */

import { useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAnnotationData } from '@/hooks/use-annotation-data';
import { useAppContext } from '@/context/app-context';
import { useWorkflowData } from '@/hooks/use-workflow-data';
import { formatDuration } from '@/utils/format';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

const AnnotationView = dynamic(
  () => import('./AnnotationView').then((mod) => ({ default: mod.AnnotationView })),
  { ssr: false, loading: () => <AnnotationLoadingState /> }
);

function AnnotationLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
        <p className="text-sm text-slate-600">Loading dialog view...</p>
      </div>
    </div>
  );
}

export function AnnotationViewWrapper() {
  const {
    graphId,
    highlightedStepIndex,
    setHighlightedStepIndex,
    focusStepIndex,
    setFocusStepIndex,
  } = useAppContext();

  const { data, isLoading, isError, error } = useAnnotationData(graphId);
  const { data: workflowData } = useWorkflowData(graphId);

  // Build mapping between annotation records and workflow step indices
  // Maps each annotation to its closest workflow node(s) by timestamp
  const { annotationToStepMap, stepToAnnotationMap } = useMemo(() => {
    const aToS = new Map<number, number>(); // annotation index -> first matching stepIndex
    const sToA = new Map<number, number>(); // stepIndex -> annotation index

    if (!data?.annotations || !workflowData?.workflow) {
      return { annotationToStepMap: aToS, stepToAnnotationMap: sToA };
    }

    const workflowNodes = workflowData.workflow.nodes
      .filter(n => !n.isSessionStart && n.laneId === 'main')
      .sort((a, b) => a.stepIndex - b.stepIndex);

    const annotations = data.annotations;

    // Sort annotations by timestamp
    const sortedAnnotations = annotations
      .map((record, index) => ({
        record,
        index,
        time: record.timestamp ? new Date(record.timestamp).getTime() : 0
      }))
      .filter(a => a.time > 0)
      .sort((a, b) => a.time - b.time);

    // Sort workflow nodes by timestamp
    const sortedNodes = workflowNodes
      .map(node => ({
        node,
        time: node.timestamp ? new Date(node.timestamp).getTime() : 0
      }))
      .filter(n => n.time > 0)
      .sort((a, b) => a.time - b.time);

    // For each annotation, find the closest workflow node
    sortedAnnotations.forEach(({ index: annotationIndex, time: annotationTime }) => {
      let closestStepIndex = -1;
      let closestDiff = Infinity;

      for (const { node, time: nodeTime } of sortedNodes) {
        const diff = Math.abs(nodeTime - annotationTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestStepIndex = node.stepIndex;
        }
        // Early exit if we've passed the annotation time and diff is increasing
        if (nodeTime > annotationTime && diff > closestDiff) {
          break;
        }
      }

      if (closestStepIndex >= 0) {
        aToS.set(annotationIndex, closestStepIndex);
      }
    });

    // For each workflow node, find the closest annotation
    sortedNodes.forEach(({ node, time: nodeTime }) => {
      let closestAnnotationIndex = -1;
      let closestDiff = Infinity;

      for (const { index, time: annotationTime } of sortedAnnotations) {
        const diff = Math.abs(annotationTime - nodeTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestAnnotationIndex = index;
        }
        // Early exit if we've passed the node time and diff is increasing
        if (annotationTime > nodeTime && diff > closestDiff) {
          break;
        }
      }

      if (closestAnnotationIndex >= 0) {
        sToA.set(node.stepIndex, closestAnnotationIndex);
      }
    });

    return { annotationToStepMap: aToS, stepToAnnotationMap: sToA };
  }, [data, workflowData]);

  // Compute conversation timing stats from annotations
  const timingStats = useMemo(() => {
    if (!data?.annotations) {
      return null;
    }

    const annotations = data.annotations;

    // ===== User Prompt Intervals =====
    // Get user turns sorted by timestamp
    const userTurns = annotations
      .map((record, index) => ({
        index,
        timestamp: record.timestamp ? new Date(record.timestamp).getTime() : 0,
      }))
      .filter((r) => {
        const record = annotations[r.index];
        return record.unit_type === 'user_turn' && r.timestamp > 0;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    let userPromptStats = null;
    if (userTurns.length >= 2) {
      const intervals: { ms: number; endAnnotationIndex: number }[] = [];
      for (let i = 1; i < userTurns.length; i++) {
        const intervalMs = userTurns[i].timestamp - userTurns[i - 1].timestamp;
        if (intervalMs > 0) {
          intervals.push({
            ms: intervalMs,
            endAnnotationIndex: userTurns[i].index,
          });
        }
      }

      if (intervals.length > 0) {
        const sortedByMs = [...intervals].sort((a, b) => a.ms - b.ms);
        const min = sortedByMs[0];
        const max = sortedByMs[sortedByMs.length - 1];
        const total = intervals.reduce((sum, i) => sum + i.ms, 0);
        const avg = total / intervals.length;

        userPromptStats = {
          min: min.ms,
          max: max.ms,
          maxAnnotationIndex: max.endAnnotationIndex,
          avg,
          total,
          intervalCount: intervals.length,
        };
      }
    }

    // ===== Agent Burst Duration =====
    // Group consecutive assistant turns and calculate duration of each group
    const bursts: { ms: number; firstAnnotationIndex: number; lastAnnotationIndex: number }[] = [];
    let burstIndices: number[] = [];
    let burstTimestamps: number[] = [];

    const finalizeBurst = () => {
      if (burstIndices.length > 0) {
        const firstTs = Math.min(...burstTimestamps);
        const lastTs = Math.max(...burstTimestamps);
        const duration = lastTs - firstTs;
        // Only count bursts with measurable duration (more than 1 turn or has duration)
        if (burstIndices.length > 1 || duration > 0) {
          bursts.push({
            ms: duration,
            firstAnnotationIndex: burstIndices[0],
            lastAnnotationIndex: burstIndices[burstIndices.length - 1],
          });
        }
      }
      burstIndices = [];
      burstTimestamps = [];
    };

    // Process annotations in order (they should already be in sequence order)
    for (let index = 0; index < annotations.length; index++) {
      const record = annotations[index];
      const timestamp = record.timestamp ? new Date(record.timestamp).getTime() : 0;

      if (record.unit_type === 'assistant_turn' && timestamp > 0) {
        // Start or continue a burst
        burstIndices.push(index);
        burstTimestamps.push(timestamp);
      } else {
        // End current burst if exists
        finalizeBurst();
      }
    }

    // Don't forget the last burst if it exists
    finalizeBurst();

    let agentBurstStats = null;
    if (bursts.length > 0) {
      const sortedByMs = [...bursts].sort((a, b) => a.ms - b.ms);
      const min = sortedByMs[0];
      const max = sortedByMs[sortedByMs.length - 1];
      const total = bursts.reduce((sum, b) => sum + b.ms, 0);
      const avg = total / bursts.length;

      agentBurstStats = {
        min: min.ms,
        max: max.ms,
        maxFirstAnnotationIndex: max.firstAnnotationIndex,
        avg,
        total,
        burstCount: bursts.length,
      };
    }

    // Return null if neither stat is available
    if (!userPromptStats && !agentBurstStats) {
      return null;
    }

    return {
      userPrompt: userPromptStats,
      agentBurst: agentBurstStats,
    };
  }, [data]);

  // Handle jump to max user prompt interval
  const handleJumpToMaxUserPrompt = useCallback(() => {
    if (!timingStats?.userPrompt) return;

    const stepIndex = annotationToStepMap.get(timingStats.userPrompt.maxAnnotationIndex);
    if (stepIndex !== undefined) {
      setFocusStepIndex(stepIndex);
    }
  }, [timingStats, annotationToStepMap, setFocusStepIndex]);

  // Handle jump to max agent burst
  const handleJumpToMaxAgentBurst = useCallback(() => {
    if (!timingStats?.agentBurst) return;

    const stepIndex = annotationToStepMap.get(timingStats.agentBurst.maxFirstAnnotationIndex);
    if (stepIndex !== undefined) {
      setFocusStepIndex(stepIndex);
    }
  }, [timingStats, annotationToStepMap, setFocusStepIndex]);

  // Convert highlighted step index to annotation index
  const highlightedAnnotationIndex = useMemo(() => {
    if (highlightedStepIndex === null) return null;
    return stepToAnnotationMap.get(highlightedStepIndex) ?? null;
  }, [highlightedStepIndex, stepToAnnotationMap]);

  // Convert focus step index to annotation index
  const focusAnnotationIndex = useMemo(() => {
    if (focusStepIndex === null) return null;
    return stepToAnnotationMap.get(focusStepIndex) ?? null;
  }, [focusStepIndex, stepToAnnotationMap]);

  // Handle annotation node click - set highlighted step index for chat log
  const handleNodeClick = useCallback((annotationIndex: number) => {
    const stepIndex = annotationToStepMap.get(annotationIndex);
    if (stepIndex !== undefined) {
      setHighlightedStepIndex(stepIndex);
    }
  }, [annotationToStepMap, setHighlightedStepIndex]);

  // Clear focus after it's been handled
  const handleFocusHandled = useCallback(() => {
    setFocusStepIndex(null);
  }, [setFocusStepIndex]);

  if (!graphId) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-700">
            No data loaded
          </div>
          <div className="text-sm text-slate-500">
            Upload a Claude Code log to view dialog
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <AnnotationLoadingState />;
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-red-700">
            Error loading dialog
          </div>
          <div className="text-sm text-red-500">
            {error?.message || 'An error occurred'}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.annotations || data.annotations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-700">
            No dialog records
          </div>
          <div className="text-sm text-slate-500">
            The preprocessor did not generate any dialog units
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Annotation View */}
      <div className="flex-1">
        <AnnotationView
          annotations={data.annotations}
          highlightedIndex={highlightedAnnotationIndex}
          focusIndex={focusAnnotationIndex}
          onNodeClick={handleNodeClick}
          onFocusHandled={handleFocusHandled}
        />
      </div>

      {/* Right Panel - Stats & Future Label Panel */}
      <div className="w-72 border-l border-slate-200 bg-slate-50 p-4 overflow-auto">
        <h3 className="font-semibold text-lg mb-4">Dialog Stats</h3>

        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-slate-800">{data.total}</div>
            <div className="text-sm text-slate-500">Total Records</div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{data.user_turn_count}</div>
            <div className="text-sm text-slate-500">User Turns</div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-purple-600">{data.assistant_turn_count}</div>
            <div className="text-sm text-slate-500">Assistant Turns</div>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-slate-600">{data.system_turn_count}</div>
            <div className="text-sm text-slate-500">System Turns</div>
          </div>
        </div>

        {/* Conversation Timing */}
        {timingStats && (
          <div className="mt-6">
            <CollapsibleSection title="Conversation Timing" defaultOpen={false}>
              <div className="space-y-4">
                {/* User Prompt Intervals */}
                {timingStats.userPrompt && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide px-2">
                      User Prompt Intervals
                    </div>
                    <div className="bg-white rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Min</span>
                        <span className="font-medium text-slate-700">
                          {formatDuration(timingStats.userPrompt.min)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Max</span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">
                            {formatDuration(timingStats.userPrompt.max)}
                          </span>
                          <button
                            onClick={handleJumpToMaxUserPrompt}
                            className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          >
                            Go
                          </button>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Avg</span>
                        <span className="font-medium text-slate-700">
                          {formatDuration(timingStats.userPrompt.avg)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agent Burst Duration */}
                {timingStats.agentBurst && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide px-2">
                      Agent Burst Duration
                    </div>
                    <div className="bg-white rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Min</span>
                        <span className="font-medium text-slate-700">
                          {formatDuration(timingStats.agentBurst.min)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Max</span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">
                            {formatDuration(timingStats.agentBurst.max)}
                          </span>
                          <button
                            onClick={handleJumpToMaxAgentBurst}
                            className="px-2 py-0.5 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
                          >
                            Go
                          </button>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Avg</span>
                        <span className="font-medium text-slate-700">
                          {formatDuration(timingStats.agentBurst.avg)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>
        )}

        <div className="mt-6">
          <h4 className="font-medium text-slate-700 mb-2">Labels</h4>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm text-slate-500 italic">
              Dialog labels will appear here after labeling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
