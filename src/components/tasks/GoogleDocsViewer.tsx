"use client";

import React from 'react';

interface GoogleDocsViewerProps {
  url: string;
  onClose: () => void;
}

export function GoogleDocsViewer({ url, onClose }: GoogleDocsViewerProps) {
  // Extract file ID from Google Docs/Sheets URL
  const getFileId = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const getFileType = (url: string) => {
    if (url.includes('docs.google.com/document')) return 'document';
    if (url.includes('docs.google.com/spreadsheets')) return 'spreadsheet';
    return 'document';
  };

  const fileId = getFileId(url);
  const fileType = getFileType(url);

  if (!fileId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Invalid Google Docs/Sheets URL
      </div>
    );
  }

  // Construct preview URL for read-only embed
  const previewUrl = fileType === 'document'
    ? `https://docs.google.com/document/d/${fileId}/preview`
    : `https://docs.google.com/spreadsheets/d/${fileId}/preview`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-sm font-medium">Document Preview</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="flex-1">
        <iframe
          src={previewUrl}
          className="w-full h-full border-0"
          title="Google Docs Preview"
        />
      </div>
    </div>
  );
}
