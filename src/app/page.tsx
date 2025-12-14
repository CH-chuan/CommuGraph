'use client';

/**
 * Main Application Page
 */

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PreFlightModal } from '@/components/upload/PreFlightModal';

export default function Home() {
  // Initialize modal to open since graphId starts as null
  const [showUploadModal, setShowUploadModal] = useState(true);

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
