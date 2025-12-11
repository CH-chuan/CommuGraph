'use client';

/**
 * WorkflowTimelineControls - Playback controls for workflow visualization
 *
 * Provides play/pause, prev/next, slider, and step counter.
 * Simplified version without Gantt chart (workflow view shows timeline visually).
 */

import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useAppContext } from '@/context/app-context';
import { useTimelinePlayback } from '@/hooks/use-timeline-playback';

export function WorkflowTimelineControls() {
  const { currentStep, setCurrentStep, totalSteps } = useAppContext();
  const { isPlaying, play, pause, reset } = useTimelinePlayback();

  return (
    <div className="border-t bg-white">
      <div className="flex items-center gap-3 p-3">
        {/* Reset button */}
        <Button
          variant="outline"
          size="icon"
          onClick={reset}
          disabled={currentStep === 0 && !isPlaying}
          title="Reset to start"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        {/* Previous step */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          title="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Play/Pause */}
        <Button
          variant="outline"
          size="icon"
          onClick={isPlaying ? pause : play}
          title={isPlaying ? 'Pause' : 'Play'}
          className={isPlaying ? 'bg-blue-50 border-blue-300' : ''}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {/* Next step */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
          disabled={currentStep === totalSteps}
          title="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Slider */}
        <div className="flex-1 px-4">
          <Slider
            value={[currentStep]}
            onValueChange={(values) => setCurrentStep(values[0])}
            max={totalSteps}
            step={1}
            className="w-full"
          />
        </div>

        {/* Step counter */}
        <div className="text-sm text-slate-600 min-w-[120px] text-right font-mono">
          Step {currentStep} / {totalSteps}
        </div>
      </div>
    </div>
  );
}
