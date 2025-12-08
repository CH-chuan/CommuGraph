/**
 * Upload Hook - TanStack Query mutation for file upload
 */

import { useMutation } from '@tanstack/react-query';
import { uploadLogFile } from '@/api/endpoints';

export const useUpload = () => {
  return useMutation({
    mutationFn: ({ file, framework }: { file: File; framework: string }) =>
      uploadLogFile(file, framework),
  });
};
