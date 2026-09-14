"use client";

import React, { useMemo, useRef, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Send, Edit2, List, Trash2 } from 'lucide-react';
import { MentionDropdown, type MentionDropdownHandle } from '@/components/mentions/MentionDropdown';
import { parseMentions, extractMentionedUserIds, getCurrentMentionQuery, replaceMention } from '@/lib/mentions';
import type { Comment, Task, WorkspaceMemberWithRole } from '@/lib/types';
import type { NexusStore } from '@/hooks/use-nexus-store';
import { renderCommentBody, handleKeyDownBullets, withMentionableNames } from './task-detail-utils';

export function CommentsSection({ task, store, eligibleAssignees, mounted }: {
  task: Task;
  store: NexusStore;
  eligibleAssignees: WorkspaceMemberWithRole[];
  mounted: boolean;
}) {
  const db = useFirestore();
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<MentionDropdownHandle>(null);

  const commentsQuery = useMemoFirebase(() => {
    if (!db || !task) return null;
    return query(
      collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
  }, [db, task]);

  const { data: commentsData } = useCollection<Comment>(commentsQuery);
  const comments = useMemo(() => commentsData || [], [commentsData]);

  const mentionableAssignees = withMentionableNames(eligibleAssignees);

  const handlePostComment = () => {
    if (newComment.trim()) {
      const mentions = parseMentions(newComment, mentionableAssignees);
      const mentionedUserIds = extractMentionedUserIds(mentions);

      store.addComment(task.id, newComment.trim(), mentionedUserIds);

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
    const mentionQueryResult = getCurrentMentionQuery(value, cursorPosition);

    if (mentionQueryResult) {
      setMentionQuery(mentionQueryResult.query);
      setMentionStartIndex(mentionQueryResult.startIndex);

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
    if (showMentionDropdown && mentionDropdownRef.current?.handleKeyDown(e)) {
      return;
    }

    handleKeyDownBullets(e, newComment, setNewComment);

    if (e.key === 'Escape' && showMentionDropdown) {
      e.preventDefault();
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (member: { userId: string; displayName: string }) => {
    const updatedText = replaceMention(newComment, mentionStartIndex, member.displayName, mentionQuery.length);
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" /> Comments ({comments.length})
        </Label>
        <p className="text-xs text-muted-foreground">
          Discussion on this task specifically. For a general status note not tied to one task, post a Work Update instead.
        </p>
      </div>

      <div className="space-y-4">
        {comments.map((comment) => {
          const author = store.workspaceMembers.find((m) => m.userId === comment.authorUserId);
          const isCommentAuthor = store.currentUser?.id === comment.authorUserId;
          const isEditing = editingCommentId === comment.id;

          return (
            <div key={comment.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8">
                <AvatarImage src={author?.avatarUrl ?? undefined} />
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
                    {renderCommentBody(comment.body, mentionableAssignees)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-3 pt-2 relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={store.currentUser?.avatarUrl ?? undefined} />
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
            ref={mentionDropdownRef}
            query={mentionQuery}
            members={mentionableAssignees}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentionDropdown(false)}
            position={mentionPosition}
          />
        )}
      </div>
    </div>
  );
}
