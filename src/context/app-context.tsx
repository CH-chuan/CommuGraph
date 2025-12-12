'use client';

/**
 * Global Application State Context
 *
 * Manages global UI state (graphId, currentStep, highlighting, etc.)
 * Server state (graph data, metrics) is managed by TanStack Query
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

interface AppContextType {
  graphId: string | null;
  setGraphId: (id: string | null) => void;
  framework: string | null;
  setFramework: (framework: string | null) => void;
  currentStep: number;
  setCurrentStep: (step: number | ((prev: number) => number)) => void;
  totalSteps: number;
  setTotalSteps: (steps: number) => void;
  mainAgentStepCount: number;
  setMainAgentStepCount: (steps: number) => void;
  abstractionMode: string | null;
  setAbstractionMode: (mode: string | null) => void;
  highlightedAgentId: string | null;
  setHighlightedAgentId: (id: string | null) => void;
  highlightedStepIndex: number | null;
  setHighlightedStepIndex: (step: number | null) => void;
  focusStepIndex: number | null;
  setFocusStepIndex: (step: number | null) => void;
  showSubAgentMessages: boolean;
  setShowSubAgentMessages: (show: boolean) => void;
  selectedMetricsAgent: string;
  setSelectedMetricsAgent: (agent: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [graphId, setGraphId] = useState<string | null>(null);
  const [framework, setFramework] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [mainAgentStepCount, setMainAgentStepCount] = useState(0);
  const [abstractionMode, setAbstractionMode] = useState<string | null>(null);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(
    null
  );
  const [highlightedStepIndex, setHighlightedStepIndex] = useState<
    number | null
  >(null);
  const [focusStepIndex, setFocusStepIndex] = useState<number | null>(null);
  const [showSubAgentMessages, setShowSubAgentMessages] = useState(false);
  const [selectedMetricsAgent, setSelectedMetricsAgent] = useState('main');

  return (
    <AppContext.Provider
      value={{
        graphId,
        setGraphId,
        framework,
        setFramework,
        currentStep,
        setCurrentStep,
        totalSteps,
        setTotalSteps,
        mainAgentStepCount,
        setMainAgentStepCount,
        abstractionMode,
        setAbstractionMode,
        highlightedAgentId,
        setHighlightedAgentId,
        highlightedStepIndex,
        setHighlightedStepIndex,
        focusStepIndex,
        setFocusStepIndex,
        showSubAgentMessages,
        setShowSubAgentMessages,
        selectedMetricsAgent,
        setSelectedMetricsAgent,
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
