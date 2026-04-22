"use client";

import React, { useState, useEffect, useRef } from 'react';
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

export function MentionDropdown({
  query,
  members,
  onSelect,
  onClose,
  position,
}: MentionDropdownProps) {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMembers[selectedIndex]) {
        onSelect(filteredMembers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

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
      onKeyDown={handleKeyDown}
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
            <AvatarImage src={member.avatarUrl} />
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
}
