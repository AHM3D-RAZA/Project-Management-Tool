import React from 'react';
import { Link, FileText } from 'lucide-react';
import type { Task, WorkspaceMemberWithRole } from '@/lib/types';
import { parseMentions, renderTextWithMentions } from '@/lib/mentions';

/**
 * @mention matching needs a real name to match against — a member with no
 * displayName can't be usefully @mentioned. Narrows out members missing one
 * before handing them to parseMentions/renderTextWithMentions/MentionDropdown,
 * which all require a non-null displayName.
 */
export function withMentionableNames(members: WorkspaceMemberWithRole[]): Array<{ userId: string; displayName: string; avatarUrl?: string | null }> {
  return members.filter((m): m is WorkspaceMemberWithRole & { displayName: string } => !!m.displayName);
}

export const renderCommentBody = (text: string, workspaceMembers: Array<{ userId: string; displayName: string }> = []) => {
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

export const handleKeyDownBullets = (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string, setValue: (v: string) => void) => {
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

export const generateGoogleCalendarUrl = (task: Pick<Task, 'dueDate' | 'title' | 'description'>) => {
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

export const getGoogleUrlInfo = (url: string) => {
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
