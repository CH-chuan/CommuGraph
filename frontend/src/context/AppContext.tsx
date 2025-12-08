/**
 * Global Application State Context
 *
 * Manages global UI state (graphId, currentStep, etc.)
 * Server state (graph data, metrics) is managed by TanStack Query
 */

import { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
  graphId: string | null;
  setGraphId: (id: string | null) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
  setTotalSteps: (steps: number) => void;
  abstractionMode: string | null;
  setAbstractionMode: (mode: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [graphId, setGraphId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [abstractionMode, setAbstractionMode] = useState<string | null>(null);

  return (
    <AppContext.Provider
      value={{
        graphId,
        setGraphId,
        currentStep,
        setCurrentStep,
        totalSteps,
        setTotalSteps,
        abstractionMode,
        setAbstractionMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
