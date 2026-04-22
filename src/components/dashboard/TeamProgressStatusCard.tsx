"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  CheckCircle2, 
  Clock, 
  Target,
  Users,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamProgressStatusCardProps {
  tasks: any[];
  workspaceMembers: any[];
  store: any;
}

type TimePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type StatusLevel = 'below_average' | 'average' | 'above_average' | 'above_and_beyond';

export function TeamProgressStatusCard({ tasks, workspaceMembers, store }: TeamProgressStatusCardProps) {
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
    
    return tasks.filter((task: any) => {
      const taskDate = new Date(task.createdAt || task.updatedAt);
      return taskDate >= startDate && taskDate <= now;
    });
  }, [tasks, timePeriod]);

  // Calculate metrics for each member
  const memberMetrics = useMemo(() => {
    return workspaceMembers.map((member: any) => {
      const userTasks = filteredTasks.filter((t: any) => 
        t.assigneeUserIds?.includes(member.userId)
      );
      
      const totalAssigned = userTasks.length;
      const completedTasks = userTasks.filter((t: any) => t.status === 'done');
      const inProgressTasks = userTasks.filter((t: any) => t.status === 'in_progress');
      const todoTasks = userTasks.filter((t: any) => t.status === 'todo');
      
      const completedInProgress = inProgressTasks.filter((t: any) => t.status === 'done').length;
      const allInProgressCompleted = inProgressTasks.length > 0 && completedInProgress === inProgressTasks.length;
      
      const completedTodo = todoTasks.filter((t: any) => t.status === 'done').length;
      const allTodoCompleted = todoTasks.length > 0 && completedTodo === todoTasks.length;
      
      // Calculate on-time completion rate
      const tasksWithDueDate = completedTasks.filter((t: any) => t.dueDate);
      const onTimeTasks = tasksWithDueDate.filter((t: any) => {
        const dueDate = new Date(t.dueDate);
        const completedAt = new Date(t.updatedAt);
        return completedAt <= dueDate;
      });
      const onTimeRate = tasksWithDueDate.length > 0 ? onTimeTasks.length / tasksWithDueDate.length : 0;
      
      // Calculate streak (consecutive tasks completed on or ahead of time)
      const sortedCompleted = [...completedTasks]
        .filter((t: any) => t.dueDate)
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
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
      
      // Determine status level
      let statusLevel: StatusLevel;
      if (totalAssigned === 0) {
        statusLevel = 'average';
      } else if (currentStreak >= 3 && onTimeRate >= 0.8) {
        statusLevel = 'above_and_beyond';
      } else if (allInProgressCompleted && allTodoCompleted) {
        statusLevel = 'above_average';
      } else if (allInProgressCompleted || inProgressTasks.length === 0) {
        statusLevel = 'average';
      } else {
        statusLevel = 'below_average';
      }
      
      const completionRate = totalAssigned > 0 
        ? (completedTasks.length / totalAssigned) * 100 
        : 0;
      
      return {
        member,
        totalAssigned,
        completedCount: completedTasks.length,
        inProgressCount: inProgressTasks.length,
        todoCount: todoTasks.length,
        onTimeRate,
        currentStreak,
        statusLevel,
        completionRate,
      };
    }).sort((a, b) => {
      // Sort by status level priority
      const statusPriority = {
        above_and_beyond: 0,
        above_average: 1,
        average: 2,
        below_average: 3,
      };
      return statusPriority[a.statusLevel] - statusPriority[b.statusLevel];
    });
  }, [filteredTasks, workspaceMembers]);

  const statusConfig = {
    below_average: {
      label: 'Below Average',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive',
      icon: TrendingDown,
    },
    average: {
      label: 'Average',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      borderColor: 'border-muted-foreground',
      icon: Target,
    },
    above_average: {
      label: 'Above Average',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary',
      icon: CheckCircle2,
    },
    above_and_beyond: {
      label: 'Above and Beyond',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      borderColor: 'border-purple-500',
      icon: Award,
    },
  };

  return (
    <Card className="shadow-sm border-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Progress Status
          </CardTitle>
        </div>
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

        {/* Member List */}
        <div className="space-y-3">
          {memberMetrics.map(({ member, totalAssigned, completedCount, onTimeRate, currentStreak, statusLevel, completionRate }) => {
            const config = statusConfig[statusLevel];
            const StatusIcon = config.icon;
            
            return (
              <div
                key={member.userId}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  config.bgColor,
                  config.borderColor,
                  'border-l-4'
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatarUrl} />
                    <AvatarFallback className="text-xs">
                      {member.displayName?.charAt(0) || member.userId?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{member.displayName}</p>
                      <Badge className={cn('text-xs', config.color, config.bgColor, config.borderColor)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                    
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tasks Completed</span>
                        <span className="font-medium">{completedCount}/{totalAssigned}</span>
                      </div>
                      <Progress value={completionRate} className="h-1.5" />
                      
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">On-time:</span>
                          <span className="font-medium">{Math.round(onTimeRate * 100)}%</span>
                        </div>
                        {statusLevel === 'above_and_beyond' && currentStreak > 0 && (
                          <div className="flex items-center gap-1">
                            <Flame className="h-3 w-3 text-orange-500" />
                            <span className="text-muted-foreground">Streak:</span>
                            <span className="font-medium">{currentStreak}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {workspaceMembers.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <p>No team members found</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
