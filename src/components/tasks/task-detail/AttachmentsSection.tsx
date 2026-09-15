"use client";

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Plus, ExternalLink, Trash2, Upload } from 'lucide-react';
import { GoogleDrivePickerButton } from '../GoogleDrivePickerButton';
import type { DriveFileMetadata } from '@/lib/google-drive-picker';
import { useStorage } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { FileTooLargeError, uploadTaskAttachment } from '@/lib/file-upload';
import type { Attachment } from '@/lib/types';
import type { NexusStore } from '@/hooks/use-nexus-store';
import { getGoogleUrlInfo } from './task-detail-utils';

export function AttachmentsSection({ taskId, workspaceId, store, isAdmin, attachments }: {
  taskId: string;
  workspaceId: string;
  store: NexusStore;
  isAdmin: boolean;
  attachments: Attachment[];
}) {
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentDisplayName, setNewAttachmentDisplayName] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storage = useStorage();
  const { toast } = useToast();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setUploadProgress(0);
    try {
      const { url, name } = await uploadTaskAttachment(storage, workspaceId, taskId, file, setUploadProgress);
      await store.addAttachment(taskId, url, name);
      toast({ title: 'File uploaded', description: name });
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload failed",
        description: error instanceof FileTooLargeError ? error.message : "That file couldn't be uploaded.",
        variant: 'destructive',
      });
    } finally {
      setUploadProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
        Attachments
      </Label>
      {isAdmin && !isAddingAttachment && (
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 border border-dashed rounded-full text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            <Upload className="h-3 w-3 mr-1" /> Upload File
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 border border-dashed rounded-full text-xs"
            onClick={() => setIsAddingAttachment(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Attachment
          </Button>
          <GoogleDrivePickerButton
            viewType="all"
            label="Pick from Drive"
            onFileSelected={(metadata: DriveFileMetadata) => {
              store.addAttachment(taskId, metadata.url, metadata.name);
            }}
          />
          <GoogleDrivePickerButton
            viewType="docs"
            label="Pick Doc"
            onFileSelected={(metadata: DriveFileMetadata) => {
              store.addAttachment(taskId, metadata.url, metadata.name);
            }}
          />
          <GoogleDrivePickerButton
            viewType="sheets"
            label="Pick Sheet"
            onFileSelected={(metadata: DriveFileMetadata) => {
              store.addAttachment(taskId, metadata.url, metadata.name);
            }}
          />
        </div>
      )}
      {uploadProgress !== null && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-1.5" />
          <span className="text-[10px] text-muted-foreground">Uploading… {Math.round(uploadProgress)}%</span>
        </div>
      )}
      {isAdmin && isAddingAttachment && (
        <div className="space-y-2">
          <Input
            placeholder="Attachment URL"
            className="h-7 text-xs"
            value={newAttachmentUrl}
            onChange={e => setNewAttachmentUrl(e.target.value)}
          />
          <Input
            placeholder="Display name (optional)"
            className="h-7 text-xs"
            value={newAttachmentDisplayName}
            onChange={e => setNewAttachmentDisplayName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={() => {
                setIsAddingAttachment(false);
                setNewAttachmentUrl('');
                setNewAttachmentDisplayName('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 text-xs px-2"
              disabled={!newAttachmentUrl.trim()}
              onClick={() => {
                store.addAttachment(taskId, newAttachmentUrl.trim(), newAttachmentDisplayName.trim() || undefined);
                setNewAttachmentUrl('');
                setNewAttachmentDisplayName('');
                setIsAddingAttachment(false);
              }}
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {attachments.length === 0 && !isAddingAttachment && (
        <div className="text-center py-6 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          No attachments yet. Click &apos;+ Add Attachment&apos; to link files or resources.
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const urlInfo = getGoogleUrlInfo(attachment.url);
            const Icon = urlInfo.icon;
            const author = store.workspaceMembers.find((m) => m.userId === attachment.addedBy);

            return (
              <div key={attachment.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50 transition-colors group">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-muted", urlInfo.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {attachment.displayName || attachment.url}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[150px]">{urlInfo.type}</span>
                    <span>•</span>
                    <span>Added by {author?.displayName?.split(' ')[0] || 'Unknown'}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => window.open(attachment.url, '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      if (confirm('Remove this attachment?')) {
                        store.removeAttachment(taskId, attachment.id, attachment.url);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
