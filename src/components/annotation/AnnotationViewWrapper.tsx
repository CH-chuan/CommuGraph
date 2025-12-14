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

const AnnotationView = dynamic(
  () => import('./AnnotationView').then((mod) => ({ default: mod.AnnotationView })),
  { ssr: false, loading: () => <AnnotationLoadingState /> }
);

function AnnotationLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
        <p className="text-sm text-slate-600">Loading annotation view...</p>
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
            Upload a Claude Code log to view annotations
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
            Error loading annotations
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
            No annotation records
          </div>
          <div className="text-sm text-slate-500">
            The preprocessor did not generate any annotation units
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
        <h3 className="font-semibold text-lg mb-4">Annotation Stats</h3>

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

        <div className="mt-6">
          <h4 className="font-medium text-slate-700 mb-2">Labels</h4>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-sm text-slate-500 italic">
              Annotation labels will appear here after labeling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
