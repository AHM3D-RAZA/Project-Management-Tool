"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OverdueTasksCardProps {
  tasks: any[];
  workspaceProjects: any[];
  onTaskClick: (taskId: string) => void;
  onNavigateToProject: (projectId: string) => void;
}

export function OverdueTasksCard({
  tasks,
  workspaceProjects,
  onTaskClick,
  onNavigateToProject,
}: OverdueTasksCardProps) {
  const getDaysOverdue = (dueDate: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDate);
    const diffTime = startOfDay.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card className="shadow-sm border-none border-l-4 border-l-destructive">
      <CardHeader className="flex items-center justify-between flex-row pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Overdue Tasks
        </CardTitle>
        <Badge variant="destructive" className="text-xs">
          {tasks.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>No overdue tasks</p>
            <p className="text-xs mt-1">Great job staying on track!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any) => {
              const daysOverdue = getDaysOverdue(task.dueDate);
              const project = workspaceProjects.find((p: any) => p.id === task.projectId);
              
              return (
                <div
                  key={task.id}
                  className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors cursor-pointer group"
                  onClick={() => onTaskClick(task.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-destructive transition-colors truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {project?.name || 'Unknown Project'}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <Badge 
                          variant="secondary" 
                          className="text-[10px] uppercase font-bold py-0 h-4"
                        >
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1 text-destructive">
                        <Calendar className="h-3 w-3" />
                        <span className="text-xs font-medium">
                          {daysOverdue === 1 ? '1 day' : `${daysOverdue} days`}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
