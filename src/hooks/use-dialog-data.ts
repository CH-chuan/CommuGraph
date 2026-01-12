'use client';

/**
 * Dialog Data Hook - TanStack Query for fetching dialog records
 *
 * Only works for Claude Code log sessions.
 */

import { useQuery } from '@tanstack/react-query';
import { getDialog } from '@/utils/api-client';

export const useDialogData = (graphId: string | null) => {
  return useQuery({
    queryKey: ['dialog', graphId],
    queryFn: () => {
      if (!graphId) throw new Error('No graph ID');
      return getDialog(graphId);
    },
    enabled: !!graphId,
    staleTime: Infinity, // Dialog data doesn't change once created
  });
};
