"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const PRESET_COLORS = [
  'bg-slate-200',
  'bg-blue-100',
  'bg-blue-200',
  'bg-indigo-100',
  'bg-indigo-200',
  'bg-purple-100',
  'bg-purple-200',
  'bg-pink-100',
  'bg-pink-200',
  'bg-red-100',
  'bg-red-200',
  'bg-orange-100',
  'bg-orange-200',
  'bg-amber-100',
  'bg-amber-200',
  'bg-yellow-100',
  'bg-yellow-200',
  'bg-lime-100',
  'bg-lime-200',
  'bg-green-100',
  'bg-green-200',
  'bg-emerald-100',
  'bg-emerald-200',
  'bg-teal-100',
  'bg-teal-200',
  'bg-cyan-100',
  'bg-cyan-200',
  'bg-sky-100',
  'bg-sky-200',
  'bg-gray-100',
  'bg-gray-200',
  'bg-zinc-100',
  'bg-zinc-200',
  'bg-neutral-100',
  'bg-neutral-200',
  'bg-stone-100',
  'bg-stone-200',
];

interface AddStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStatus: (name: string, color: string) => Promise<void>;
  existingStatuses: { name: string }[];
}

export function AddStatusModal({ open, onOpenChange, onAddStatus, existingStatuses }: AddStatusModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('bg-blue-100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Status name is required',
      });
      return;
    }

    // Check for duplicate names (case-insensitive)
    const normalizedName = name.trim().toLowerCase();
    const existingNames = existingStatuses.map(s => s.name.toLowerCase());
    if (existingNames.includes(normalizedName)) {
      toast({
        variant: 'destructive',
        title: 'A status with this name already exists',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddStatus(name.trim(), selectedColor);
      setName('');
      setSelectedColor('bg-blue-100');
      onOpenChange(false);
      toast({
        title: 'Status added successfully',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to add status',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setSelectedColor('bg-blue-100');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Status</DialogTitle>
          <DialogDescription>
            Create a new status column for your workspace. This will be available in all projects.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-name">Status Name</Label>
            <Input
              id="status-name"
              placeholder="e.g., In Review, Blocked, Testing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`
                    h-8 w-8 rounded-full border-2 transition-all
                    ${selectedColor === color ? 'border-primary scale-110' : 'border-transparent hover:border-muted-foreground'}
                  `}
                >
                  <div className={`h-full w-full rounded-full ${color}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <div className={`h-4 w-4 rounded-full ${selectedColor}`} />
            <span className="text-sm text-muted-foreground">
              Preview: {name || 'Status Name'}
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Adding...' : 'Add Status'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
