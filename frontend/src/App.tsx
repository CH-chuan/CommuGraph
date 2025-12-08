/**
 * Main Application Component
 */

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PreFlightModal } from '@/components/upload/PreFlightModal';

function AppContent() {
  const { graphId } = useAppContext();
  const [showUploadModal, setShowUploadModal] = useState(!graphId);

  return (
    <>
      <div className="h-screen flex flex-col">
        <Header />
        {graphId ? <MainLayout /> : null}
      </div>

      <PreFlightModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </QueryClientProvider>
  );
}
