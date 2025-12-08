/**
 * PreFlightModal - File Upload Component
 *
 * Allows users to upload log files and select framework
 */

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpload } from '@/hooks/useUpload';
import { useAppContext } from '@/context/AppContext';

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
