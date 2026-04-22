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
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
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
  MessageSquare,
  Send,
  Edit2,
  List,
  ExternalLink,
  Link,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateTaskDescription } from '@/ai/flows/ai-task-description-generation';
import { suggestTaskAttributes } from '@/ai/flows/ai-task-attribute-suggestion';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { GoogleDrivePickerButton } from './GoogleDrivePickerButton';
import { GoogleDocsList } from './GoogleDocsList';
import { DriveFileMetadata, createGoogleFile, pickDriveFile } from '@/lib/google-drive-picker';
import { MentionDropdown } from '@/components/mentions/MentionDropdown';
import { parseMentions, extractMentionedUserIds, getCurrentMentionQuery, replaceMention, renderTextWithMentions } from '@/lib/mentions';
import { notifyMentioned } from '@/lib/notifications';

const renderCommentBody = (text: string, workspaceMembers: Array<{ userId: string; displayName: string }> = []) => {
  if (!text) return null;
  
  const mentions = parseMentions(text, workspaceMembers);
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)/);
    
    if (bulletMatch) {
      currentList.push(<li key={i} className="ml-4 list-disc">{bulletMatch[3]}</li>);
    } else {
      if (currentList.length > 0) {
        result.push(<ul key={`ul-${i}`} className="my-1 space-y-1">{currentList}</ul>);
        currentList = [];
      }
      // Render line with mentions highlighted
      const lineMentions = mentions.filter(m => m.startIndex >= text.indexOf(line) && m.endIndex <= text.indexOf(line) + line.length);
      const segments = renderTextWithMentions(line, lineMentions);
      const lineContent = segments.map((seg, idx) => 
        seg.isMention ? (
          <span
            key={`seg-${idx}`}
            className="bg-primary/10 text-primary font-semibold px-1 rounded cursor-pointer hover:bg-primary/20"
          >
            @{seg.displayName}
          </span>
        ) : (
          <span key={`seg-${idx}`}>{seg.text}</span>
        )
      );
      result.push(<div key={`p-${i}`} className={line.trim() === '' ? 'h-4' : 'min-h-[1.25rem]'}>{lineContent}</div>);
    }
  }
  
  if (currentList.length > 0) {
    result.push(<ul key={`ul-end`} className="my-1 space-y-1">{currentList}</ul>);
  }
  
  return <div className="text-sm">{result}</div>;
};

const handleKeyDownBullets = (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string, setValue: (v: string) => void) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const textBeforeCursor = value.substring(0, start);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    const bulletMatch = currentLine.match(/^(\s*)([-*•])\s+(.*)/);
    
    if (bulletMatch) {
      e.preventDefault();
      if (!bulletMatch[3].trim()) {
        const newValue = value.substring(0, start - currentLine.length) + '\n' + value.substring(start);
        setValue(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = start - currentLine.length + 1; }, 0);
      } else {
        const prefix = bulletMatch[1] + (bulletMatch[2] === '•' ? '•' : '-') + ' ';
        const newValue = value.substring(0, start) + '\n' + prefix + value.substring(start);
        setValue(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = start + prefix.length + 1; }, 0);
      }
    }
  }
};

const generateGoogleCalendarUrl = (task: any) => {
  if (!task.dueDate) return null;

  const dueDate = new Date(task.dueDate);
  const isAllDay = dueDate.getHours() === 0 && dueDate.getMinutes() === 0 && dueDate.getSeconds() === 0;

  let startDate: string;
  let endDate: string;

  if (isAllDay) {
    // All-day event: YYYYMMDD/YYYYMMDD
    const year = dueDate.getFullYear();
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const day = String(dueDate.getDate()).padStart(2, '0');
    startDate = `${year}${month}${day}`;
    endDate = `${year}${month}${day}`;
  } else {
    // Timed event: YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ (1-hour duration)
    const year = dueDate.getFullYear();
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const day = String(dueDate.getDate()).padStart(2, '0');
    const hours = String(dueDate.getHours()).padStart(2, '0');
    const minutes = String(dueDate.getMinutes()).padStart(2, '0');
    const seconds = String(dueDate.getSeconds()).padStart(2, '0');
    startDate = `${year}${month}${day}T${hours}${minutes}${seconds}Z`;

    // Add 1 hour for end time
    const endDateObj = new Date(dueDate.getTime() + 60 * 60 * 1000);
    const endHours = String(endDateObj.getHours()).padStart(2, '0');
    const endMinutes = String(endDateObj.getMinutes()).padStart(2, '0');
    const endSeconds = String(endDateObj.getSeconds()).padStart(2, '0');
    endDate = `${year}${month}${day}T${endHours}${endMinutes}${endSeconds}Z`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title || '',
    details: task.description || ''
  });

  params.append('dates', `${startDate}/${endDate}`);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const getGoogleUrlInfo = (url: string) => {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('docs.google.com')) {
    return { type: 'Google Docs', icon: FileText, color: 'text-blue-600' };
  }
  if (lowerUrl.includes('sheets.google.com')) {
    return { type: 'Google Sheets', icon: FileText, color: 'text-green-600' };
  }
  if (lowerUrl.includes('drive.google.com')) {
    return { type: 'Google Drive', icon: FileText, color: 'text-yellow-600' };
  }
  
  return { type: 'Link', icon: Link, color: 'text-muted-foreground' };
};

function SubtaskRow({ subtask, store, projectMembers, isNew, onRemoveNew }: any) {
  const isAdmin = store.isAdmin;
  const [title, setTitle] = useState(subtask.title || '');
  const [description, setDescription] = useState(subtask.description || '');

  useEffect(() => {
    if (isNew) return;
    const timer = setTimeout(() => {
      let updates: any = {};
      if (title !== subtask.title) updates.title = title;
      if (description !== (subtask.description || '')) updates.description = description;

      if (Object.keys(updates).length > 0) {
        store.updateSubtask(subtask.taskId, subtask.id, updates);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, description, subtask.title, subtask.description, subtask.id, subtask.taskId, store, isNew]);

  const handleSaveNew = () => {
    if (!title.trim()) {
      onRemoveNew();
    } else {
      store.createSubtask(subtask.taskId, subtask.projectId, { title: title.trim(), description: description.trim(), status: 'todo', priority: 'medium' });
      onRemoveNew();
    }
  };

  return (
    <div className="group border rounded-lg p-3 space-y-3 bg-card hover:border-border transition-colors relative">
      <div className="flex items-center gap-3">
        {!isNew && (
          <Checkbox
            checked={subtask.status === 'done'}
            onCheckedChange={(c) => store.updateSubtask(subtask.taskId, subtask.id, { status: c ? 'done' : 'todo' })}
            disabled={!isAdmin}
          />
        )}
        <Input
          className={cn("h-8 flex-1 font-medium bg-transparent border-transparent hover:border-input focus-visible:ring-1", subtask.status === 'done' && !isNew && "line-through text-muted-foreground opacity-70")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Subtask title..."
          onBlur={isNew ? handleSaveNew : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          autoFocus={isNew}
          disabled={!isAdmin && !isNew}
        />
        {!isNew && isAdmin && (
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => {
            if (confirm("Delete subtask?")) store.deleteSubtask(subtask.taskId, subtask.id);
          }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="pl-6 pr-8">
         <Input
            className={cn("h-7 text-xs font-normal bg-transparent border-transparent hover:border-input focus-visible:ring-1 text-muted-foreground", store.isCompletedStatus(subtask.status) && !isNew && "opacity-70")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description... (optional)"
            onBlur={isNew ? handleSaveNew : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            disabled={!isAdmin && !isNew}
          />
      </div>

      {!isNew && (
        <div className="flex flex-wrap gap-2 items-center pl-6">
          <Select value={subtask.status} onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { status: val })} disabled={!isAdmin}>
            <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={subtask.priority} onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { priority: val })} disabled={!isAdmin}>
            <SelectTrigger className={cn("h-6 text-[10px] w-auto border-none",
              subtask.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                subtask.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  subtask.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              type="date"
              className="h-6 text-[10px] pl-6 w-auto border-none bg-muted/50"
              value={subtask.dueDate ? subtask.dueDate.split('T')[0] : ''}
              onChange={(e) => store.updateSubtask(subtask.taskId, subtask.id, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              disabled={!isAdmin}
            />
          </div>

          <Select 
            value={subtask.assigneeUserId || "unassigned"} 
            onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { assigneeUserId: val === "unassigned" ? null : val })} 
            disabled={!isAdmin}
          >
            <SelectTrigger className="h-6 text-[10px] w-auto max-w-[120px] border-none bg-muted/50 truncate flex items-center gap-1.5 px-2">
              {subtask.assigneeUserId ? (
                <div className="flex items-center gap-1 overflow-hidden">
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarImage src={projectMembers.find((m: any) => m.userId === subtask.assigneeUserId)?.avatarUrl} />
                    <AvatarFallback className="text-[8px]">{projectMembers.find((m: any) => m.userId === subtask.assigneeUserId)?.displayName?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{projectMembers.find((m: any) => m.userId === subtask.assigneeUserId)?.displayName?.split(' ')[0]}</span>
                </div>
              ) : (
                <span className="text-muted-foreground mr-2">Unassigned</span>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="text-xs text-muted-foreground">Unassigned</span>
              </SelectItem>
              {projectMembers.map((m: any) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-4 w-4 shrink-0">
                      <AvatarImage src={m.avatarUrl} />
                      <AvatarFallback className="text-[8px]">{m.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{m.displayName}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function SubtasksTabContent({ task, store, projectMembers }: any) {
  const [addingNew, setAddingNew] = useState(false);
  const subtasks = store.allWorkspaceSubtasks?.filter((s: any) => s.taskId === task.id) || [];

  const completedCount = subtasks.filter((s: any) => s.status === 'done').length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm font-medium">
          <span>{totalCount > 0 ? `${completedCount}/${totalCount} completed` : '0 subtasks'}</span>
          {store.isAdmin && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingNew(true)} disabled={addingNew}>
              <Plus className="h-3 w-3 mr-1" /> Add Subtask
            </Button>
          )}
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {totalCount === 0 && !addingNew && (
        <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
          No subtasks yet. Click &apos;+ Add Subtask&apos; to break this task into smaller pieces.
        </div>
      )}

      <div className="space-y-3">
        {subtasks.map((st: any) => (
          <SubtaskRow key={st.id} subtask={st} store={store} projectMembers={projectMembers} />
        ))}
        {addingNew && (
          <SubtaskRow
            isNew
            onRemoveNew={() => setAddingNew(false)}
            subtask={{ taskId: task.id, projectId: task.projectId }}
            store={store}
          />
        )}
      </div>
    </div>
  );
}

export function TaskDetailPanel({
  taskId,
  isOpen,
  onClose,
  store
}: {
  taskId: string,
  isOpen: boolean,
  onClose: () => void,
  store: any
}) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isSuggestingAttrs, setIsSuggestingAttrs] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentDisplayName, setNewAttachmentDisplayName] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [localTitle, setLocalTitle] = useState('');
  const [localDesc, setLocalDesc] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const task = useMemo(() => {
    if (!taskId) return null;
    return store.allWorkspaceTasks?.find((t: any) => t.id === taskId);
  }, [taskId, store.allWorkspaceTasks]);

  useEffect(() => {
    if (task) {
      setLocalTitle(task.title || '');
      setLocalDesc(task.description || '');
    }
  }, [task?.id]); // Only true mount/switch resets the input, letting user edit smoothly

  const taskProject = useMemo(() => {
    if (!task) return null;
    return store.workspaceProjects?.find((p: any) => p.id === task.projectId) || null;
  }, [task, store.workspaceProjects]);

  const eligibleAssignees = useMemo(() => {
    if (!taskProject) return store.workspaceMembers || [];
    const allowed = new Set<string>(taskProject.allowedUserIds || []);
    return (store.workspaceMembers || []).filter((m: any) => {
      const isWorkspaceAdmin = m.role === 'owner' || m.role === 'lead';
      const canSeeProject = isWorkspaceAdmin || allowed.has(m.userId);
      return canSeeProject;
    });
  }, [store.workspaceMembers, taskProject]);

  const commentsQuery = useMemoFirebase(() => {
    if (!db || !task) return null;
    return query(
      collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
  }, [db, task]);

  const { data: commentsData } = useCollection(commentsQuery);
  const comments = useMemo(() => commentsData || [], [commentsData]);

  const attachmentsQuery = useMemoFirebase(() => {
    if (!db || !task) return null;
    return query(
      collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'attachments'),
      orderBy('addedAt', 'desc')
    );
  }, [db, task]);

  const { data: attachmentsData } = useCollection(attachmentsQuery);
  const attachments = useMemo(() => attachmentsData || [], [attachmentsData]);

  if (!task) return null;

  const isAdmin = store.isAdmin;

  const handleUpdate = (field: string, value: any) => {
    if (!isAdmin) return;
    store.updateTask(taskId, { [field]: value });
  };

  const handleAddTag = () => {
    if (newTagValue.trim()) {
      const updatedTags = [...(task.tags || []), newTagValue.trim()];
      handleUpdate('tags', Array.from(new Set(updatedTags)));
    }
    setNewTagValue('');
    setIsAddingTag(false);
  };

  useEffect(() => {
    if (!mounted || !task) return;
    const timer = setTimeout(() => {
      if (localTitle !== task.title) handleUpdate('title', localTitle);
    }, 500);
    return () => clearTimeout(timer);
  }, [localTitle, task?.title]);

  useEffect(() => {
    if (!mounted || !task) return;
    const timer = setTimeout(() => {
      if (localDesc !== (task.description || '')) handleUpdate('description', localDesc);
    }, 500);
    return () => clearTimeout(timer);
  }, [localDesc, task?.description]);

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

  const handleDelete = () => {
    if (!isAdmin) return;
    store.deleteTask(taskId);
    onClose();
  };

  const handlePostComment = () => {
    if (newComment.trim()) {
      const mentions = parseMentions(newComment, eligibleAssignees);
      const mentionedUserIds = extractMentionedUserIds(mentions);
      
      store.addComment(taskId, newComment.trim());
      
      // Send notifications to mentioned users
      mentionedUserIds.forEach(userId => {
        if (userId !== store.currentUser?.id) {
          notifyMentioned(db, userId, { id: store.currentUser?.id || '', name: store.currentUser?.name || 'User' }, {
            id: task.id,
            title: task.title,
            workspaceId: task.workspaceId,
            projectId: task.projectId
          }, newComment.trim().substring(0, 100) + (newComment.length > 100 ? '...' : ''));
        }
      });
      
      setNewComment('');
      setShowMentionDropdown(false);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Check for @ mention trigger
    const textarea = e.target;
    const cursorPosition = textarea.selectionStart;
    const mentionQuery = getCurrentMentionQuery(value, cursorPosition);

    if (mentionQuery) {
      setMentionQuery(mentionQuery.query);
      setMentionStartIndex(mentionQuery.startIndex);
      
      // Calculate dropdown position using the textarea ref
      if (textareaRef.current) {
        const textBeforeCursor = value.slice(0, cursorPosition);
        const lines = textBeforeCursor.split('\n');
        const currentLineIndex = lines.length - 1;
        const currentLineText = lines[currentLineIndex] || '';
        
        // Create a temporary span to measure text width
        const span = document.createElement('span');
        span.style.fontSize = window.getComputedStyle(textareaRef.current).fontSize;
        span.style.fontFamily = window.getComputedStyle(textareaRef.current).fontFamily;
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.style.whiteSpace = 'pre';
        span.textContent = currentLineText;
        document.body.appendChild(span);
        const textWidth = span.offsetWidth;
        document.body.removeChild(span);
        
        // Get line height from computed style
        const computedStyle = window.getComputedStyle(textareaRef.current);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
        
        // Calculate position relative to textarea
        const position = {
          top: (currentLineIndex * lineHeight) + lineHeight + 4,
          left: textWidth,
        };
        setMentionPosition(position);
      }
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleKeyDownBullets(e, newComment, setNewComment);
    
    if (e.key === 'Escape' && showMentionDropdown) {
      e.preventDefault();
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (member: { userId: string; displayName: string }) => {
    const updatedText = replaceMention(newComment, mentionStartIndex, member.displayName);
    setNewComment(updatedText);
    setShowMentionDropdown(false);
    
    // Focus textarea and move cursor after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = mentionStartIndex + member.displayName.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
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
                    {store.allStatuses?.map((status: any) => (
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
                  {eligibleAssignees.map((m: any) => (
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
                          <AvatarImage src={m.avatarUrl} />
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
                        onClick={() => handleUpdate('tags', task.tags.filter((t: string) => t !== tag))}
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

            <div className="space-y-4">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                Attachments
              </Label>
              {isAdmin && !isAddingAttachment && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 border border-dashed rounded-full text-xs"
                    onClick={() => setIsAddingAttachment(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Attachment
                  </Button>
                  <GoogleDrivePickerButton
                    viewType="all"
                    label="Pick from Drive"
                    onFileSelected={(metadata: DriveFileMetadata) => {
                      store.addAttachment(taskId, metadata.url, metadata.name);
                    }}
                  />
                  <GoogleDrivePickerButton
                    viewType="docs"
                    label="Pick Doc"
                    onFileSelected={(metadata: DriveFileMetadata) => {
                      store.addAttachment(taskId, metadata.url, metadata.name);
                    }}
                  />
                  <GoogleDrivePickerButton
                    viewType="sheets"
                    label="Pick Sheet"
                    onFileSelected={(metadata: DriveFileMetadata) => {
                      store.addAttachment(taskId, metadata.url, metadata.name);
                    }}
                  />
                </div>
              )}
              {isAdmin && isAddingAttachment && (
                <div className="space-y-2">
                  <Input
                    placeholder="Attachment URL"
                    className="h-7 text-xs"
                    value={newAttachmentUrl}
                    onChange={e => setNewAttachmentUrl(e.target.value)}
                  />
                  <Input
                    placeholder="Display name (optional)"
                    className="h-7 text-xs"
                    value={newAttachmentDisplayName}
                    onChange={e => setNewAttachmentDisplayName(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => {
                        setIsAddingAttachment(false);
                        setNewAttachmentUrl('');
                        setNewAttachmentDisplayName('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-xs px-2"
                      disabled={!newAttachmentUrl.trim()}
                      onClick={() => {
                        store.addAttachment(taskId, newAttachmentUrl.trim(), newAttachmentDisplayName.trim() || undefined);
                        setNewAttachmentUrl('');
                        setNewAttachmentDisplayName('');
                        setIsAddingAttachment(false);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {attachments.length === 0 && !isAddingAttachment && (
                <div className="text-center py-6 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                  No attachments yet. Click &apos;+ Add Attachment&apos; to link files or resources.
                </div>
              )}

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment: any) => {
                    const urlInfo = getGoogleUrlInfo(attachment.url);
                    const Icon = urlInfo.icon;
                    const author = store.workspaceMembers.find((m: any) => m.userId === attachment.addedBy);

                    return (
                      <div key={attachment.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50 transition-colors group">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-muted", urlInfo.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {attachment.displayName || attachment.url}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="truncate max-w-[150px]">{urlInfo.type}</span>
                            <span>•</span>
                            <span>Added by {author?.displayName?.split(' ')[0] || 'Unknown'}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => window.open(attachment.url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              if (confirm('Remove this attachment?')) {
                                store.removeAttachment(taskId, attachment.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Comments Section */}
            <div className="space-y-6">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Comments ({comments.length})
              </Label>

              <div className="space-y-4">
                {comments.map((comment: any) => {
                  const author = store.workspaceMembers.find((m: any) => m.userId === comment.authorUserId);
                  const isCommentAuthor = store.currentUser?.id === comment.authorUserId;
                  const isEditing = editingCommentId === comment.id;

                  return (
                    <div key={comment.id} className="flex gap-3 group">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={author?.avatarUrl} />
                        <AvatarFallback>{author?.displayName?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{author?.displayName || 'Unknown User'}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {mounted ? new Date(comment.createdAt).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '...'}
                            {comment.isEdited && <span className="italic ml-1">(edited)</span>}
                          </span>
                          {isCommentAuthor && !isEditing && (
                            <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary" onClick={() => { setEditingCommentId(comment.id); setEditingCommentBody(comment.body); }}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm('Delete comment?')) store.deleteComment(task.id, comment.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2 mt-1">
                            <Textarea 
                              value={editingCommentBody} 
                              onChange={e => setEditingCommentBody(e.target.value)} 
                              onKeyDown={e => handleKeyDownBullets(e, editingCommentBody, setEditingCommentBody)}
                              className="min-h-[60px] text-sm" 
                            />
                            <div className="flex justify-between items-center mt-2">
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground gap-1.5" onClick={() => setEditingCommentBody(prev => (prev && !prev.endsWith('\n') ? prev + '\n• ' : prev + '• '))}>
                                <List className="h-3.5 w-3.5" /> <span className="text-xs">Bullet</span>
                              </Button>
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                                <Button size="sm" className="h-6 text-xs px-2" disabled={!editingCommentBody.trim()} onClick={() => { store.updateComment(task.id, comment.id, editingCommentBody); setEditingCommentId(null); }}>Save</Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm bg-muted/40 p-3 rounded-lg border border-transparent hover:border-border transition-colors">
                            {renderCommentBody(comment.body, store.workspaceMembers)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-3 pt-2 relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={store.currentUser?.avatarUrl} />
                  <AvatarFallback>{store.currentUser?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Write a comment... Use @ to mention team members"
                    className="min-h-[80px] text-sm"
                    value={newComment}
                    onChange={handleCommentChange}
                    onKeyDown={handleCommentKeyDown}
                  />
                  <div className="flex justify-between items-center">
                    <Button variant="outline" size="sm" className="h-8 gap-2 text-muted-foreground" onClick={() => setNewComment(prev => (prev && !prev.endsWith('\n') ? prev + '\n• ' : prev + '• '))}>
                      <List className="h-3.5 w-3.5" />
                      Add Bullet
                    </Button>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="gap-2 h-8"
                        onClick={handlePostComment}
                        disabled={!newComment.trim()}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
                {showMentionDropdown && (
                  <MentionDropdown
                    query={mentionQuery}
                    members={eligibleAssignees}
                    onSelect={handleMentionSelect}
                    onClose={() => setShowMentionDropdown(false)}
                    position={mentionPosition}
                  />
                )}
              </div>
            </div>
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