'use client';

/**
 * GraphViewWrapper - Dynamic import wrapper for SSR-safe rendering
 *
 * React Flow requires browser APIs (window, document) that aren't available during SSR.
 * This wrapper uses Next.js dynamic imports to disable SSR for the GraphCanvas component.
 */

import dynamic from 'next/dynamic';

const GraphCanvas = dynamic(
  () => import('./GraphCanvas').then((mod) => ({ default: mod.GraphCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-slate-700">
            Loading graph...
          </div>
        </div>
      </div>
    ),
  }
);

export function GraphViewWrapper() {
  return <GraphCanvas />;
}
