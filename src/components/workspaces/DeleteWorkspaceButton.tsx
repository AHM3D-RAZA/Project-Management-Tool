"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast, toast as toastFn } from '@/hooks/use-toast';
import { Trash2, Loader2 } from 'lucide-react';
import type { NexusStore } from '@/hooks/use-nexus-store';

interface DeleteWorkspaceButtonProps {
  store: NexusStore;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function DeleteWorkspaceButton({
  store,
  variant = 'destructive',
  size = 'sm',
  className = '',
}: DeleteWorkspaceButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const workspace = store.activeWorkspace;
  const isOwner = store.isOwner;
  const progressToastRef = useRef<ReturnType<typeof toastFn> | null>(null);

  // Stream live progress from the store into the toast as the cascade
  // delete runs — items removed so far, updated continuously rather than
  // leaving the admin staring at "Starting…" for however long a large
  // workspace takes.
  useEffect(() => {
    const progress = store.deletionProgress;
    if (!progress || progress.type !== 'workspace' || !progressToastRef.current) return;
    progressToastRef.current.update({
      id: progressToastRef.current.id,
      title: 'Deleting workspace…',
      description: `Removed ${progress.count.toLocaleString()} items so far from "${progress.label}"…`,
    });
  }, [store.deletionProgress]);

  if (!isOwner || !workspace) {
    return null;
  }

  const handleDelete = async () => {
    if (confirmText !== workspace.name) {
      toast({
        variant: 'destructive',
        title: 'Confirmation failed',
        description: 'Workspace name does not match.',
      });
      return;
    }

    setIsDeleting(true);
    const workspaceId = workspace.id;

    // Close dialog immediately
    setIsOpen(false);

    const progressToast = toast({
      title: 'Deleting workspace…',
      description: 'This can take a while for a large workspace. Starting…',
    });
    progressToastRef.current = progressToast;

    try {
      await store.deleteWorkspace(workspaceId);
      progressToast.update({
        id: progressToast.id,
        title: 'Workspace deleted',
        description: 'The workspace and all its data have been removed.',
      });
    } catch (error) {
      progressToast.update({
        id: progressToast.id,
        variant: 'destructive',
        title: 'Failed to delete workspace',
        description: ((error instanceof Error ? error.message : null) || 'Please try again.') + ' You can safely retry — nothing already deleted will be duplicated.',
      });
    } finally {
      progressToastRef.current = null;
      setIsDeleting(false);
      setConfirmText('');
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setConfirmText('');
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={`gap-2 ${className}`}
        title="Delete workspace"
      >
        <Trash2 className="h-4 w-4" />
        {size !== 'icon' && 'Delete Workspace'}
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="sm:max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Workspace
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This action <strong>cannot be undone</strong>. This will permanently delete the
                workspace <strong>&quot;{workspace?.name}&quot;</strong> and all its projects, tasks,
                subtasks, comments, and member data.
              </span>
              <span className="block font-medium">Type the workspace name to confirm:</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspace?.name}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmText !== workspace?.name || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
