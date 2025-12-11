'use client';

/**
 * Upload Hook - TanStack Query mutation for file upload
 *
 * Supports both single file (AutoGen) and multiple files (Claude Code)
 */

import { useMutation } from '@tanstack/react-query';
import { uploadLogFiles } from '@/utils/api-client';

export const useUpload = () => {
  return useMutation({
    mutationFn: ({ files, framework }: { files: File[]; framework: string }) =>
      uploadLogFiles(files, framework),
  });
};
