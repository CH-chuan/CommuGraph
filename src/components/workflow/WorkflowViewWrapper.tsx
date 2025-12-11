'use client';

/**
 * WorkflowViewWrapper - Dynamic import wrapper for WorkflowView
 *
 * React Flow requires browser APIs that aren't available during SSR.
 * This wrapper uses dynamic import with ssr: false.
 */

import dynamic from 'next/dynamic';
import { useWorkflowData } from '@/hooks/use-workflow-data';
import { useAppContext } from '@/context/app-context';
import { MetricsDashboard } from './MetricsDashboard';

const WorkflowView = dynamic(
  () => import('./WorkflowView').then((mod) => ({ default: mod.WorkflowView })),
  { ssr: false, loading: () => <WorkflowLoadingState /> }
);

function WorkflowLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-slate-600">Loading workflow view...</p>
      </div>
    </div>
  );
}

export function WorkflowViewWrapper() {
  const { graphId } = useAppContext();
  const { data, isLoading, isError, error } = useWorkflowData(graphId);

  if (!graphId) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-700">
            No workflow loaded
          </div>
          <div className="text-sm text-slate-500">
            Upload a Claude Code log to visualize the workflow
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <WorkflowLoadingState />;
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-red-700">
            Error loading workflow
          </div>
          <div className="text-sm text-red-500">
            {error?.message || 'An error occurred'}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.workflow) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-lg font-medium text-slate-700">
            No workflow data
          </div>
          <div className="text-sm text-slate-500">
            The workflow graph is empty
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <WorkflowView data={data.workflow} />
      </div>
      <div className="w-72 border-l border-slate-200">
        <MetricsDashboard data={data.workflow} />
      </div>
    </div>
  );
}
