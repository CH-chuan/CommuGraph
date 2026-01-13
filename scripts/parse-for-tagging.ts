#!/usr/bin/env npx tsx
/**
 * CLI script to parse Claude Code logs for speech act tagging.
 *
 * Usage: npx tsx scripts/parse-for-tagging.ts <input.jsonl> [output.json]
 *
 * If output is not specified, writes to public/tagged_chalogs/<filename>.parsed.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, dirname, join } from 'path';

interface RawRecord {
  type: 'user' | 'assistant' | 'system' | 'summary';
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; thinking?: string }>;
  };
  timestamp?: string;
  uuid?: string;
}

interface ParsedMessage {
  index: number;
  role: 'user' | 'assistant';
  timestamp: string;
  content: string;
  content_preview: string;
}

function parseClaudeCodeLog(filePath: string): ParsedMessage[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const messages: ParsedMessage[] = [];
  let index = 0;

  for (const line of lines) {
    try {
      const record = JSON.parse(line) as RawRecord;

      // Skip system and summary records
      if (record.type !== 'user' && record.type !== 'assistant') continue;

      // Extract text content
      let textContent = '';

      if (record.message?.content) {
        if (typeof record.message.content === 'string') {
          textContent = record.message.content;
        } else if (Array.isArray(record.message.content)) {
          // Extract only text blocks, skip thinking and tool_use
          const textBlocks = record.message.content
            .filter(block => block.type === 'text' && block.text)
            .map(block => block.text!)
            .join('\n');
          textContent = textBlocks;
        }
      }

      // Skip if no text content
      if (!textContent.trim()) continue;

      messages.push({
        index: index++,
        role: record.type as 'user' | 'assistant',
        timestamp: record.timestamp || '',
        content: textContent,
        content_preview: textContent.length > 200 ? textContent.slice(0, 200) + '...' : textContent,
      });
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return messages;
}

// Main
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: npx tsx scripts/parse-for-tagging.ts <input.jsonl> [output.json]');
  process.exit(1);
}

const inputPath = args[0];
const defaultOutputDir = join(dirname(inputPath).replace(/public\/samples\/.*/, 'public/tagged_chalogs'));
const outputPath = args[1] || join('public/tagged_chalogs', basename(inputPath).replace('.jsonl', '.parsed.json'));

// Parse
console.log(`Parsing: ${inputPath}`);
const messages = parseClaudeCodeLog(inputPath);

// Ensure output directory exists
mkdirSync(dirname(outputPath), { recursive: true });

// Write output
const output = {
  messages,
  framework: 'claudecode',
  total_count: messages.length,
  source_file: inputPath,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Output: ${outputPath}`);
console.log(`Total messages: ${messages.length} (user + assistant with text content)`);
