'use client';

/**
 * Annotation Data Hook - TanStack Query for fetching annotation records
 *
 * Only works for Claude Code log sessions.
 */

import { useQuery } from '@tanstack/react-query';
import { getAnnotations } from '@/utils/api-client';

export const useAnnotationData = (graphId: string | null) => {
  return useQuery({
    queryKey: ['annotations', graphId],
    queryFn: () => {
      if (!graphId) throw new Error('No graph ID');
      return getAnnotations(graphId);
    },
    enabled: !!graphId,
    staleTime: Infinity, // Annotation data doesn't change once created
  });
};
