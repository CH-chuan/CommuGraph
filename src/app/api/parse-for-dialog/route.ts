/**
 * API endpoint for parsing chat logs for speech act annotation.
 *
 * POST /api/parse-for-dialog
 * Body: { content: string } | { filePath: string }
 *
 * Returns simplified message list suitable for annotation.
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { parseLogAutoDetect } from '@/lib/services/parser-service';
import type { Message } from '@/lib/models/types';

export interface ParseForDialogRequest {
  content?: string;
  filePath?: string;
}

export interface SimplifiedMessage {
  step_index: number;
  timestamp: string;
  speaker: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_preview: string;
}

export interface ParseForDialogResponse {
  messages: SimplifiedMessage[];
  framework: string;
  total_count: number;
}

/**
 * Simplify a Message for annotation purposes.
 */
function simplifyMessage(msg: Message): SimplifiedMessage {
  // Determine role from sender
  const senderLower = msg.sender.toLowerCase();
  let role: 'user' | 'assistant' | 'system' = 'assistant';
  if (senderLower === 'user' || senderLower === 'human') {
    role = 'user';
  } else if (senderLower === 'system') {
    role = 'system';
  }

  // Create content preview (first 200 chars)
  const preview = msg.content.length > 200
    ? msg.content.slice(0, 200) + '...'
    : msg.content;

  return {
    step_index: msg.step_index,
    timestamp: msg.timestamp,
    speaker: msg.sender,
    role,
    content: msg.content,
    content_preview: preview,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ParseForDialogRequest;

    let content: string;

    if (body.content) {
      content = body.content;
    } else if (body.filePath) {
      // Read file from path
      try {
        content = await fs.readFile(body.filePath, 'utf-8');
      } catch (err) {
        return NextResponse.json(
          { error: 'File not found', message: `Could not read file: ${body.filePath}` },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Bad request', message: 'Either content or filePath is required' },
        { status: 400 }
      );
    }

    // Parse the content
    const { messages, framework } = parseLogAutoDetect(content);

    // Simplify messages for annotation
    const simplified = messages.map(simplifyMessage);

    const response: ParseForDialogResponse = {
      messages: simplified,
      framework,
      total_count: simplified.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Parse error', message },
      { status: 500 }
    );
  }
}
