#!/usr/bin/env node
/**
 * Filter parsed dialog JSONL for speech act tagging.
 *
 * Removes:
 * - system_turn records
 * - Records without text_or_artifact_ref.text
 *
 * Preserves original line_num for final sorting.
 *
 * Usage: node scripts/filter-for-tagging.js <input.parsed.jsonl> <output.taggable.jsonl>
 */

const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/filter-for-tagging.js <input.parsed.jsonl> <output.taggable.jsonl>');
  process.exit(1);
}

const [inputPath, outputPath] = args;

const lines = fs.readFileSync(inputPath, 'utf8').split('\n').filter(Boolean);

const taggable = [];
const skipped = { system: 0, noText: 0, sidechain: 0 };

lines.forEach((line, index) => {
  const lineNum = index + 1; // 1-indexed
  const record = JSON.parse(line);

  // Skip system_turn
  if (record.unit_type === 'system_turn') {
    skipped.system++;
    return;
  }

  // Skip sub-agent (sidechain) records
  if (record.source?.is_sidechain === true) {
    skipped.sidechain++;
    return;
  }

  // Skip records without text
  const text = record.text_or_artifact_ref?.text;
  if (!text || text.trim() === '') {
    skipped.noText++;
    return;
  }

  // Add line_num and include
  taggable.push({
    line_num: lineNum,
    event_id: record.event_id,
    unit_type: record.unit_type,
    text: text,
    text_preview: text.substring(0, 150)
  });
});

// Write taggable records
fs.writeFileSync(outputPath, taggable.map(r => JSON.stringify(r)).join('\n') + '\n');

// Report
console.log(`Total lines: ${lines.length}`);
console.log(`Taggable: ${taggable.length}`);
console.log(`Skipped system_turn: ${skipped.system}`);
console.log(`Skipped sidechain: ${skipped.sidechain}`);
console.log(`Skipped no text: ${skipped.noText}`);
console.log(`Output: ${outputPath}`);
