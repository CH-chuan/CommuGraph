/**
 * API Response Helpers - Consistent error responses for API routes
 */

import { NextResponse } from 'next/server';
import type { ErrorResponse } from '@/lib/models/types';

/**
 * Returns a 404 Not Found response.
 */
export function notFoundResponse(
  resource: string,
  id: string
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: 'Not Found', message: `${resource} with ID '${id}' not found` },
    { status: 404 }
  );
}

/**
 * Returns a 400 Bad Request response.
 */
export function badRequestResponse(message: string): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: 'Bad Request', message },
    { status: 400 }
  );
}

/**
 * Returns a 500 Internal Server Error response.
 */
export function errorResponse(e: unknown): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: e instanceof Error ? e.message : 'An unexpected error occurred',
    },
    { status: 500 }
  );
}
