"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut, MessageSquare } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { NexusStore } from '@/hooks/use-nexus-store';
import type { AttendanceEntry } from '@/lib/types';

export function AttendanceLogView({ store }: { store: NexusStore }) {
  const { allWorkspaceAttendance, isAllAttendanceLoading, workspaceMembers, isAdmin, workspaceWorkUpdates, isWorkUpdatesLoading } = store;
  const [mounted, setMounted] = useState(false);
  const [filterUserId, setFilterUserId] = useState('all');
  const [filterTimeframe, setFilterTimeframe] = useState('all');
  const [activeTab, setActiveTab] = useState('attendance');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Only workspace admins can view attendance logs.</p>
      </div>
    );
  }

  if (isAllAttendanceLoading && !allWorkspaceAttendance.length) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="shadow-sm border-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Filter logic
  const now = new Date();
  
  const filteredAttendance = allWorkspaceAttendance.filter((entry) => {
    // 1. User filter
    if (filterUserId !== 'all' && entry.userId !== filterUserId) {
      return false;
    }
    
    // 2. Timeframe filter
    if (filterTimeframe !== 'all') {
      const entryDate = new Date(entry.checkInTime || entry.dateKey);
      
      if (filterTimeframe === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (entryDate < weekAgo) return false;
      } else if (filterTimeframe === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (entryDate < monthAgo) return false;
      } else if (filterTimeframe === 'quarter') {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (entryDate < quarterAgo) return false;
      } else if (filterTimeframe === 'year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        if (entryDate < yearAgo) return false;
      }
    }
    
    return true;
  });

  // Sort by date (most recent first)
  const sortedAttendance = [...filteredAttendance].sort((a, b) => 
    new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime()
  );

  // Group by date
  const groupedByDate = sortedAttendance.reduce((acc: Record<string, AttendanceEntry[]>, entry) => {
    if (!acc[entry.dateKey]) {
      acc[entry.dateKey] = [];
    }
    acc[entry.dateKey].push(entry);
    return acc;
  }, {} as Record<string, AttendanceEntry[]>);

  const getMemberName = (userId: string) => {
    const member = workspaceMembers.find((m) => m.userId === userId);
    return member?.displayName || 'Unknown User';
  };

  const formatTime = (isoString: string) => {
    if (!mounted || !isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateKey: string) => {
    if (!mounted || !dateKey) return '';
    const [year, month, day] = dateKey.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attendance Log</h2>
          <p className="text-muted-foreground">Track check-ins and check-outs for all team members</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="attendance">Attendance Log</TabsTrigger>
          <TabsTrigger value="updates">Work Updates</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Select value={filterTimeframe} onValueChange={setFilterTimeframe}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">Past 7 Days</SelectItem>
                <SelectItem value="month">Past 30 Days</SelectItem>
                <SelectItem value="quarter">Past 90 Days</SelectItem>
                <SelectItem value="year">Past Year</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Team Member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {workspaceMembers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {Object.keys(groupedByDate).length === 0 ? (
            <Card className="shadow-sm border-none">
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No attendance records found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByDate).map(([dateKey, entries]) => (
                <div key={dateKey}>
                  <h3 className="text-lg font-semibold mb-3">{formatDate(dateKey)}</h3>
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <Card key={entry.id} className="shadow-sm border-none">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {getMemberName(entry.userId).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{getMemberName(entry.userId)}</p>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <LogIn className="h-3 w-3" />
                                  {formatTime(entry.checkInTime)}
                                </span>
                                {entry.checkOutTime && (
                                  <span className="flex items-center gap-1">
                                    <LogOut className="h-3 w-3" />
                                    {formatTime(entry.checkOutTime)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={entry.checkOutTime ? (entry.autoCheckout ? "outline" : "secondary") : "default"}
                                className={entry.autoCheckout ? "border-amber-500 text-amber-600" : ""}
                              >
                                {entry.checkOutTime
                                  ? (entry.autoCheckout ? "Auto Checkout" : "Completed")
                                  : "Active"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="updates" className="space-y-4 mt-4">
          {isWorkUpdatesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Card key={i} className="shadow-sm border-none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : workspaceWorkUpdates.length === 0 ? (
            <Card className="shadow-sm border-none">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No work updates found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {workspaceWorkUpdates.map((update) => (
                <Card key={update.id} className="shadow-sm border-none">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {getMemberName(update.userId).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-medium">{getMemberName(update.userId)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(update.timestamp).toLocaleString([], { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{update.updateText}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
