"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sparkles,
  Calendar,
  Trash2,
  X,
  Loader2,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateTaskDescription } from '@/ai/flows/ai-task-description-generation';
import { suggestTaskAttributes } from '@/ai/flows/ai-task-attribute-suggestion';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { GoogleDocsList } from './GoogleDocsList';
import type { Attachment, Task } from '@/lib/types';
import type { NexusStore } from '@/hooks/use-nexus-store';
import { SubtasksTabContent } from './task-detail/SubtasksTab';
import { AttachmentsSection } from './task-detail/AttachmentsSection';
import { CommentsSection } from './task-detail/CommentsSection';
import { generateGoogleCalendarUrl } from './task-detail/task-detail-utils';

export function TaskDetailPanel({
  taskId,
  isOpen,
  onClose,
  store
}: {
  taskId: string,
  isOpen: boolean,
  onClose: () => void,
  store: NexusStore
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isSuggestingAttrs, setIsSuggestingAttrs] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  const [localTitle, setLocalTitle] = useState('');
  const [localDesc, setLocalDesc] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const task = useMemo(() => {
    if (!taskId) return null;
    return store.allWorkspaceTasks?.find((t) => t.id === taskId);
  }, [taskId, store.allWorkspaceTasks]);

  // Intentionally NOT depending on task.title/task.description here: this
  // effect resets the local (editable) title/desc state, and should only
  // do so when switching to a genuinely different task. If it also reacted
  // to task.title/task.description changing, it would reset the input
  // mid-typing every time the debounced autosave effects below echo a
  // just-saved edit back from Firestore — overwriting whatever the user is
  // currently typing.
  useEffect(() => {
    if (task) {
      setLocalTitle(task.title || '');
      setLocalDesc(task.description || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const taskProject = useMemo(() => {
    if (!task) return null;
    return store.workspaceProjects?.find((p) => p.id === task.projectId) || null;
  }, [task, store.workspaceProjects]);

  const eligibleAssignees = useMemo(() => {
    if (!taskProject) return store.workspaceMembers || [];
    const allowed = new Set<string>(taskProject.allowedUserIds || []);
    return (store.workspaceMembers || []).filter((m) => {
      const isWorkspaceAdmin = m.role === 'owner' || m.role === 'lead';
      const canSeeProject = isWorkspaceAdmin || allowed.has(m.userId);
      return canSeeProject;
    });
  }, [store.workspaceMembers, taskProject]);

  // Shared between the Details tab's attachment list and the Docs tab's
  // GoogleDocsList — fetched once here rather than in AttachmentsSection,
  // so both consumers share a single Firestore listener instead of two.
  const attachmentsQuery = useMemoFirebase(() => {
    if (!db || !task) return null;
    return query(
      collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'attachments'),
      orderBy('addedAt', 'desc')
    );
  }, [db, task]);

  const { data: attachmentsData } = useCollection<Attachment>(attachmentsQuery);
  const attachments = useMemo(() => attachmentsData || [], [attachmentsData]);

  const isAdmin = store.isAdmin;

  const handleUpdate = (field: string, value: unknown) => {
    if (!isAdmin) return;
    store.updateTask(taskId, { [field]: value } as Partial<Task>);
  };

  // These two effects were previously declared AFTER the `if (!task) return
  // null` below, which is a Rules-of-Hooks violation: on any render where
  // `task` is momentarily null/undefined (e.g. while the tasks collection
  // is still loading), the early return skips these hooks entirely, but a
  // later render with `task` populated tries to call them — React would
  // throw "Rendered more hooks than during the previous render." All hooks
  // must run unconditionally on every render, so they're declared here,
  // above the early return, and each guards itself internally instead.
  // Intentionally NOT depending on handleUpdate here (or in the effect
  // below): handleUpdate is a plain function recreated on every render of
  // this component, not a stable useCallback. If it were listed as a
  // dependency, these debounced-autosave effects would restart their
  // 500ms timer on every render — not just when the user actually types —
  // and on a panel that re-renders this often, the save could end up
  // never actually firing. `mounted` and `task` are safe to omit: by the
  // time a user could realistically edit the title (localTitle changing),
  // mounted is already true, and task?.title is already tracked directly.
  useEffect(() => {
    if (!mounted || !task) return;
    const timer = setTimeout(() => {
      if (localTitle !== task.title) handleUpdate('title', localTitle);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTitle, task?.title]);

  useEffect(() => {
    if (!mounted || !task) return;
    const timer = setTimeout(() => {
      if (localDesc !== (task.description || '')) handleUpdate('description', localDesc);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDesc, task?.description]);

  if (!task) return null;

  const handleAddTag = () => {
    if (newTagValue.trim()) {
      const updatedTags = [...(task.tags || []), newTagValue.trim()];
      handleUpdate('tags', Array.from(new Set(updatedTags)));
    }
    setNewTagValue('');
    setIsAddingTag(false);
  };

  const handleGenerateDescription = async () => {
    if (!isAdmin) return;
    setIsGeneratingDesc(true);
    try {
      const result = await generateTaskDescription({ taskTitle: localTitle || task.title });
      setLocalDesc(result.taskDescription);
      handleUpdate('description', result.taskDescription);
      toast({ title: 'AI Description Generated' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleSuggestAttributes = async () => {
    if (!isAdmin) return;
    setIsSuggestingAttrs(true);
    try {
      const result = await suggestTaskAttributes({ title: task.title, description: task.description });
      handleUpdate('priority', result.priority);
      handleUpdate('tags', result.tags);
      toast({ title: 'AI Attributes Suggested' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSuggestingAttrs(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    try {
      await store.deleteTask(taskId);
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete task',
        description: (error instanceof Error ? error.message : null) || 'Please try again.',
      });
    }
  };

  const handleCreateDoc = async () => {
    if (!isAdmin) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    if (!clientId || !apiKey) {
      toast({
        variant: 'destructive',
        title: 'Google Drive not configured',
        description: 'Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY to your environment variables.',
      });
      return;
    }

    try {
      const { getOAuthToken, createGoogleFile, loadGIScript } = await import('@/lib/google-drive-picker');
      await loadGIScript();
      const accessToken = await getOAuthToken(clientId);
      const docName = `${task.title || 'Untitled'} - Doc`;
      const metadata = await createGoogleFile(accessToken, 'document', docName);
      store.addAttachment(taskId, metadata.url, metadata.name);
      toast({
        title: 'Google Doc created',
        description: `"${metadata.name}" has been attached to this task.`,
      });
    } catch (error) {
      console.error('Failed to create Google Doc:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create Google Doc',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const handleCreateSheet = async () => {
    if (!isAdmin) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    if (!clientId || !apiKey) {
      toast({
        variant: 'destructive',
        title: 'Google Drive not configured',
        description: 'Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY to your environment variables.',
      });
      return;
    }

    try {
      const { getOAuthToken, createGoogleFile, loadGIScript } = await import('@/lib/google-drive-picker');
      await loadGIScript();
      const accessToken = await getOAuthToken(clientId);
      const sheetName = `${task.title || 'Untitled'} - Sheet`;
      const metadata = await createGoogleFile(accessToken, 'spreadsheet', sheetName);
      store.addAttachment(taskId, metadata.url, metadata.name);
      toast({
        title: 'Google Sheet created',
        description: `"${metadata.name}" has been attached to this task.`,
      });
    } catch (error) {
      console.error('Failed to create Google Sheet:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create Google Sheet',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4 pb-6 border-b">
          <div className="flex justify-between items-start pt-2">
            <SheetTitle>
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">
                Task Detail
              </Badge>
            </SheetTitle>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Input
            className="text-2xl font-bold border-none px-0 shadow-none focus-visible:ring-0 font-headline"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            disabled={!isAdmin}
          />
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-visible">
          <div className="px-6 border-b">
            <TabsList className="grid w-full max-w-[500px] grid-cols-3 bg-transparent justify-start">
              <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent h-10">Details</TabsTrigger>
              <TabsTrigger value="subtasks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent h-10">Subtasks</TabsTrigger>
              <TabsTrigger value="docs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent h-10">Docs</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="m-0 px-6 focus-visible:outline-none focus-visible:ring-0 space-y-8 py-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Status</Label>
                <Select value={task.status} onValueChange={(val) => handleUpdate('status', val)} disabled={!isAdmin}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {store.allStatuses?.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Priority</Label>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-primary"
                      onClick={handleSuggestAttributes}
                      disabled={isSuggestingAttrs}
                    >
                      {isSuggestingAttrs ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                <Select value={task.priority} onValueChange={(val) => handleUpdate('priority', val)} disabled={!isAdmin}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Due Date</Label>
                  {task.dueDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] gap-1 text-primary"
                      onClick={() => {
                        const url = generateGoogleCalendarUrl(task);
                        if (url) window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Add to Calendar
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-9 h-9"
                    value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                    onChange={(e) => handleUpdate('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Assignees</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {eligibleAssignees.map((m) => (
                    <div key={m.userId} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`task-assignee-${m.userId}`}
                        checked={task.assigneeUserIds?.includes(m.userId) || false}
                        onCheckedChange={(checked) => {
                          const currentAssignees = task.assigneeUserIds || [];
                          if (checked) {
                            handleUpdate('assigneeUserIds', [...currentAssignees, m.userId]);
                          } else {
                            handleUpdate('assigneeUserIds', currentAssignees.filter((id: string) => id !== m.userId));
                          }
                        }}
                        disabled={!isAdmin}
                      />
                      <Label 
                        htmlFor={`task-assignee-${m.userId}`}
                        className="flex items-center gap-2 cursor-pointer flex-1"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatarUrl ?? undefined} />
                          <AvatarFallback>{m.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{m.displayName}</span>
                      </Label>
                    </div>
                  ))}
                </div>
                {(!task.assigneeUserIds || task.assigneeUserIds.length === 0) && (
                  <p className="text-xs text-muted-foreground">No assignees selected</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                  Description
                </Label>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1.5"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDesc}
                  >
                    {isGeneratingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    AI Generate
                  </Button>
                )}
              </div>
              <Textarea
                placeholder="Add details about this task..."
                className="min-h-[120px] leading-relaxed resize-none"
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-4">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {task.tags?.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="gap-1 px-2 py-1">
                    {tag}
                    {isAdmin && (
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleUpdate('tags', (task.tags || []).filter((t: string) => t !== tag))}
                      />
                    )}
                  </Badge>
                ))}
                {isAdmin && !isAddingTag && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 border border-dashed rounded-full text-xs"
                    onClick={() => setIsAddingTag(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Tag
                  </Button>
                )}
                {isAdmin && isAddingTag && (
                  <Input
                    autoFocus
                    className="h-7 text-xs w-24 px-2 py-0 border-dashed rounded-full"
                    placeholder="New tag..."
                    value={newTagValue}
                    onChange={e => setNewTagValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTag();
                      if (e.key === 'Escape') {
                        setIsAddingTag(false);
                        setNewTagValue('');
                      }
                    }}
                    onBlur={() => {
                      if (newTagValue.trim()) {
                        handleAddTag();
                      } else {
                        setIsAddingTag(false);
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {(store.customFieldDefinitions || []).length > 0 && (
              <div className="space-y-4">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                  Custom Fields
                </Label>
                <div className="space-y-3">
                  {store.customFieldDefinitions.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label htmlFor={`custom-field-${field.id}`} className="text-xs text-muted-foreground">
                        {field.name}
                      </Label>
                      <Input
                        id={`custom-field-${field.id}`}
                        className="h-8 text-sm"
                        defaultValue={task.customFields?.[field.id] || ''}
                        disabled={!isAdmin}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value !== (task.customFields?.[field.id] || '')) {
                            handleUpdate('customFields', { ...(task.customFields || {}), [field.id]: value });
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AttachmentsSection taskId={taskId} store={store} isAdmin={isAdmin} attachments={attachments} />

            <Separator />

            <CommentsSection task={task} store={store} eligibleAssignees={eligibleAssignees} mounted={mounted} />
          </TabsContent>

          <TabsContent value="subtasks" className="m-0 px-6 focus-visible:outline-none focus-visible:ring-0">
            <SubtasksTabContent task={task} store={store} projectMembers={eligibleAssignees} />
          </TabsContent>

          <TabsContent value="docs" className="m-0 px-6 focus-visible:outline-none focus-visible:ring-0 space-y-6 py-6">
            <GoogleDocsList
              attachments={attachments}
              canCreate={isAdmin}
              onCreateDoc={handleCreateDoc}
              onCreateSheet={handleCreateSheet}
              canEdit={isAdmin}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
