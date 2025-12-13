'use client';

/**
 * Graph Data Hook - TanStack Query for fetching graph
 *
 * Automatically refetches when currentStep changes
 */

import { useQuery } from '@tanstack/react-query';
import { getGraph } from '@/utils/api-client';

export const useGraphData = (graphId: string | null, currentStep?: number) => {
  return useQuery({
    queryKey: ['graph', graphId, currentStep],
    queryFn: () => {
      if (!graphId) throw new Error('No graph ID');
      return getGraph(graphId, currentStep);
    },
    enabled: !!graphId, // Only run query if graphId exists
    staleTime: Infinity, // Graph data doesn't change once created
  });
};
