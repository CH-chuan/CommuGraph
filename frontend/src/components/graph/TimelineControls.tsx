/**
 * TimelineControls - Timeline scrubber with play/pause
 *
 * Controls for navigating through conversation steps
 */

import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useAppContext } from '@/context/AppContext';
import { useTimelinePlayback } from '@/hooks/useTimelinePlayback';

export function TimelineControls() {
  const { currentStep, setCurrentStep, totalSteps } = useAppContext();
  const { isPlaying, play, pause, reset } = useTimelinePlayback();

  return (
    <div className="border-t bg-white p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={reset}>
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={isPlaying ? pause : play}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentStep(totalSteps)}
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="flex-1 px-4">
          <Slider
            value={[currentStep]}
            onValueChange={(values) => setCurrentStep(values[0])}
            max={totalSteps}
            step={1}
            className="w-full"
          />
        </div>

        <div className="text-sm text-slate-600 min-w-[100px] text-right">
          Step {currentStep} / {totalSteps}
        </div>
      </div>
    </div>
  );
}
