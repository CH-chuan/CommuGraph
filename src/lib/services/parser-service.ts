/**
 * Parser Service - Routes to framework-specific parsers
 *
 * Provides a unified interface for parsing log files from different frameworks.
 */

import { BaseParser, ParserError } from '@/lib/parsers/base-parser';
import { AutoGenParser } from '@/lib/parsers/autogen-parser';
import { ClaudeCodeParser } from '@/lib/parsers/claude-code-parser';
import type { Message } from '@/lib/models/types';

// Parser registry - maps framework names to parser classes
const PARSER_REGISTRY: Record<string, new () => BaseParser> = {
  autogen: AutoGenParser,
  claudecode: ClaudeCodeParser,
};

/**
 * Get list of available parsers/frameworks.
 */
export function getAvailableParsers(): string[] {
  return Object.keys(PARSER_REGISTRY);
}

/**
 * Parse log content using the specified framework parser.
 *
 * @param content - Raw log file content
 * @param framework - Framework name (e.g., 'autogen')
 * @returns List of parsed Message objects
 * @throws ParserError if parsing fails or framework not found
 */
export function parseLog(content: string, framework: string): Message[] {
  const ParserClass = PARSER_REGISTRY[framework.toLowerCase()];

  if (!ParserClass) {
    throw new ParserError(`Unknown framework: ${framework}. Available: ${getAvailableParsers().join(', ')}`);
  }

  const parser = new ParserClass();
  return parser.parse(content);
}

/**
 * Detect the framework from log content (basic heuristic).
 *
 * @param content - Raw log file content
 * @returns Detected framework name
 */
export function detectFramework(content: string): string {
  // Check for Claude Code patterns
  // Claude Code logs have sessionId, parentUuid, and specific type values
  if (
    content.includes('"sessionId"') &&
    content.includes('"parentUuid"') &&
    (content.includes('"isSidechain"') || content.includes('"requestId"'))
  ) {
    return 'claudecode';
  }

  // Check for CrewAI patterns (future)
  // if (content.includes('"crew"') || content.includes('CrewAI')) {
  //   return 'crewai';
  // }

  // Default to autogen
  return 'autogen';
}

/**
 * Parse log content with auto-detection of framework.
 *
 * @param content - Raw log file content
 * @returns Object with parsed messages and detected framework
 */
export function parseLogAutoDetect(content: string): {
  messages: Message[];
  framework: string;
} {
  const framework = detectFramework(content);
  const messages = parseLog(content, framework);
  return { messages, framework };
}
