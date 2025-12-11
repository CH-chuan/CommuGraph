'use client';

/**
 * PreFlightModal - File Upload Component
 *
 * Allows users to upload log files and select framework
 */

import { useState } from 'react';
import { Upload, Zap } from 'lucide-react';
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
  const [file, setFile] = useState<File | null>(null);
  const [framework, setFramework] = useState('autogen');
  const { setGraphId, setTotalSteps } = useAppContext();
  const uploadMutation = useUpload();

  const handleUpload = async () => {
    if (!file) return;

    uploadMutation.mutate(
      { file, framework },
      {
        onSuccess: (data) => {
          setGraphId(data.graph_id);
          setTotalSteps(data.total_steps);
          onClose();
        },
      }
    );
  };

  const handleLoadSampleData = async () => {
    try {
      // Fetch the mock data from public folder
      const response = await fetch('/mock_chat_history.jsonl');
      const text = await response.text();

      // Convert to File object
      const blob = new Blob([text], { type: 'application/x-jsonlines' });
      const mockFile = new File([blob], 'mock_chat_history.jsonl', {
        type: 'application/x-jsonlines',
      });

      // Upload the mock file
      uploadMutation.mutate(
        { file: mockFile, framework: 'autogen' },
        {
          onSuccess: (data) => {
            setGraphId(data.graph_id);
            setTotalSteps(data.total_steps);
            onClose();
          },
        }
      );
    } catch (error) {
      console.error('Failed to load sample data:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Conversation Log</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              accept=".json,.jsonl"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="framework">Framework</Label>
            <Select value={framework} onValueChange={setFramework}>
              <SelectTrigger id="framework">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="autogen">AutoGen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
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
            Load Sample Data (34 messages)
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
