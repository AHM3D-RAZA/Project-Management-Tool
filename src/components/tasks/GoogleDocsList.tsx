"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Table, ExternalLink, Plus, Loader2 } from 'lucide-react';
import { GoogleDocsViewer } from './GoogleDocsViewer';

interface Attachment {
  id: string;
  url: string;
  displayName?: string | null;
  addedBy: string;
  addedAt: string;
}

interface GoogleDocsListProps {
  attachments: Attachment[];
  canCreate: boolean;
  onCreateDoc: () => void;
  onCreateSheet: () => void;
  canEdit: boolean;
}

export function GoogleDocsList({
  attachments,
  canCreate,
  onCreateDoc,
  onCreateSheet,
  canEdit,
}: GoogleDocsListProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Filter attachments to show only Google Docs and Sheets
  const googleDocsAttachments = attachments.filter((attachment) => {
    const url = attachment.url.toLowerCase();
    return url.includes('docs.google.com/document') || url.includes('docs.google.com/spreadsheets');
  });

  const getFileType = (url: string) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('docs.google.com/document')) {
      return { type: 'Google Doc', icon: FileText, color: 'text-blue-600' };
    }
    if (lowerUrl.includes('docs.google.com/spreadsheets')) {
      return { type: 'Google Sheet', icon: Table, color: 'text-green-600' };
    }
    return { type: 'Link', icon: ExternalLink, color: 'text-muted-foreground' };
  };

  const handleCreateDoc = async () => {
    setIsCreating(true);
    try {
      await onCreateDoc();
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateSheet = async () => {
    setIsCreating(true);
    try {
      await onCreateSheet();
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedUrl) {
    return <GoogleDocsViewer url={selectedUrl} onClose={() => setSelectedUrl(null)} />;
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-2"
            onClick={handleCreateDoc}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Create Doc
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-2"
            onClick={handleCreateSheet}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Create Sheet
          </Button>
        </div>
      )}

      {googleDocsAttachments.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          No Google Docs or Sheets attached yet.
          {canCreate && ' Click "Create Doc" or "Create Sheet" to get started.'}
        </div>
      )}

      {googleDocsAttachments.length > 0 && (
        <div className="space-y-2">
          {googleDocsAttachments.map((attachment) => {
            const urlInfo = getFileType(attachment.url);
            const Icon = urlInfo.icon;

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                onClick={() => setSelectedUrl(attachment.url)}
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-muted ${urlInfo.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {attachment.displayName || attachment.url}
                  </div>
                  <div className="text-xs text-muted-foreground">{urlInfo.type}</div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(attachment.url, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
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
