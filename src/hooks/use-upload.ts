'use client';

/**
 * Upload Hook - TanStack Query mutation for file upload
 *
 * Supports both single file (AutoGen) and multiple files (Claude Code)
 * For Claude Code: supports optional sub-agent directory for lazy loading
 */

import { useMutation } from '@tanstack/react-query';
import { uploadLogFiles } from '@/utils/api-client';

interface UploadParams {
  files: File[];
  framework: string;
  /** Optional directory path to search for sub-agent files (Claude Code) */
  subAgentDirectory?: string;
}

export const useUpload = () => {
  return useMutation({
    mutationFn: ({ files, framework, subAgentDirectory }: UploadParams) =>
      uploadLogFiles(files, framework, subAgentDirectory),
  });
};
