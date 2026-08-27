"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface MentionDropdownProps {
  query: string;
  members: Array<{ userId: string; displayName: string; avatarUrl?: string | null }>;
  onSelect: (member: { userId: string; displayName: string }) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export interface MentionDropdownHandle {
  /** Returns true if the key was consumed by the dropdown (caller should stop further handling). */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const MentionDropdown = forwardRef<MentionDropdownHandle, MentionDropdownProps>(function MentionDropdown({
  query,
  members,
  onSelect,
  onClose,
  position,
}, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredMembers = members.filter((member) =>
    member.displayName.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Keyboard focus stays on the caller's <textarea> while the user types
  // (that's how "@query" keeps updating), so this dropdown never receives
  // its own key events directly. The caller forwards them here instead,
  // via the imperative handle below.
  const handleKeyDown = (e: React.KeyboardEvent): boolean => {
    if (filteredMembers.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      return true;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filteredMembers[selectedIndex]) {
        onSelect(filteredMembers[selectedIndex]);
      }
      return true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return true;
    }
    return false;
  };

  useImperativeHandle(ref, () => ({ handleKeyDown }));

  if (filteredMembers.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-64 max-h-64 overflow-y-auto bg-popover border rounded-md shadow-lg"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {filteredMembers.map((member, index) => (
        <button
          key={member.userId}
          type="button"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors',
            index === selectedIndex && 'bg-accent'
          )}
          onClick={() => onSelect(member)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={member.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">
              {member.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 text-left truncate">{member.displayName}</span>
          {index === selectedIndex && <Check className="h-4 w-4 text-muted-foreground" />}
        </button>
      ))}
    </div>
  );
});
