"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Task } from '@/lib/types';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

function getPeriodBounds(period: Period, now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'daily':
      break;
    case 'weekly': {
      // Assuming Monday is start of week
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'monthly':
      start.setDate(1);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0); // last day of current month
      break;
    case 'quarterly': {
      const qMonth = Math.floor(start.getMonth() / 3) * 3;
      start.setMonth(qMonth, 1);
      end.setMonth(qMonth + 3, 0);
      break;
    }
    case 'yearly':
      start.setMonth(0, 1);
      end.setMonth(12, 0);
      break;
  }
  return { start, end };
}

function getProgressStatusLabel(percentage: number) {
  if (percentage < 40) return { label: 'Below Average', color: 'text-red-600' };
  if (percentage < 60) return { label: 'Average', color: 'text-amber-600' };
  if (percentage < 80) return { label: 'Above Average', color: 'text-blue-600' };
  return { label: 'Above & Beyond', color: 'text-green-600' };
}

interface ProgressTrackerProps {
  tasks: Task[];
}

export function ProgressTracker({ tasks }: ProgressTrackerProps) {
  const [period, setPeriod] = useState<Period>('monthly');

  const { total, done, percentage, status } = useMemo(() => {
    const now = new Date();
    const { start, end } = getPeriodBounds(period, now);

    let periodTotal = 0;
    let periodDone = 0;

    tasks.forEach((task) => {
      if (!task.dueDate) return;
      
      const due = new Date(task.dueDate);
      if (due >= start && due <= end) {
        periodTotal++;
        if (task.status === 'done') {
          periodDone++;
        }
      }
    });

    const calcPercentage = periodTotal > 0 ? (periodDone / periodTotal) * 100 : 0;
    const calcStatus = getProgressStatusLabel(calcPercentage);

    return { 
      total: periodTotal, 
      done: periodDone, 
      percentage: calcPercentage,
      status: calcStatus
    };
  }, [tasks, period]);

  return (
    <Card className="shadow-sm border-none bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-8">
              <TabsTrigger value="daily" className="text-[10px] sm:text-xs">Day</TabsTrigger>
              <TabsTrigger value="weekly" className="text-[10px] sm:text-xs">Week</TabsTrigger>
              <TabsTrigger value="monthly" className="text-[10px] sm:text-xs">Month</TabsTrigger>
              <TabsTrigger value="quarterly" className="text-[10px] sm:text-xs">Quarter</TabsTrigger>
              <TabsTrigger value="yearly" className="text-[10px] sm:text-xs">Year</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="pt-2">
            <div className="flex justify-between items-end mb-2">
              <div>
                <span className="text-3xl font-bold">
                  {total > 0 ? Math.round(percentage) : 0}%
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({done}/{total} tasks)
                </span>
              </div>
              
              {total > 0 ? (
                <span className={cn("text-xs font-semibold uppercase tracking-wider", status.color)}>
                  {status.label}
                </span>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  N/A
                </span>
              )}
            </div>
            
            <Progress 
              value={total > 0 ? percentage : 0} 
              className={cn("h-2", total === 0 && "opacity-50")} 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
