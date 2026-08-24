"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingDown, 
  Flame, 
  CheckCircle2, 
  Clock, 
  Target,
  Calendar,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, CurrentUser } from '@/lib/types';

interface UserProgressStatusCardProps {
  tasks: Task[];
  currentUser: CurrentUser | null;
}

type TimePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type StatusLevel = 'below_average' | 'average' | 'above_average' | 'above_and_beyond';

export function UserProgressStatusCard({ tasks, currentUser }: UserProgressStatusCardProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly');

  // Filter tasks based on time period
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    
    switch (timePeriod) {
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'quarterly':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'yearly':
        startDate.setDate(now.getDate() - 365);
        break;
    }
    
    return tasks.filter((task) => {
      const taskDate = new Date(task.createdAt || task.updatedAt);
      return taskDate >= startDate && taskDate <= now;
    });
  }, [tasks, timePeriod]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const userTasks = filteredTasks.filter((t) => 
      currentUser ? t.assigneeUserIds?.includes(currentUser.id) : false
    );
    
    const totalAssigned = userTasks.length;
    const completedTasks = userTasks.filter((t) => t.status === 'done');
    const inProgressTasks = userTasks.filter((t) => t.status === 'in_progress');
    const todoTasks = userTasks.filter((t) => t.status === 'todo');
    
    const completedInProgress = inProgressTasks.filter((t) => t.status === 'done').length;
    const allInProgressCompleted = inProgressTasks.length > 0 && completedInProgress === inProgressTasks.length;
    
    const completedTodo = todoTasks.filter((t) => t.status === 'done').length;
    const allTodoCompleted = todoTasks.length > 0 && completedTodo === todoTasks.length;
    
    // Calculate on-time completion rate
    const tasksWithDueDate = completedTasks.filter((t): t is Task & { dueDate: string } => !!t.dueDate);
    const onTimeTasks = tasksWithDueDate.filter((t) => {
      const dueDate = new Date(t.dueDate);
      const completedAt = new Date(t.updatedAt);
      return completedAt <= dueDate;
    });
    const onTimeRate = tasksWithDueDate.length > 0 ? onTimeTasks.length / tasksWithDueDate.length : 1;
    
    // Calculate streak (consecutive tasks completed on or ahead of time)
    const sortedCompleted = [...completedTasks]
      .filter((t): t is Task & { dueDate: string } => !!t.dueDate)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    let currentStreak = 0;
    for (const task of sortedCompleted) {
      const dueDate = new Date(task.dueDate);
      const completedAt = new Date(task.updatedAt);
      if (completedAt <= dueDate) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    return {
      totalAssigned,
      completedCount: completedTasks.length,
      inProgressCount: inProgressTasks.length,
      todoCount: todoTasks.length,
      allInProgressCompleted,
      allTodoCompleted,
      onTimeRate,
      currentStreak,
      tasksByStatus: {
        done: completedTasks.length,
        in_progress: inProgressTasks.length,
        todo: todoTasks.length,
        on_hold: userTasks.filter((t) => t.status === 'on_hold').length,
      },
    };
  }, [filteredTasks, currentUser]);

  // Determine status level
  const statusLevel: StatusLevel = useMemo(() => {
    // If no tasks assigned, default to Average
    if (metrics.totalAssigned === 0) {
      return 'average';
    }
    
    if (metrics.currentStreak >= 3 && metrics.onTimeRate >= 0.8) {
      return 'above_and_beyond';
    } else if (metrics.allInProgressCompleted && metrics.allTodoCompleted) {
      return 'above_average';
    } else if (metrics.allInProgressCompleted || metrics.inProgressCount === 0) {
      return 'average';
    } else {
      return 'below_average';
    }
  }, [metrics]);

  const statusConfig = {
    below_average: {
      label: 'Below Average',
      description: 'Complete your in-progress tasks to improve',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive',
      icon: TrendingDown,
    },
    average: {
      label: 'Average',
      description: 'Good progress, keep it up!',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      borderColor: 'border-muted-foreground',
      icon: Target,
    },
    above_average: {
      label: 'Above Average',
      description: 'Excellent work on task completion',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary',
      icon: CheckCircle2,
    },
    above_and_beyond: {
      label: 'Above and Beyond',
      description: 'Outstanding performance with consistent on-time delivery',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      borderColor: 'border-purple-500',
      icon: Award,
    },
  };

  const config = statusConfig[statusLevel];
  const StatusIcon = config.icon;

  const completionRate = metrics.totalAssigned > 0 
    ? (metrics.completedCount / metrics.totalAssigned) * 100 
    : 0;

  return (
    <Card className={cn('shadow-sm border-none', config.borderColor, 'border-l-4')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <StatusIcon className={cn('h-5 w-5', config.color)} />
            Progress Status
          </CardTitle>
          <Badge className={cn(config.color, config.bgColor, config.borderColor)}>
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Period Filter */}
        <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <TabsList className="w-full justify-start h-8">
            <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
            <TabsTrigger value="quarterly" className="text-xs">Quarterly</TabsTrigger>
            <TabsTrigger value="yearly" className="text-xs">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Main Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tasks Completed</span>
              <span className="text-sm font-semibold">{metrics.completedCount}/{metrics.totalAssigned}</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">On-Time Rate</span>
              <span className="text-sm font-semibold">{Math.round(metrics.onTimeRate * 100)}%</span>
            </div>
            <Progress value={metrics.onTimeRate * 100} className="h-2" />
          </div>
        </div>

        {/* Streak */}
        {statusLevel === 'above_and_beyond' && (
          <div className={cn('flex items-center gap-2 p-3 rounded-lg', config.bgColor)}>
            <Flame className={cn('h-5 w-5', config.color)} />
            <div className="flex-1">
              <p className="text-sm font-semibold">Current Streak</p>
              <p className="text-xs text-muted-foreground">
                {metrics.currentStreak} tasks completed on or ahead of time
              </p>
            </div>
            <Badge className={cn(config.color, config.bgColor)}>
              {metrics.currentStreak}
            </Badge>
          </div>
        )}

        {/* Tasks by Status */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tasks by Status</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-xs">Done: {metrics.tasksByStatus.done}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-accent" />
              <span className="text-xs">In Progress: {metrics.tasksByStatus.in_progress}</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">To Do: {metrics.tasksByStatus.todo}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-amber-600" />
              <span className="text-xs">On Hold: {metrics.tasksByStatus.on_hold}</span>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {metrics.totalAssigned === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <p>No tasks assigned in this period</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
