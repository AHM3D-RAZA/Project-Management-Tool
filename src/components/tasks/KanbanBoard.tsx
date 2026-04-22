"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Task, Priority } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const defaultColumns: { id: string, name: string, color: string }[] = [
  { id: 'todo', name: 'To Do', color: 'bg-slate-200' },
  { id: 'in_progress', name: 'In Progress', color: 'bg-accent/20' },
  { id: 'on_hold', name: 'On Hold', color: 'bg-amber-100' },
  { id: 'done', name: 'Done', color: 'bg-green-100' },
];

const priorityBorder: Record<Priority, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

export function KanbanBoard({ 
  tasks, 
  onTaskClick, 
  updateTask,
  onAddTask,
  readOnly = false,
  subtasks = [],
  workspaceMembers = [],
  currentUser = null,
  columns = []
}: { 
  tasks: Task[], 
  onTaskClick: (id: string) => void,
  updateTask: (id: string, data: Partial<Task>) => void,
  onAddTask?: (status: string) => void,
  readOnly?: boolean,
  subtasks?: any[],
  workspaceMembers?: any[],
  currentUser?: any,
  columns?: { id: string, name: string, color: string }[]
}) {
  const [mounted, setMounted] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (containerRef.current && containerRef.current.parentElement) {
      setMaxWidth(containerRef.current.parentElement.clientWidth);
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (readOnly) return;
    setDraggedTaskId(id);
    e.dataTransfer.setData('text', id);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.target as HTMLElement;
    target.style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    setActiveColumn(null);
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeColumn !== status) {
      setActiveColumn(status);
    }
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    if (readOnly) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text');
    if (taskId) {
      updateTask(taskId, { status });
    }
    setDraggedTaskId(null);
    setActiveColumn(null);
  };

  const usedColumns = columns.length > 0 ? columns : defaultColumns;

  return (
    <div 
      ref={containerRef}
      className="flex flex-row gap-6 h-full overflow-x-auto overflow-y-hidden pb-4"
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : '100%' }}
    >
      {usedColumns.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        
        return (
          <div 
            key={col.id} 
            className="flex flex-col gap-4 min-w-[280px] flex-shrink-0"
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragEnter={(e) => { e.preventDefault(); if(!readOnly) setActiveColumn(col.id); }}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", col.color)} />
                  {col.name}
                </h3>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{columnTasks.length}</Badge>
              </div>
              {!readOnly && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => onAddTask?.(col.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className={cn(
              "flex-1 space-y-3 bg-muted/20 p-3 rounded-xl min-h-[500px] transition-all duration-200 border-2 border-transparent",
              !readOnly && activeColumn === col.id && "bg-muted/50 border-primary/20 scale-[1.01] shadow-inner",
              !readOnly && draggedTaskId && activeColumn !== col.id && "opacity-80"
            )}>
              {columnTasks.map(task => (
                <Card 
                  key={task.id} 
                  draggable={!readOnly}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-none border-l-4 shadow-sm bg-card",
                    priorityBorder[task.priority],
                    draggedTaskId === task.id && "opacity-0",
                    readOnly && "cursor-pointer"
                  )}
                  onClick={() => onTaskClick(task.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className={cn(
                        "text-sm font-semibold leading-tight",
                        task.status === 'done' && "text-muted-foreground line-through"
                      )}>
                        {task.title}
                      </span>
                    </div>
                    
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const st = (subtasks || []).filter(s => s.taskId === task.id);
                      if (st.length === 0) return null;
                      const done = st.filter(s => s.status === 'done').length;
                      return (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium pt-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{done}/{st.length} subtasks</span>
                          <Progress value={(done/st.length)*100} className="h-1 w-12 ml-1" />
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                        {mounted && task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <div className="flex -space-x-2">
                        {(task.assigneeUserIds || []).slice(0, 3).map((assigneeId: string, idx: number) => {
                          const isCurrentUser = assigneeId === currentUser?.id;
                          const member = workspaceMembers.find((m: any) => m.userId === assigneeId);
                          const isOwner = member?.role === 'owner';
                          let displayName = '';
                          let initials = '';
                          
                          if (isCurrentUser) {
                            displayName = 'You';
                            initials = 'Y';
                          } else {
                            displayName = member?.displayName || member?.email || assigneeId;
                            initials = displayName.charAt(0).toUpperCase();
                          }
                          
                          return (
                            <div key={assigneeId} className="w-5 h-5 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                              <span className={cn("text-[8px] font-medium", 
                                isCurrentUser ? "text-green-600" : isOwner ? "text-green-600" : "text-foreground"
                              )}>{initials}</span>
                            </div>
                          );
                        })}
                        {(task.assigneeUserIds || []).length > 3 && (
                          <div className="w-5 h-5 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                            <span className="text-[8px] text-muted-foreground">+{(task.assigneeUserIds || []).length - 3}</span>
                          </div>
                        )}
                        {(!task.assigneeUserIds || task.assigneeUserIds.length === 0) && (
                          <div className="w-5 h-5 rounded-full bg-primary/10 border-2 border-background" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}