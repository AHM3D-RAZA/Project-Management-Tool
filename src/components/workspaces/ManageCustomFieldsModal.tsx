"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CustomFieldDefinition } from '@/lib/types';

interface ManageCustomFieldsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: CustomFieldDefinition[];
  onAddField: (name: string) => Promise<string>;
  onDeleteField: (id: string) => Promise<void>;
}

export function ManageCustomFieldsModal({
  open,
  onOpenChange,
  fields,
  onAddField,
  onDeleteField,
}: ManageCustomFieldsModalProps) {
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Field name is required' });
      return;
    }
    setIsAdding(true);
    try {
      await onAddField(name.trim());
      setName('');
      toast({ title: 'Custom field added' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to add field',
        description: (error instanceof Error ? error.message : null) || 'Please try again.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (field: CustomFieldDefinition) => {
    setDeletingId(field.id);
    try {
      await onDeleteField(field.id);
      toast({ title: `Removed "${field.name}"` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove field',
        description: (error instanceof Error ? error.message : null) || 'Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Custom Fields</DialogTitle>
          <DialogDescription>
            Extra fields your team can fill in on any task — e.g. Client Name, Budget Code, Ticket #.
            Available across every project in this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No custom fields yet.</p>
          )}
          {fields.map((field) => (
            <div key={field.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">{field.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(field)}
                disabled={deletingId === field.id}
              >
                {deletingId === field.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex items-end gap-2 pt-2 border-t">
          <div className="flex-1 space-y-2">
            <Label htmlFor="custom-field-name">Add a field</Label>
            <Input
              id="custom-field-name"
              placeholder="e.g. Client Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isAdding}
            />
          </div>
          <Button type="submit" disabled={isAdding || !name.trim()} className="gap-1">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
