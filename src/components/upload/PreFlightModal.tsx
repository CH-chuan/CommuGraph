'use client';

/**
 * PreFlightModal - File Upload Component
 *
 * Allows users to upload log files and select framework.
 * For Claude Code: supports multiple file selection (main + sub-agent files)
 */

import { useState } from 'react';
import { Upload, Zap, FileText, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpload } from '@/hooks/use-upload';
import { useAppContext } from '@/context/app-context';

interface PreFlightModalProps {
  open: boolean;
  onClose: () => void;
}

export function PreFlightModal({ open, onClose }: PreFlightModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [framework, setFramework] = useState('claudecode');
  const [subAgentDir, setSubAgentDir] = useState('');
  const { setGraphId, setTotalSteps, setMainAgentStepCount, setFramework: setAppFramework, setViewMode } = useAppContext();
  const uploadMutation = useUpload();

  const isClaudeCode = framework === 'claudecode';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    if (isClaudeCode) {
      // Claude Code: allow multiple files
      setFiles(Array.from(selectedFiles));
    } else {
      // Other frameworks: single file
      setFiles(selectedFiles[0] ? [selectedFiles[0]] : []);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    uploadMutation.mutate(
      {
        files,
        framework,
        subAgentDirectory: isClaudeCode && subAgentDir ? subAgentDir : undefined,
      },
      {
        onSuccess: (data) => {
          setGraphId(data.graph_id);
          setTotalSteps(data.total_steps);
          setMainAgentStepCount(data.main_agent_steps);
          setAppFramework(data.framework);
          // Set annotation view as default for Claude Code
          if (data.framework === 'claudecode') {
            setViewMode('annotation');
          }
          setFiles([]);
          setSubAgentDir('');
          onClose();

          // Log sub-agent loading results
          if (data.sub_agents_loaded !== undefined) {
            console.log(`[Upload] Loaded ${data.sub_agents_loaded} sub-agent files`);
          }
          if (data.sub_agents_missing && data.sub_agents_missing.length > 0) {
            console.log(`[Upload] Missing sub-agent files: ${data.sub_agents_missing.join(', ')}`);
          }
        },
      }
    );
  };

  const handleLoadSampleData = async () => {
    try {
      const sampleFiles: File[] = [];

      if (isClaudeCode) {
        // Claude Code: load all files from samples/claudecode/
        const claudeCodeFiles = [
          'ab51623b-c26d-45f5-b98e-f9d0cfa17018.jsonl', // Main session
          'agent-6f2b8f7b.jsonl',
          'agent-773d7508.jsonl',
          'agent-80f146b4.jsonl',
          'agent-9507cef4.jsonl',
        ];

        for (const filename of claudeCodeFiles) {
          const response = await fetch(`/samples/claudecode/${filename}`);
          const text = await response.text();
          const blob = new Blob([text], { type: 'application/x-jsonlines' });
          sampleFiles.push(new File([blob], filename, { type: 'application/x-jsonlines' }));
        }
      } else {
        // AutoGen: load single file from samples/autogen/
        const response = await fetch('/samples/autogen/mock_chat_history.jsonl');
        const text = await response.text();
        const blob = new Blob([text], { type: 'application/x-jsonlines' });
        sampleFiles.push(new File([blob], 'mock_chat_history.jsonl', { type: 'application/x-jsonlines' }));
      }

      // Upload the sample files
      uploadMutation.mutate(
        { files: sampleFiles, framework },
        {
          onSuccess: (data) => {
            setGraphId(data.graph_id);
            setTotalSteps(data.total_steps);
            setMainAgentStepCount(data.main_agent_steps);
            setAppFramework(data.framework);
            // Set annotation view as default for Claude Code
            if (data.framework === 'claudecode') {
              setViewMode('annotation');
            }
            onClose();
          },
        }
      );
    } catch (error) {
      console.error('Failed to load sample data:', error);
    }
  };

  // Sort files: main session first, then agent files
  const sortedFiles = [...files].sort((a, b) => {
    const aIsAgent = a.name.includes('agent-');
    const bIsAgent = b.name.includes('agent-');
    if (aIsAgent && !bIsAgent) return 1;
    if (!aIsAgent && bIsAgent) return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Conversation Log</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Framework Selection - moved to top */}
          <div className="space-y-2">
            <Label htmlFor="framework">Framework</Label>
            <Select value={framework} onValueChange={(value) => {
              setFramework(value);
              setFiles([]); // Clear files when framework changes
            }}>
              <SelectTrigger id="framework">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="autogen">AutoGen</SelectItem>
                <SelectItem value="claudecode">Claude Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="file">
              {isClaudeCode ? 'Select Files (main + sub-agent logs)' : 'Select File'}
            </Label>
            <Input
              id="file"
              type="file"
              accept=".json,.jsonl"
              multiple={isClaudeCode}
              onChange={handleFileChange}
              key={framework} // Reset input when framework changes
            />
            {isClaudeCode && (
              <p className="text-xs text-muted-foreground">
                Select the main session file. Sub-agent files will be auto-loaded
                from the default directory or a custom path below.
              </p>
            )}
          </div>

          {/* Sub-agent Directory (Claude Code only) */}
          {isClaudeCode && (
            <div className="space-y-2">
              <Label htmlFor="subAgentDir">
                Sub-agent Directory <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="subAgentDir"
                type="text"
                placeholder="input the path to the sub-agent files"
                value={subAgentDir}
                onChange={(e) => setSubAgentDir(e.target.value)}
              />
            </div>
          )}

          {/* File List */}
          {sortedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({sortedFiles.length})</Label>
              <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
                {sortedFiles.map((file, index) => {
                  const isAgent = file.name.includes('agent-');
                  const isMain = !isAgent;
                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className={`flex items-center justify-between text-sm p-1.5 rounded ${
                        isMain ? 'bg-blue-50' : 'bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={`h-4 w-4 flex-shrink-0 ${
                          isMain ? 'text-blue-600' : 'text-purple-600'
                        }`} />
                        <span className="truncate">{file.name}</span>
                        {isMain && isClaudeCode && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
                            main
                          </span>
                        )}
                        {isAgent && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex-shrink-0">
                            sub-agent
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeFile(files.indexOf(file))}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <X className="h-3 w-3 text-slate-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploadMutation.isPending}
            className="w-full"
          >
            {uploadMutation.isPending ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Process & Launch
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button
            onClick={handleLoadSampleData}
            disabled={uploadMutation.isPending}
            variant="outline"
            className="w-full"
          >
            <Zap className="mr-2 h-4 w-4" />
            Load Sample Data
          </Button>

          {uploadMutation.isError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              Error: {uploadMutation.error?.message || 'Upload failed'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
