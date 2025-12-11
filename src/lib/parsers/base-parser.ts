/**
 * Base Parser - Abstract interface for framework-specific log parsers
 *
 * All parsers inherit from this class and implement the parse() method.
 */

import type { Message } from '@/lib/models/types';

/**
 * Custom error class for parser errors with line context.
 */
export class ParserError extends Error {
  lineNumber?: number;
  originalError?: Error;

  constructor(
    message: string,
    options?: { lineNumber?: number; originalError?: Error }
  ) {
    super(message);
    this.name = 'ParserError';
    this.lineNumber = options?.lineNumber;
    this.originalError = options?.originalError;
  }
}

/**
 * Abstract base class for log parsers.
 */
export abstract class BaseParser {
  abstract readonly frameworkName: string;

  /**
   * Parse a log file content into Message objects.
   *
   * @param content - The raw content of the log file
   * @returns List of Message objects in chronological order
   * @throws ParserError if parsing fails
   */
  abstract parse(content: string): Message[];

  /**
   * Validate that content is non-empty.
   *
   * @param content - The content to validate
   * @throws ParserError if content is empty
   */
  protected validateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new ParserError('Log content is empty');
    }
  }
}
