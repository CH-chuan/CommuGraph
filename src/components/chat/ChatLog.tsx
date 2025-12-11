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
import { getAgentColor } from '@/utils/graph-adapters';
import { MessageSquare, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMessage {
  stepIndex: number;
  sender: string;
  receiver: string | null;
  content: string;
  timestamp?: string;
}

export function ChatLog() {
  const {
    graphId,
    currentStep,
    setCurrentStep,
    setHighlightedAgentId,
    setHighlightedStepIndex,
    highlightedStepIndex,
  } = useAppContext();
  const { data, isLoading } = useGraphData(graphId, undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMessageRef = useRef<HTMLDivElement>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(
    null
  );

  // Extract messages from graph edges
  const { messages, agentColors } = useMemo(() => {
    if (!data?.graph) return { messages: [], agentColors: new Map() };

    const agentIds = data.graph.nodes.map((n) => n.id);
    const colors = new Map(
      agentIds.map((id) => [id, getAgentColor(id, agentIds)])
    );

    // Build message list from edges with interaction metadata
    const allMessages: ChatMessage[] = [];
    data.graph.edges.forEach((edge) => {
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
          sender: edge.source,
          receiver: edge.target,
          content: content,
          timestamp: interaction.timestamp,
        });
      });
    });

    // Sort by step index
    allMessages.sort((a, b) => a.stepIndex - b.stepIndex);

    return { messages: allMessages, agentColors: colors };
  }, [data]);

  // Auto-scroll to current step
  useEffect(() => {
    if (currentMessageRef.current) {
      currentMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentStep]);

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
        <h3 className="font-semibold text-lg">Chat Log</h3>
        <p className="text-xs text-slate-500">{messages.length} messages</p>
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
              const isCurrent = msg.stepIndex === currentStep;
              const isHighlighted = msg.stepIndex === highlightedStepIndex;
              const isPast = msg.stepIndex <= currentStep;
              const senderColor = agentColors.get(msg.sender) || '#64748b';
              const receiverColor = msg.receiver
                ? agentColors.get(msg.receiver) || '#64748b'
                : null;

              const messageId = `${msg.stepIndex}-${index}`;
              const isExpanded = expandedMessageId === messageId;
              // Show expand button for messages longer than 80 chars or if they have line breaks
              const isLongMessage =
                msg.content.length > 80 || msg.content.includes('\n');

              return (
                <div
                  key={messageId}
                  ref={isCurrent ? currentMessageRef : undefined}
                  className={`
                    p-3 rounded-lg border transition-all cursor-pointer select-none
                    ${isCurrent ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white'}
                    ${isHighlighted && !isCurrent ? 'border-amber-400 bg-amber-50' : ''}
                    ${!isPast ? 'opacity-40' : ''}
                    hover:shadow-md hover:border-blue-300
                    active:scale-[0.98]
                  `}
                  title="Click to navigate - Double-click to jump and highlight"
                  onClick={() => setCurrentStep(msg.stepIndex)}
                  onDoubleClick={() => {
                    // Double-click to jump to this step and highlight the sender
                    setCurrentStep(msg.stepIndex);
                    setHighlightedAgentId(msg.sender);
                    // Clear highlight after 2 seconds
                    setTimeout(() => setHighlightedAgentId(null), 2000);
                  }}
                  onMouseEnter={() => {
                    setHighlightedAgentId(msg.sender);
                    setHighlightedStepIndex(msg.stepIndex);
                  }}
                  onMouseLeave={() => {
                    setHighlightedAgentId(null);
                    setHighlightedStepIndex(null);
                  }}
                >
                  {/* Header: Step + Sender -> Receiver */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      #{msg.stepIndex}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: senderColor }}
                    >
                      {msg.sender}
                    </span>
                    {msg.receiver && (
                      <>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: receiverColor || undefined }}
                        >
                          {msg.receiver}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Content with expand/collapse */}
                  <div>
                    <div
                      className={`
                        text-sm text-slate-700 overflow-y-auto
                        ${isExpanded ? 'max-h-64' : 'line-clamp-2'}
                      `}
                    >
                      {msg.content}
                    </div>

                    {/* Expand/Collapse button */}
                    {isLongMessage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMessageId(isExpanded ? null : messageId);
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
    </div>
  );
}
