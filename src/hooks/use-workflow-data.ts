'use client';

/**
 * Workflow Data Hook - TanStack Query for fetching workflow graph
 *
 * Automatically refetches when currentStep changes.
 * Only works for Claude Code log sessions.
 */

import { useQuery } from '@tanstack/react-query';
import { getWorkflow } from '@/utils/api-client';

export const useWorkflowData = (graphId: string | null, currentStep?: number) => {
  return useQuery({
    queryKey: ['workflow', graphId, currentStep],
    queryFn: () => {
      if (!graphId) throw new Error('No graph ID');
      return getWorkflow(graphId, currentStep);
    },
    enabled: !!graphId,
    staleTime: Infinity, // Workflow data doesn't change once created
  });
};
