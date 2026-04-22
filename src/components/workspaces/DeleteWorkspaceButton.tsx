"use client";

import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteWorkspaceButtonProps {
  store: any;
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

    try {
      await store.deleteWorkspace(workspaceId);
      toast({
        title: 'Workspace deleted',
        description: 'The workspace and all its data have been removed.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete workspace',
        description: error.message || 'Please try again.',
      });
    } finally {
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
