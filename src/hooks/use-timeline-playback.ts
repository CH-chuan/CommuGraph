'use client';

/**
 * Timeline Playback Hook
 *
 * Manages play/pause animation state for timeline scrubber
 */

import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/app-context';

export const useTimelinePlayback = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { currentStep, setCurrentStep, totalSteps, mainAgentStepCount, framework } = useAppContext();
  const intervalRef = useRef<number | null>(null);

  // Use main agent step count for Claude Code, total steps for others
  const effectiveSteps = framework === 'claudecode' ? mainAgentStepCount : totalSteps;

  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);
  const reset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  useEffect(() => {
    if (isPlaying && currentStep < effectiveSteps) {
      intervalRef.current = window.setInterval(() => {
        setCurrentStep((prev: number) => {
          if (prev >= effectiveSteps) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000); // 1 step per second
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, effectiveSteps, setCurrentStep]);

  return { isPlaying, play, pause, reset };
};
