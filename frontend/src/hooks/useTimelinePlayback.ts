/**
 * Timeline Playback Hook
 *
 * Manages play/pause animation state for timeline scrubber
 */

import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';

export const useTimelinePlayback = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { currentStep, setCurrentStep, totalSteps } = useAppContext();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);
  const reset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  useEffect(() => {
    if (isPlaying && currentStep < totalSteps) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= totalSteps) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000); // 1 step per second
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, totalSteps, setCurrentStep]);

  return { isPlaying, play, pause, reset };
};
