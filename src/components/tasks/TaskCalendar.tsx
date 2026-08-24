"use client";

import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { DayProps } from 'react-day-picker';
import type { WorkspaceMemberWithRole, CurrentUser } from '@/lib/types';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
}

interface TaskCalendarProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  workspaceMembers: WorkspaceMemberWithRole[];
  currentUser: CurrentUser | null;
}

export function TaskCalendar({ tasks, onTaskClick }: TaskCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Group tasks by due date (normalized to YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    
    tasks.forEach(task => {
      if (!task.dueDate) return;
      
      try {
        const date = parseISO(task.dueDate);
        const dateKey = format(date, 'yyyy-MM-dd');
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      } catch (e) {
        console.error('Failed to parse due date:', task.dueDate, e);
      }
    });
    
    return grouped;
  }, [tasks]);

  // Get priority color
  const getPriorityColor = (priority: string) => {
    const priorityLower = priority.toLowerCase();
    if (priorityLower === 'urgent') return 'bg-red-500';
    if (priorityLower === 'high') return 'bg-orange-500';
    if (priorityLower === 'low') return 'bg-blue-400';
    return 'bg-gray-400';
  };

  // Custom day cell component
  const DayCell = (props: DayProps) => {
    const date = props.day?.date;
    
    // Handle invalid dates (outside month, null, etc.)
    if (!date || isNaN(date.getTime())) {
      return <td {...props} className={cn("h-24 w-9 p-1 text-muted-foreground/30", props.className)} />;
    }

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayTasks = tasksByDate[dateKey] || [];
    const maxVisible = 3;
    const visibleTasks = dayTasks.slice(0, maxVisible);
    const remainingCount = dayTasks.length - maxVisible;

    return (
      <td
        {...props}
        className={cn(
          "relative h-32 w-16 p-2 hover:bg-muted/50 transition-colors align-top border-r border-b",
          props.className
        )}
      >
        <div className="text-sm font-bold mb-2 text-muted-foreground">{format(date, 'd')}</div>
        
        <div className="space-y-1.5 overflow-hidden">
          {visibleTasks.map(task => (
            <div
              key={task.id}
              className="text-xs bg-background border rounded px-2 py-1 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors group shadow-sm"
              onClick={() => onTaskClick(task.id)}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className={cn("w-1.5 h-1.5 rounded-full shrink-0", getPriorityColor(task.priority))}
                />
                <span className="truncate flex-1 font-medium">{task.title}</span>
              </div>
            </div>
          ))}
          
          {remainingCount > 0 && (
            <div className="text-xs text-muted-foreground font-medium pl-3">
              +{remainingCount} more
            </div>
          )}
        </div>
      </td>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <Calendar
        mode="single"
        selected={selectedMonth}
        onSelect={(date) => date && setSelectedMonth(date)}
        month={selectedMonth}
        onMonthChange={setSelectedMonth}
        className="rounded-md border flex-1"
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 flex-1",
          month: "space-y-4 flex-1",
          table: "w-full border-collapse space-y-1 flex-1 table-fixed",
          head_row: "",
          head_cell: "text-muted-foreground rounded-md w-16 font-normal text-[0.8rem] p-2",
          row: "",
          cell: "h-32 w-16 text-center text-sm p-0 relative align-top [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: "h-9 w-16 p-0 font-normal aria-selected:opacity-100",
        }}
        components={{
          Day: DayCell,
        }}
      />
    </div>
  );
}
