'use client';

/**
 * ChatLog - Left sidebar displaying raw message content
 *
 * Design spec: The Chat Log (Left Sidebar)
 * - Function: Displays the raw text content
 * - Interaction: Hovering over a message highlights corresponding node/edge in graph
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { useAppContext } from '@/context/app-context';
import { useGraphData } from '@/hooks/use-graph-data';
import { useWorkflowData } from '@/hooks/use-workflow-data';
import { useAnnotationData } from '@/hooks/use-annotation-data';
import { getAgentColor } from '@/utils/graph-adapters';
import { formatSubAgentName, extractAgentIdFromLaneId } from '@/utils/agent-naming';
import { MessageSquare, ArrowRight, ChevronDown, ChevronUp, Eye, EyeOff, Settings } from 'lucide-react';
import type { WorkflowNodeType } from '@/lib/models/types';

interface ChatMessage {
  stepIndex: number;
  displayStepLabel: string; // Formatted step label (e.g., "#1" or "sub-773d-1")
  sender: string;
  receiver: string | null;
  content: string;
  timestamp?: string;
  nodeType?: WorkflowNodeType; // For Claude Code messages
  laneId?: string; // For Claude Code - 'main' or 'agent-{id}'
  // Context compaction fields
  isContextCompact?: boolean;
  compactSummary?: string;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };
  // Image content from user messages
  images?: {
    mediaType: string;
    data: string;
  }[];
}

// Color config matching WorkflowNode.tsx
const nodeTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  user_input: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-700',
  },
  agent_reasoning: {
    bg: 'bg-purple-50',
    border: 'border-purple-400',
    text: 'text-purple-700',
  },
  tool_call: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    text: 'text-emerald-700',
  },
  tool_result: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    text: 'text-green-700',
  },
  result_success: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    text: 'text-green-700',
  },
  result_failure: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    text: 'text-red-700',
  },
  system_notice: {
    bg: 'bg-slate-50',
    border: 'border-slate-400',
    text: 'text-slate-700',
  },
};

export function ChatLog() {
  const {
    graphId,
    framework,
    viewMode,
    currentStep,
    highlightedStepIndex,
    setHighlightedStepIndex,
    setFocusStepIndex,
    showSubAgentMessages,
    setShowSubAgentMessages,
  } = useAppContext();

  const isClaudeCode = framework === 'claudecode';
  const isAnnotationView = isClaudeCode && viewMode === 'annotation';

  // Use different data sources based on framework
  const { data: graphData, isLoading: graphLoading } = useGraphData(
    isClaudeCode ? null : graphId, // Skip for Claude Code
    undefined
  );
  const { data: workflowData, isLoading: workflowLoading } = useWorkflowData(
    isClaudeCode ? graphId : null // Only fetch for Claude Code
  );
  // Fetch annotation data for annotation view to sync step numbers
  const { data: annotationData } = useAnnotationData(
    isAnnotationView ? graphId : null
  );

  const isLoading = isClaudeCode ? workflowLoading : graphLoading;

  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedMessageRef = useRef<HTMLDivElement>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [animatingStepIndex, setAnimatingStepIndex] = useState<number | null>(null);
  const [modalImage, setModalImage] = useState<{
    mediaType: string;
    data: string;
  } | null>(null);

  // Build mapping from workflow stepIndex to annotation sequenceIndex for annotation view
  const stepToAnnotationIndexMap = useMemo(() => {
    const map = new Map<number, number>();

    if (!isAnnotationView || !annotationData?.annotations || !workflowData?.workflow) {
      return map;
    }

    const workflowNodes = workflowData.workflow.nodes
      .filter(n => !n.isSessionStart && n.laneId === 'main')
      .sort((a, b) => a.stepIndex - b.stepIndex);

    const annotations = annotationData.annotations;

    // Sort workflow nodes by timestamp
    const sortedNodes = workflowNodes
      .map(node => ({
        node,
        time: node.timestamp ? new Date(node.timestamp).getTime() : 0
      }))
      .filter(n => n.time > 0)
      .sort((a, b) => a.time - b.time);

    // Sort annotations by timestamp with their 1-indexed sequence
    const sortedAnnotations = annotations
      .map((record, index) => ({
        record,
        sequenceIndex: index + 1, // 1-indexed to match AnnotationView
        time: record.timestamp ? new Date(record.timestamp).getTime() : 0
      }))
      .filter(a => a.time > 0)
      .sort((a, b) => a.time - b.time);

    // For each workflow node, find the closest annotation by timestamp
    sortedNodes.forEach(({ node, time: nodeTime }) => {
      let closestAnnotationSeq = -1;
      let closestDiff = Infinity;

      for (const { sequenceIndex, time: annotationTime } of sortedAnnotations) {
        const diff = Math.abs(annotationTime - nodeTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestAnnotationSeq = sequenceIndex;
        }
        // Early exit if we've passed the node time and diff is increasing
        if (annotationTime > nodeTime && diff > closestDiff) {
          break;
        }
      }

      if (closestAnnotationSeq >= 0) {
        map.set(node.stepIndex, closestAnnotationSeq);
      }
    });

    return map;
  }, [isAnnotationView, annotationData, workflowData]);

  // Extract messages based on framework
  const { messages, agentColors, mainStepIndices } = useMemo(() => {
    // For Claude Code, extract from workflow nodes
    if (isClaudeCode && workflowData?.workflow) {
      const workflow = workflowData.workflow;

      // Build lane info map for formatting sub-agent names
      const laneInfoMap = new Map(
        workflow.lanes.map((l) => [l.id, { subagentType: l.subagentType, agentId: l.agentId }])
      );

      // Build colors from lanes
      const laneIds = workflow.lanes.map((l) => l.id);
      const colors = new Map(
        laneIds.map((id) => [id, getAgentColor(id, laneIds)])
      );

      // Build main agent step indices for step mapping
      const mainNodes = workflow.nodes
        .filter((n) => n.laneId === 'main' && !n.isSessionStart)
        .sort((a, b) => a.stepIndex - b.stepIndex);
      const stepIndices = mainNodes.map((n) => n.stepIndex);

      // Build main agent step mapping (stepIndex -> sequential number, 1-indexed)
      const mainAgentStepMap = new Map<number, number>();
      mainNodes.forEach((n, idx) => {
        mainAgentStepMap.set(n.stepIndex, idx + 1);
      });

      // Build sub-agent step mapping per agent (agentId -> stepIndex -> sequential number)
      const subAgentStepMaps = new Map<string, Map<number, number>>();

      // Group sub-agent nodes by agentId
      const subAgentNodesGrouped = new Map<string, typeof workflow.nodes>();
      workflow.nodes.filter(n => n.laneId !== 'main' && !n.isSessionStart).forEach(n => {
        const agentId = n.agentId || extractAgentIdFromLaneId(n.laneId) || n.laneId;
        if (!subAgentNodesGrouped.has(agentId)) {
          subAgentNodesGrouped.set(agentId, []);
        }
        subAgentNodesGrouped.get(agentId)!.push(n);
      });

      // Sort each agent's nodes by stepIndex and assign sequential numbers
      for (const [agentId, agentNodes] of subAgentNodesGrouped) {
        const sortedNodes = agentNodes.sort((a, b) => a.stepIndex - b.stepIndex);
        const stepMap = new Map<number, number>();
        sortedNodes.forEach((n, idx) => {
          stepMap.set(n.stepIndex, idx + 1);
        });
        subAgentStepMaps.set(agentId, stepMap);
      }

      // Helper to get display step label
      const getDisplayStepLabel = (node: typeof workflow.nodes[0]): string => {
        if (node.isSessionStart) return '';

        // In annotation view, use annotation index for main agent messages
        if (isAnnotationView && node.laneId === 'main') {
          const annotationSeq = stepToAnnotationIndexMap.get(node.stepIndex);
          if (annotationSeq !== undefined) {
            return `#${annotationSeq}`;
          }
          // Fallback to workflow-based numbering if no mapping found
        }

        if (node.laneId === 'main') {
          const mainStep = mainAgentStepMap.get(node.stepIndex);
          return mainStep !== undefined ? `#${mainStep}` : `#${node.stepIndex}`;
        }
        // Sub-agent node
        const agentId = node.agentId || extractAgentIdFromLaneId(node.laneId) || node.laneId;
        const agentIdShort = agentId.substring(0, 4);
        const stepMap = subAgentStepMaps.get(agentId);
        const seq = stepMap?.get(node.stepIndex) ?? node.stepIndex;
        return `sub-${agentIdShort}-${seq}`;
      };

      // Filter nodes based on showSubAgentMessages toggle (exclude session start nodes)
      const filteredNodes = (showSubAgentMessages
        ? workflow.nodes
        : workflow.nodes.filter((node) => node.laneId === 'main')
      ).filter((node) => !node.isSessionStart);

      // Extract messages from workflow nodes
      const allMessages: ChatMessage[] = filteredNodes.map((node) => {
        // Format sender name to match graph node naming
        let senderName: string;

        // User input is a special case - just "User Input"
        if (node.nodeType === 'user_input') {
          senderName = 'User Input';
        } else if (node.laneId === 'main') {
          // Main agent: "Main Agent - {label}"
          senderName = `Main Agent - ${node.label}`;
        } else {
          // Sub-agent: "{formatted agent name} - {label}"
          const laneInfo = laneInfoMap.get(node.laneId);
          const agentId = laneInfo?.agentId || extractAgentIdFromLaneId(node.laneId) || node.laneId;
          const agentBaseName = formatSubAgentName(laneInfo?.subagentType || 'Agent', agentId);
          senderName = `${agentBaseName} - ${node.label}`;
        }

        return {
          stepIndex: node.stepIndex,
          displayStepLabel: getDisplayStepLabel(node),
          sender: senderName,
          receiver: null, // Workflow nodes don't have explicit receivers
          content: node.content || node.contentPreview || node.label,
          timestamp: node.timestamp,
          nodeType: node.nodeType, // For color matching with graph nodes
          laneId: node.laneId, // For determining if main agent or sub-agent
          // Context compaction fields
          isContextCompact: node.isContextCompact,
          compactSummary: node.compactSummary,
          compactMetadata: node.compactMetadata,
          // Image content from user messages
          images: node.images,
        };
      });

      // Sort by step index
      allMessages.sort((a, b) => a.stepIndex - b.stepIndex);

      return { messages: allMessages, agentColors: colors, mainStepIndices: stepIndices };
    }

    // For AutoGen and others, extract from graph edges
    if (!graphData?.graph) return { messages: [], agentColors: new Map(), mainStepIndices: [] };

    const agentIds = graphData.graph.nodes.map((n) => n.id);
    const colors = new Map(
      agentIds.map((id) => [id, getAgentColor(id, agentIds)])
    );

    // Build message list from edges with interaction metadata
    const allMessages: ChatMessage[] = [];
    graphData.graph.edges.forEach((edge) => {
      edge.interactions.forEach((interaction) => {
        // Use full content if available, fall back to preview, then default message
        const metadata = interaction.metadata || {};
        const content =
          (typeof metadata.content === 'string' ? metadata.content : null) ||
          (typeof metadata.content_preview === 'string'
            ? metadata.content_preview
            : null) ||
          `Message from ${edge.source} to ${edge.target}`;
        allMessages.push({
          stepIndex: interaction.step_index,
          displayStepLabel: `#${interaction.step_index}`, // AutoGen uses raw step index
          sender: edge.source,
          receiver: edge.target,
          content: content,
          timestamp: interaction.timestamp,
        });
      });
    });

    // Sort by step index
    allMessages.sort((a, b) => a.stepIndex - b.stepIndex);

    return { messages: allMessages, agentColors: colors, mainStepIndices: [] };
  }, [isClaudeCode, workflowData, graphData, showSubAgentMessages, isAnnotationView, stepToAnnotationIndexMap]);

  // For Claude Code, compute effectiveStepIndex from currentStep (main agent step number)
  const effectiveStepIndex = useMemo(() => {
    if (!isClaudeCode || mainStepIndices.length === 0) {
      // For non-Claude Code or when mapping not available, use currentStep directly
      return currentStep;
    }
    // Map main agent step number to actual stepIndex
    const targetIndex = Math.min(currentStep, mainStepIndices.length) - 1;
    if (targetIndex >= 0) {
      return mainStepIndices[targetIndex];
    }
    // currentStep is 0, return -1 (before all messages)
    return -1;
  }, [isClaudeCode, mainStepIndices, currentStep]);

  // Auto-scroll to highlighted step (from graph node click) with animation
  useEffect(() => {
    if (highlightedStepIndex !== null && highlightedMessageRef.current) {
      const element = highlightedMessageRef.current;

      // Use IntersectionObserver to detect when element is visible after scroll
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting) {
            // Element is now visible - trigger animation
            setAnimatingStepIndex(highlightedStepIndex);
            observer.disconnect();

            // Clear animation after it completes
            setTimeout(() => {
              setAnimatingStepIndex(null);
            }, 800);
          }
        },
        { threshold: 0.5 } // Trigger when 50% visible
      );

      observer.observe(element);

      // Start scrolling
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [highlightedStepIndex]);

  if (!graphId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-4">
        <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
        <p className="text-sm text-center">
          Upload a log file to see the conversation
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading messages...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Chat Log</h3>
            <p className="text-xs text-slate-500">
              {isAnnotationView && annotationData?.total
                ? `${annotationData.total} records`
                : `${messages.length} messages`}
            </p>
          </div>
          {/* Sub-agent toggle - only show for Claude Code */}
          {isClaudeCode && (
            <button
              onClick={() => setShowSubAgentMessages(!showSubAgentMessages)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-colors ${
                showSubAgentMessages
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
              title={showSubAgentMessages ? 'Hide sub-agent messages' : 'Show sub-agent messages'}
            >
              {showSubAgentMessages ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              Sub-agents
            </button>
          )}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-4 text-sm text-slate-500 text-center">
            No messages found
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {messages.map((msg, index) => {
              // Use effectiveStepIndex for Claude Code (maps main agent step to actual stepIndex)
              const isCurrent = msg.stepIndex === effectiveStepIndex;
              const isHighlighted = msg.stepIndex === highlightedStepIndex;
              // In annotation view, show all messages without opacity filtering
              const isPast = isAnnotationView ? true : msg.stepIndex <= effectiveStepIndex;

              // Get nodeType colors for Claude Code messages
              const typeColors = msg.nodeType ? nodeTypeColors[msg.nodeType] : null;

              // Fallback to agent-based colors for non-Claude Code
              const senderColor = agentColors.get(msg.sender) || '#64748b';
              const receiverColor = msg.receiver
                ? agentColors.get(msg.receiver) || '#64748b'
                : null;

              const messageId = `${msg.stepIndex}-${index}`;
              const isExpanded = expandedMessageIds.has(messageId);
              // Show expand button for messages longer than 80 chars or if they have line breaks
              const isLongMessage =
                msg.content.length > 80 || msg.content.includes('\n');

              // Only set ref for highlighted message (from graph click)
              const messageRef = isHighlighted ? highlightedMessageRef : undefined;

              // Check if this message should animate
              const isAnimating = msg.stepIndex === animatingStepIndex;

              // Special rendering for context compact messages
              if (msg.isContextCompact) {
                return (
                  <div
                    key={messageId}
                    ref={messageRef}
                    className={`
                      rounded-lg border-2 transition-all cursor-pointer overflow-hidden bg-white
                      border-slate-400
                      ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
                      ${isAnimating ? 'animate-pulse-highlight' : ''}
                      ${!isPast ? 'opacity-40' : ''}
                      hover:shadow-md
                      active:scale-[0.98]
                    `}
                    title="Context compaction - click to expand summary"
                    onClick={() => setHighlightedStepIndex(msg.stepIndex)}
                    onDoubleClick={() => {
                      setHighlightedStepIndex(msg.stepIndex);
                      if (msg.laneId === 'main' || !msg.laneId) {
                        setFocusStepIndex(msg.stepIndex);
                      }
                    }}
                  >
                    {/* Header: Context Compacted with icon */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100">
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-700">
                        Context Compacted
                      </span>
                      {msg.compactMetadata?.preTokens && (
                        <span className="ml-auto text-xs text-slate-500">
                          {msg.compactMetadata.preTokens.toLocaleString()} tokens
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMessageIds((prev) => {
                            const next = new Set(prev);
                            if (isExpanded) {
                              next.delete(messageId);
                            } else {
                              next.add(messageId);
                            }
                            return next;
                          });
                        }}
                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </div>

                    {/* Collapsible summary content */}
                    {isExpanded && msg.compactSummary && (
                      <div className="px-3 py-2 max-h-64 overflow-y-auto border-t border-slate-200">
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
                          {msg.compactSummary}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={messageId}
                  ref={messageRef}
                  className={`
                    rounded-lg border-2 transition-all cursor-pointer overflow-hidden bg-white
                    ${typeColors
                      ? typeColors.border
                      : (isCurrent ? 'border-blue-500 shadow-sm' : 'border-slate-200')
                    }
                    ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
                    ${isAnimating ? 'animate-pulse-highlight' : ''}
                    ${!isPast ? 'opacity-40' : ''}
                    hover:shadow-md
                    active:scale-[0.98]
                  `}
                  title={msg.laneId === 'main' || !msg.laneId ? "Click to highlight, double-click to jump to node" : "Click to highlight"}
                  onClick={() => setHighlightedStepIndex(msg.stepIndex)}
                  onDoubleClick={() => {
                    setHighlightedStepIndex(msg.stepIndex);
                    // Only jump to node for main agent messages (sub-agents are in modal)
                    if (msg.laneId === 'main' || !msg.laneId) {
                      setFocusStepIndex(msg.stepIndex);
                    }
                  }}
                >
                  {/* Header: Step + Sender -> Receiver (colored background) */}
                  <div className={`flex items-center gap-2 px-3 py-2 ${typeColors?.bg || (isCurrent ? 'bg-blue-50' : 'bg-slate-50')}`}>
                    <span className="text-xs font-mono text-slate-500 bg-white/60 px-1.5 py-0.5 rounded">
                      {msg.displayStepLabel}
                    </span>
                    <span
                      className={`text-sm font-semibold truncate ${typeColors?.text || ''}`}
                      style={typeColors ? undefined : { color: senderColor }}
                    >
                      {msg.sender}
                    </span>
                    {msg.receiver && (
                      <>
                        <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span
                          className="text-sm font-semibold truncate"
                          style={{ color: receiverColor || undefined }}
                        >
                          {msg.receiver}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Content with expand/collapse (white background) */}
                  <div className="px-3 py-2">
                    {/* Image thumbnails - render before text */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={`data:${img.mediaType};base64,${img.data}`}
                            alt={`Image ${imgIdx + 1}`}
                            className="max-h-24 max-w-32 rounded border border-slate-200 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalImage(img);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Text content */}
                    <div
                      className={`
                        text-sm text-slate-700 whitespace-pre-wrap break-words
                        ${isExpanded ? 'max-h-64 overflow-y-auto' : 'line-clamp-2 overflow-hidden'}
                      `}
                    >
                      {msg.content}
                    </div>

                    {/* Expand/Collapse button */}
                    {isLongMessage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMessageIds((prev) => {
                            const next = new Set(prev);
                            if (isExpanded) {
                              next.delete(messageId);
                            } else {
                              next.add(messageId);
                            }
                            return next;
                          });
                        }}
                        className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Show more
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={`data:${modalImage.mediaType};base64,${modalImage.data}`}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setModalImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-gray-600 text-xl leading-none">&times;</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
