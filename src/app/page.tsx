'use client';

/**
 * Main Application Page
 */

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/app-context';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PreFlightModal } from '@/components/upload/PreFlightModal';

export default function Home() {
  const { graphId } = useAppContext();
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Show upload modal initially when no graph is loaded
  useEffect(() => {
    if (!graphId) {
      setShowUploadModal(true);
    }
  }, [graphId]);

  return (
    <>
      <div className="h-screen flex flex-col">
        <Header />
        <MainLayout />
      </div>

      <PreFlightModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </>
  );
}
