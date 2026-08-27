"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface WorkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updateText: string) => Promise<void>;
}

export function WorkUpdateModal({ isOpen, onClose, onSave }: WorkUpdateModalProps) {
  const [updateText, setUpdateText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUpdateText('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!updateText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(updateText.trim());
      setUpdateText('');
      onClose();
    } catch (error) {
      console.error('Failed to save work update:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Work Update</DialogTitle>
          <DialogDescription>
            A general status note for the day, not tied to a specific task — for updates on
            individual tasks, use that task&apos;s comments instead.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="work-update">Your Update</Label>
            <Textarea
              id="work-update"
              placeholder="What are you working on?"
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Skip
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting || !updateText.trim()}>
            {isSubmitting ? 'Saving...' : 'Save Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
