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

interface DeleteProjectButtonProps {
  store: any;
  project: any;
  onDeleted?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function DeleteProjectButton({
  store,
  project,
  onDeleted,
  variant = 'destructive',
  size = 'sm',
  className = '',
}: DeleteProjectButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const isAdmin = store.isAdmin;

  if (!isAdmin || !project) {
    return null;
  }

  const handleDelete = async () => {
    if (confirmText !== project.name) {
      toast({
        variant: 'destructive',
        title: 'Confirmation failed',
        description: 'Project name does not match.',
      });
      return;
    }

    setIsDeleting(true);
    const projectId = project.id;

    // Close dialog and navigate immediately
    setIsOpen(false);
    onDeleted?.();

    try {
      await store.deleteProject(projectId);
      toast({
        title: 'Project deleted',
        description: 'The project and all its tasks have been removed.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete project',
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
      >
        <Trash2 className="h-4 w-4" />
        Delete Project
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="sm:max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This action <strong>cannot be undone</strong>. This will permanently delete the
                project <strong>&quot;{project?.name}&quot;</strong> and all its tasks, subtasks, and
                comments.
              </span>
              <span className="block font-medium">Type the project name to confirm:</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={project?.name}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmText !== project?.name || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
