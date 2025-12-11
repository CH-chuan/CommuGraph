/**
 * AutoGen Parser - Parses AutoGen conversation logs
 *
 * Supports both JSONL (one JSON object per line) and JSON array formats.
 * Handles various AutoGen log formats including GroupChat logs.
 */

import { BaseParser, ParserError } from './base-parser';
import { MessageType, type Message } from '@/lib/models/types';

interface LogEntry {
  sender?: string;
  name?: string;
  from?: string;
  recipient?: string;
  to?: string;
  message?: string | { content?: string; text?: string };
  content?: string;
  text?: string;
  role?: string;
  type?: string;
  timestamp?: string | number;
  time?: string | number;
  created_at?: string | number;
  date?: string | number;
  token_count?: number;
  function_call?: unknown;
  [key: string]: unknown;
}

export class AutoGenParser extends BaseParser {
  readonly frameworkName = 'autogen';

  /**
   * Parse AutoGen log content into Message objects.
   */
  parse(content: string): Message[] {
    this.validateContent(content);

    const messages: Message[] = [];
    let lineNumber = 0;

    try {
      // Check if this is a JSON array or JSONL
      const trimmed = content.trim();
      const firstChar = trimmed[0];

      if (firstChar === '[') {
        // JSON array format
        let data: LogEntry[];
        try {
          data = JSON.parse(content);
        } catch (e) {
          throw new ParserError('Invalid JSON array format', {
            originalError: e instanceof Error ? e : new Error(String(e)),
          });
        }

        for (let idx = 0; idx < data.length; idx++) {
          lineNumber = idx + 1;
          const message = this.parseEntry(data[idx], idx);
          if (message) {
            messages.push(message);
          }
        }
      } else {
        // JSONL format (one JSON object per line)
        const lines = content.split('\n');

        for (let idx = 0; idx < lines.length; idx++) {
          lineNumber = idx + 1;
          const line = lines[idx].trim();

          if (!line) continue;

          let entry: LogEntry;
          try {
            entry = JSON.parse(line);
          } catch (e) {
            throw new ParserError(`Invalid JSON on line ${lineNumber}`, {
              lineNumber,
              originalError: e instanceof Error ? e : new Error(String(e)),
            });
          }

          const message = this.parseEntry(entry, idx);
          if (message) {
            messages.push(message);
          }
        }
      }
    } catch (e) {
      if (e instanceof ParserError) {
        throw e;
      }
      throw new ParserError('Failed to parse AutoGen log', {
        lineNumber,
        originalError: e instanceof Error ? e : new Error(String(e)),
      });
    }

    if (messages.length === 0) {
      throw new ParserError('No valid messages found in log');
    }

    return messages;
  }

  /**
   * Parse a single log entry into a Message object.
   */
  private parseEntry(entry: LogEntry, stepIndex: number): Message | null {
    // Extract sender
    const sender = String(
      entry.sender || entry.name || entry.from || 'unknown'
    );

    // Extract receiver (null if "all" for broadcast)
    let receiver: string | null = null;
    const rawReceiver = entry.recipient || entry.to;
    if (rawReceiver && rawReceiver !== 'all') {
      receiver = String(rawReceiver);
    }

    // Extract content
    let content: string | null = null;

    if (entry.message !== undefined) {
      const msg = entry.message;
      if (typeof msg === 'object' && msg !== null) {
        content = msg.content || msg.text || JSON.stringify(msg);
      } else {
        content = String(msg);
      }
    } else if (entry.content !== undefined) {
      content = String(entry.content);
    } else if (entry.text !== undefined) {
      content = String(entry.text);
    }

    // Skip empty messages
    if (!content || content.trim() === '') {
      return null;
    }

    // Extract or infer timestamp
    const timestamp = this.extractTimestamp(entry, stepIndex);

    // Infer message type
    const messageType = this.inferMessageType(entry, content);

    // Build metadata
    const metadata: Record<string, unknown> = {
      role: entry.role,
      raw_entry: entry,
    };

    if (entry.token_count !== undefined) {
      metadata.token_count = entry.token_count;
    }

    return {
      step_index: stepIndex,
      timestamp,
      sender,
      receiver,
      message_type: messageType,
      content,
      metadata,
    };
  }

  /**
   * Extract or infer timestamp from log entry.
   */
  private extractTimestamp(entry: LogEntry, stepIndex: number): string {
    // Try known timestamp fields
    const timestampFields: (keyof LogEntry)[] = [
      'timestamp',
      'time',
      'created_at',
      'date',
    ];

    for (const field of timestampFields) {
      const value = entry[field];
      if (value !== undefined) {
        try {
          if (typeof value === 'number') {
            // Unix timestamp (seconds or milliseconds)
            const ts = value > 1e12 ? value : value * 1000;
            return new Date(ts).toISOString();
          } else if (typeof value === 'string') {
            // ISO format or other string format
            const normalized = value.replace('Z', '+00:00');
            return new Date(normalized).toISOString();
          }
        } catch {
          continue;
        }
      }
    }

    // No timestamp found - infer based on step index
    // Use a base time and add step_index milliseconds to create unique timestamps
    const baseTime = new Date('2024-01-01T00:00:00.000Z');
    return new Date(baseTime.getTime() + stepIndex).toISOString();
  }

  /**
   * Infer message type from entry data and content.
   */
  private inferMessageType(entry: LogEntry, content: string): MessageType {
    // Check for explicit type field
    if (entry.type) {
      const typeStr = entry.type.toLowerCase();
      if (Object.values(MessageType).includes(typeStr as MessageType)) {
        return typeStr as MessageType;
      }
    }

    // Check role field
    const role = (entry.role || '').toLowerCase();
    if (role === 'system') {
      return MessageType.SYSTEM;
    }

    // Check for function call
    if (entry.function_call) {
      return MessageType.ACTION;
    }

    // Check for common patterns in content
    const contentLower = content.toLowerCase();

    // Delegation patterns
    const delegationKeywords = [
      'please',
      'can you',
      'could you',
      'implement',
      'create',
      'build',
    ];
    if (delegationKeywords.some((kw) => contentLower.includes(kw))) {
      return MessageType.DELEGATION;
    }

    // Thought patterns
    const thoughtKeywords = [
      'thinking',
      'analyzing',
      'considering',
      'let me think',
    ];
    if (thoughtKeywords.some((kw) => contentLower.includes(kw))) {
      return MessageType.THOUGHT;
    }

    // Action patterns
    const actionKeywords = ['executing', 'running', 'calling', 'function_call'];
    if (actionKeywords.some((kw) => contentLower.includes(kw))) {
      return MessageType.ACTION;
    }

    // Default to response
    return MessageType.RESPONSE;
  }
}
