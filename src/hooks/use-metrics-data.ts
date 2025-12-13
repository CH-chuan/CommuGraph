'use client';

/**
 * Metrics Data Hook - TanStack Query for fetching graph metrics
 *
 * Fetches centrality, density, and other graph-theoretic metrics
 */

import { useQuery } from '@tanstack/react-query';
import { getMetrics } from '@/utils/api-client';

export const useMetricsData = (graphId: string | null) => {
  return useQuery({
    queryKey: ['metrics', graphId],
    queryFn: () => {
      if (!graphId) throw new Error('No graph ID');
      return getMetrics(graphId);
    },
    enabled: !!graphId,
    staleTime: Infinity, // Metrics don't change for a given session
  });
};
