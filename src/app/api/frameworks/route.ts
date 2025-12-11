/**
 * GET /api/frameworks - List available frameworks
 *
 * Returns: FrameworkListResponse with list of supported parser frameworks
 */

import { NextResponse } from 'next/server';
import { getAvailableParsers } from '@/lib/services/parser-service';
import type { FrameworkListResponse } from '@/lib/models/types';

export async function GET(): Promise<NextResponse<FrameworkListResponse>> {
  const frameworks = getAvailableParsers();
  return NextResponse.json({ frameworks });
}
