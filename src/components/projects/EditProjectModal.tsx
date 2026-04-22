"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Loader2 } from 'lucide-react';

interface EditProjectModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  store: any;
  project: any;
}

export function EditProjectModal({
  isOpen,
  onOpenChange,
  store,
  project,
}: EditProjectModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#452ED2');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = store.isAdmin;

  useEffect(() => {
    if (project && isOpen) {
      setName(project.name || '');
      setDescription(project.description || '');
      setColor(project.color || '#452ED2');
    }
  }, [project, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Project name is required',
      });
      return;
    }

    if (!project) return;

    setIsSaving(true);
    try {
      await store.updateProject(project.id, {
        name: name.trim(),
        description: description.trim(),
        color,
      });
      toast({
        title: 'Project updated',
        description: 'Changes have been saved successfully.',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to update project',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const presetColors = [
    '#452ED2', // Primary purple
    '#66A9F0', // Light blue
    '#FF7F50', // Coral
    '#22C55E', // Green
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#64748B', // Slate
  ];

  if (!isAdmin || !project) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Project
            </DialogTitle>
            <DialogDescription>
              Make changes to your project settings. Workspace owners and leads can edit or delete projects.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this project"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Project Color</Label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c
                        ? 'ring-2 ring-offset-2 ring-primary scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
}
