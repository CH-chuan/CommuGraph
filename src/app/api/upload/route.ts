/**
 * POST /api/upload - Upload and process log file(s)
 *
 * Accepts multipart form data with:
 * - file: Single log file (JSONL or JSON) for AutoGen
 * - files: Multiple log files for Claude Code (main session + agent-*.jsonl)
 * - framework: Framework name (e.g., 'autogen', 'claudecode')
 * - subAgentDirectory: (optional) Directory path to search for sub-agent files
 *
 * For Claude Code:
 * - Automatically detects the main session file (UUID format, not agent-*)
 * - Loads sub-agent files from uploaded files or from subAgentDirectory
 * - Merges all files for complete sub-agent visualization
 *
 * Returns: UploadResponse with graph_id and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseLog } from '@/lib/services/parser-service';
import { GraphBuilder } from '@/lib/services/graph-builder';
import { createSession } from '@/lib/services/session-manager';
import { ParserError } from '@/lib/parsers/base-parser';
import { ClaudeCodeParser } from '@/lib/parsers/claude-code-parser';
import { WorkflowGraphBuilder } from '@/lib/services/workflow-graph-builder';
import { loadSubAgentFiles, isValidSubAgentDirectory } from '@/lib/services/sub-agent-loader';
import { isSubAgentFile } from '@/lib/parsers/agent-id-extractor';
import { AnnotationPreprocessor } from '@/lib/annotation/preprocessor';
import type { AnnotationRecord } from '@/lib/annotation/types';
import type { UploadResponse, ErrorResponse, WorkflowGraphSnapshot } from '@/lib/models/types';

// Default sub-agent directory for development
const DEFAULT_SUBAGENT_DIR = 'public/samples/Users-harrywang-sandbox-paperfox';

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB per file
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse | ErrorResponse>> {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const framework = formData.get('framework') as string | null;

    // Validate framework
    if (!framework) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No framework specified' },
        { status: 400 }
      );
    }

    // Collect all files (support both 'file' and 'files' field names)
    const files: File[] = [];
    const fileEntries = formData.getAll('file');
    const filesEntries = formData.getAll('files');

    for (const entry of [...fileEntries, ...filesEntries]) {
      if (entry instanceof File) {
        files.push(entry);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No file(s) provided' },
        { status: 400 }
      );
    }

    // Check total size
    let totalSize = 0;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'Bad Request', message: `File "${file.name}" exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        );
      }
      totalSize += file.size;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Total size exceeds maximum of ${MAX_TOTAL_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Parse the log file(s)
    let messages;
    let workflowGraph: WorkflowGraphSnapshot | undefined;
    let annotationRecords: AnnotationRecord[] | undefined;
    let subAgentsLoaded = 0;
    let subAgentsMissing: string[] = [];

    try {
      if (framework === 'claudecode' && files.length > 0) {
        // Claude Code: use lazy sub-agent loading
        const claudeParser = new ClaudeCodeParser();

        // Read all uploaded files into a map
        const uploadedFileContents = new Map<string, string>();
        for (const file of files) {
          const content = await file.text();
          uploadedFileContents.set(file.name, content);
        }

        // Identify main session file (UUID format, not agent-*)
        let mainFilename: string | undefined;
        let mainContent: string | undefined;

        for (const [filename, content] of uploadedFileContents) {
          if (!isSubAgentFile(filename)) {
            mainFilename = filename;
            mainContent = content;
            break;
          }
        }

        if (!mainFilename || !mainContent) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'No main session file found (expected UUID format filename, not agent-*)' },
            { status: 400 }
          );
        }

        // Get sub-agent directory from form data (optional)
        const subAgentDirParam = formData.get('subAgentDirectory') as string | null;
        let subAgentDir: string | undefined;

        if (subAgentDirParam && isValidSubAgentDirectory(subAgentDirParam)) {
          subAgentDir = subAgentDirParam;
        } else {
          // Use default directory for development
          subAgentDir = DEFAULT_SUBAGENT_DIR;
        }

        // Lazy load sub-agent files
        const subAgentResult = await loadSubAgentFiles(mainContent, {
          baseDirectory: subAgentDir,
          uploadedFiles: uploadedFileContents,
        });

        // Track loading results
        subAgentsLoaded = subAgentResult.loadedFiles.size;
        subAgentsMissing = subAgentResult.missingAgentIds;

        // Log any errors
        if (subAgentResult.errors.length > 0) {
          console.error('[Upload] Sub-agent loading errors:', subAgentResult.errors);
        }

        // Parse with all available files
        const parseResult = claudeParser.parseWithLazySubAgents(
          mainContent,
          mainFilename,
          subAgentResult.loadedFiles
        );

        messages = parseResult.messages;

        // Build the workflow graph
        const workflowBuilder = new WorkflowGraphBuilder();
        workflowGraph = workflowBuilder.build(parseResult);

        // Generate annotation records using the preprocessor
        const annotationPreprocessor = new AnnotationPreprocessor();
        annotationPreprocessor.parseContent(mainContent, mainFilename);
        annotationRecords = annotationPreprocessor.generateAnnotationRecords();
        console.log(`[Upload] Generated ${annotationRecords.length} annotation records`);
      } else {
        // Single file parsing for other frameworks
        const content = await files[0].text();
        messages = parseLog(content, framework);
      }
    } catch (e) {
      if (e instanceof ParserError) {
        return NextResponse.json(
          {
            error: 'Parse Error',
            message: e.message,
            details: { lineNumber: e.lineNumber },
          },
          { status: 400 }
        );
      }
      throw e;
    }

    // Build the graph
    const graphBuilder = new GraphBuilder();
    graphBuilder.buildGraph(messages);

    // Create session (with optional workflow graph and annotation records for Claude Code)
    const sessionId = createSession(messages, framework, graphBuilder, workflowGraph, annotationRecords);

    // Get graph info
    const graph = graphBuilder.getGraph();
    const totalSteps = messages.length > 0
      ? Math.max(...messages.map((m) => m.step_index))
      : 0;

    // Calculate main agent steps (excluding sub-agent messages)
    // For Claude Code, filter by isSidechain; for others, use total
    const mainAgentMessages = messages.filter((m) => {
      // Check if message has isSidechain property (Claude Code messages)
      const msg = m as { isSidechain?: boolean };
      return msg.isSidechain !== true;
    });
    // Use COUNT of main agent messages, not MAX step_index
    const mainAgentSteps = mainAgentMessages.length;

    const response: UploadResponse = {
      graph_id: sessionId,
      message_count: messages.length,
      node_count: graph?.numberOfNodes() ?? 0,
      edge_count: graph?.numberOfEdges() ?? 0,
      total_steps: totalSteps,
      main_agent_steps: mainAgentSteps,
      framework,
      // Sub-agent loading info (for Claude Code)
      sub_agents_loaded: subAgentsLoaded > 0 ? subAgentsLoaded : undefined,
      sub_agents_missing: subAgentsMissing.length > 0 ? subAgentsMissing : undefined,
      // Annotation records count (for Claude Code)
      annotation_count: annotationRecords?.length,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: e instanceof Error ? e.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
