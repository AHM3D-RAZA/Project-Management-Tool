"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HardDrive, Loader2 } from 'lucide-react';
import { pickDriveFile, DriveFileMetadata } from '@/lib/google-drive-picker';

interface GoogleDrivePickerButtonProps {
  onFileSelected: (metadata: DriveFileMetadata) => void;
  viewType: 'docs' | 'sheets' | 'all';
  label?: string;
}

export function GoogleDrivePickerButton({ onFileSelected, viewType, label }: GoogleDrivePickerButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePickFile = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    
    console.log('[GoogleDrivePicker] Button clicked, viewType:', viewType);
    console.log('[GoogleDrivePicker] Client ID:', clientId ? 'SET' : 'NOT SET');
    console.log('[GoogleDrivePicker] API Key:', apiKey ? 'SET' : 'NOT SET');
    
    if (!clientId || !apiKey) {
      console.error('[GoogleDrivePicker] Missing environment variables');
      const missing = [];
      if (!clientId) missing.push('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
      if (!apiKey) missing.push('NEXT_PUBLIC_GOOGLE_API_KEY');
      
      toast({
        variant: 'destructive',
        title: 'Google Drive Picker not configured',
        description: `Please add the following to your environment variables: ${missing.join(', ')}`,
      });
      return;
    }

    setIsLoading(true);
    console.log('[GoogleDrivePicker] Loading state set to true');

    try {
      console.log('[GoogleDrivePicker] Calling pickDriveFile with viewType:', viewType);
      const result = await pickDriveFile(clientId, apiKey, viewType);

      if (result.action === 'picked' && result.metadata) {
        onFileSelected(result.metadata);
        toast({
          title: 'File selected',
          description: `"${result.metadata.name}" has been attached.`,
        });
      } else if (result.action === 'cancelled') {
        // User cancelled - no action needed
      } else if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to select file',
          description: result.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to open Google Drive Picker',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 text-xs gap-2"
      onClick={handlePickFile}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <HardDrive className="h-3 w-3" />
      )}
      {isLoading ? 'Opening Drive...' : (label || 'Pick from Drive')}
    </Button>
  );
}
