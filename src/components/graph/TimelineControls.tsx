'use client';

/**
 * TimelineControls - Gantt-chart style timeline with agent tracks
 *
 * Design spec: "Smart" Timeline (Bottom)
 * - Rows: Each agent has a dedicated horizontal track
 * - Blocks: Messages/actions as colored blocks
 * - Color Matching: Track color matches agent's identity color
 * - Interaction: Clicking a block snaps to that step
 */

import { useMemo, useState } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useAppContext } from '@/context/app-context';
import { useTimelinePlayback } from '@/hooks/use-timeline-playback';
import { useGraphData } from '@/hooks/use-graph-data';
import { getAgentColor } from '@/utils/graph-adapters';

// Track height for each agent row
const TRACK_HEIGHT = 32;
const BLOCK_HEIGHT = 24;

export function TimelineControls() {
  const {
    graphId,
    currentStep,
    setCurrentStep,
    totalSteps,
    mainAgentStepCount,
    framework,
    setHighlightedAgentId,
  } = useAppContext();

  // For Claude Code, use mainAgentStepCount to exclude sub-agent steps
  const isClaudeCode = framework === 'claudecode';
  const effectiveSteps = isClaudeCode ? mainAgentStepCount : totalSteps;
  const { isPlaying, play, pause } = useTimelinePlayback();
  const { data } = useGraphData(graphId, undefined); // Get full data for timeline
  const [isExpanded, setIsExpanded] = useState(true);

  // Build agent tracks from graph data
  const { agents, agentActivities, agentColors } = useMemo(() => {
    if (!data?.graph)
      return { agents: [], agentActivities: new Map(), agentColors: new Map() };

    const agentIds = data.graph.nodes.map((n) => n.id);
    const colors = new Map(
      agentIds.map((id) => [id, getAgentColor(id, agentIds)])
    );

    // Build activity blocks for each agent (steps where they sent messages)
    const activities = new Map<string, number[]>();
    agentIds.forEach((id) => activities.set(id, []));

    data.graph.edges.forEach((edge) => {
      edge.interactions.forEach((interaction) => {
        const senderSteps = activities.get(edge.source) || [];
        if (!senderSteps.includes(interaction.step_index)) {
          senderSteps.push(interaction.step_index);
          activities.set(edge.source, senderSteps);
        }
      });
    });

    return { agents: agentIds, agentActivities: activities, agentColors: colors };
  }, [data]);

  // Calculate block positions
  const getBlockPosition = (step: number) => {
    if (effectiveSteps === 0) return 0;
    return (step / effectiveSteps) * 100;
  };

  return (
    <div className="border-t bg-white">
      {/* Playback Controls Row */}
      <div className="flex items-center gap-3 p-3 border-b">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          title="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={isPlaying ? pause : play}
          title={isPlaying ? 'Pause' : 'Play'}
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
          onClick={() => setCurrentStep(Math.min(effectiveSteps, currentStep + 1))}
          disabled={currentStep === effectiveSteps}
          title="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="flex-1 px-4">
          <Slider
            value={[currentStep]}
            onValueChange={(values) => setCurrentStep(values[0])}
            max={effectiveSteps}
            step={1}
            className="w-full"
          />
        </div>

        <div className="text-sm text-slate-600 min-w-[100px] text-right">
          Step {currentStep} / {effectiveSteps}
        </div>

        {/* Expand/Collapse button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-2 p-2 hover:bg-slate-100 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Gantt Chart Area */}
      {isExpanded && agents.length > 0 && (
        <div className="relative overflow-hidden">
          {/* Current step indicator line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 pointer-events-none"
            style={{
              left: `calc(120px + ${getBlockPosition(currentStep)}% * (100% - 120px) / 100)`,
            }}
          />

          {/* Agent Tracks */}
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: `${Math.min(agents.length, 5) * TRACK_HEIGHT + 8}px`,
            }}
          >
            {agents.map((agentId) => {
              const color = agentColors.get(agentId) || '#64748b';
              const steps = agentActivities.get(agentId) || [];

              return (
                <div
                  key={agentId}
                  className="flex items-center"
                  style={{ height: TRACK_HEIGHT }}
                  onMouseEnter={() => setHighlightedAgentId(agentId)}
                  onMouseLeave={() => setHighlightedAgentId(null)}
                >
                  {/* Agent label */}
                  <div
                    className="w-[120px] px-3 text-sm font-medium truncate flex items-center gap-2"
                    style={{ color }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {agentId}
                  </div>

                  {/* Track with blocks */}
                  <div className="flex-1 relative h-full bg-slate-50 border-b border-slate-100">
                    {steps.map((step: number) => {
                      const isCurrent = step === currentStep;
                      const isPast = step <= currentStep;

                      return (
                        <div
                          key={step}
                          className={`
                            absolute cursor-pointer transition-all rounded
                            ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}
                          `}
                          style={{
                            left: `${getBlockPosition(step)}%`,
                            top: (TRACK_HEIGHT - BLOCK_HEIGHT) / 2,
                            width: Math.max(8, 100 / effectiveSteps) + '%',
                            minWidth: '8px',
                            height: BLOCK_HEIGHT,
                            backgroundColor: color,
                            opacity: isPast ? 1 : 0.3,
                          }}
                          onClick={() => setCurrentStep(step)}
                          title={`Step ${step}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step markers */}
          <div className="flex items-center h-6 border-t">
            <div className="w-[120px]" />
            <div className="flex-1 relative">
              {[0, 25, 50, 75, 100].map((percent) => {
                const step = Math.round((percent / 100) * effectiveSteps);
                return (
                  <span
                    key={percent}
                    className="absolute text-xs text-slate-400 -translate-x-1/2"
                    style={{ left: `${percent}%` }}
                  >
                    {step}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
