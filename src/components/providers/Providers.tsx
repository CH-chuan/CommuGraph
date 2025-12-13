'use client';

/**
 * Providers - Client-side providers wrapper
 *
 * Wraps the app with QueryClientProvider and AppProvider
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/context/app-context';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside component to prevent shared state between requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}
