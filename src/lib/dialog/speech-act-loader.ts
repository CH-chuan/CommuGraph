/**
 * Speech Act Loader
 *
 * Loads speech act annotations from tagged JSONL files and converts
 * them to LabelRecord format for display in the Dialog View.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { LabelId, LabelRecord } from './types';

// ============================================================================
// Types
// ============================================================================

/** Structure of a tagged record from the JSONL file */
export interface TaggedRecord {
  event_id: string;
  unit_type: 'user_turn' | 'assistant_turn';
  text_preview: string;
  speech_act: {
    primary_type: 'REPRESENTATIVE' | 'DIRECTIVE' | 'COMMISSIVE' | 'EXPRESSIVE' | 'DECLARATION';
    secondary_type?: string;
    notes?: string;
  };
}

/** Map from speech act type to LabelId */
const SPEECH_ACT_TO_LABEL_ID: Record<string, LabelId> = {
  REPRESENTATIVE: 'SPEECH_ACT_REPRESENTATIVE',
  DIRECTIVE: 'SPEECH_ACT_DIRECTIVE',
  COMMISSIVE: 'SPEECH_ACT_COMMISSIVE',
  EXPRESSIVE: 'SPEECH_ACT_EXPRESSIVE',
  DECLARATION: 'SPEECH_ACT_DECLARATION',
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Load speech act tags for a session from the tagged_chalogs directory.
 *
 * @param sessionId - The session ID to load tags for
 * @returns Map of event_id -> LabelRecord[] (empty map if no tagged file exists)
 */
export async function loadSpeechActTags(
  sessionId: string
): Promise<Map<string, LabelRecord[]>> {
  const taggedFilePath = getTaggedFilePath(sessionId);
  const labels = new Map<string, LabelRecord[]>();

  try {
    // Check if file exists
    await fs.access(taggedFilePath);
  } catch {
    // No tagged file exists for this session
    return labels;
  }

  try {
    const content = await fs.readFile(taggedFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as TaggedRecord;
        const labelRecords = convertToLabelRecords(record);

        if (labelRecords.length > 0) {
          labels.set(record.event_id, labelRecords);
        }
      } catch (parseError) {
        // Skip malformed lines
        console.warn(`[speech-act-loader] Failed to parse line: ${line.substring(0, 50)}...`);
      }
    }
  } catch (readError) {
    console.error(`[speech-act-loader] Failed to read tagged file: ${taggedFilePath}`, readError);
  }

  return labels;
}

/**
 * Check if a tagged file exists for a session.
 *
 * @param sessionId - The session ID to check
 * @returns true if a tagged file exists
 */
export async function hasTaggedFile(sessionId: string): Promise<boolean> {
  try {
    await fs.access(getTaggedFilePath(sessionId));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get the file path for a tagged session file.
 */
function getTaggedFilePath(sessionId: string): string {
  // File is in public/tagged_chalogs/{sessionId}.tagged.jsonl
  return path.join(process.cwd(), 'public', 'tagged_chalogs', `${sessionId}.tagged.jsonl`);
}

/**
 * Convert a TaggedRecord to LabelRecord array.
 * Creates one LabelRecord for primary_type and optionally one for secondary_type.
 */
function convertToLabelRecords(record: TaggedRecord): LabelRecord[] {
  const labels: LabelRecord[] = [];

  // Primary speech act
  const primaryLabelId = SPEECH_ACT_TO_LABEL_ID[record.speech_act.primary_type];
  if (primaryLabelId) {
    labels.push({
      id: primaryLabelId,
      evidence: record.speech_act.notes ? { cue: record.speech_act.notes } : undefined,
    });
  }

  // Secondary speech act (if present)
  if (record.speech_act.secondary_type) {
    const secondaryLabelId = SPEECH_ACT_TO_LABEL_ID[record.speech_act.secondary_type];
    if (secondaryLabelId) {
      labels.push({
        id: secondaryLabelId,
        confidence: 0.5, // Secondary type has lower confidence
      });
    }
  }

  return labels;
}
