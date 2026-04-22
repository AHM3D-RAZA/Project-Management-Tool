"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Clock, Circle } from 'lucide-react';
import { AttendanceEntry } from '@/lib/types';

interface MemberStatus {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: 'active' | 'checked_out' | 'not_checked_in';
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursWorked: number; // decimal hours
}

function formatHours(hours: number): string {
  if (hours <= 0) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '--:--';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TeamActivityCard({ store }: { store: any }) {
  const {
    workspaceMembers,
    todayTeamAttendance,
    isTodayTeamAttendanceLoading,
    openTeamAttendance,
  } = store;

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tick every 60 seconds to update live hours for active members
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const memberStatuses: MemberStatus[] = useMemo(() => {
    if (!workspaceMembers) return [];

    return workspaceMembers.map((member: any) => {
      // Check today's entries first, then fall back to open (cross-midnight) entries
      const todayEntry: AttendanceEntry | undefined = (todayTeamAttendance || []).find(
        (a: AttendanceEntry) => a.userId === member.userId
      );
      const openEntry: AttendanceEntry | undefined = (openTeamAttendance || []).find(
        (a: AttendanceEntry) => a.userId === member.userId
      );

      // Prefer today's entry if it exists; otherwise use the open entry
      const entry = todayEntry || openEntry;

      let status: MemberStatus['status'] = 'not_checked_in';
      let hoursWorked = 0;

      if (entry) {
        if (entry.checkInTime && !entry.checkOutTime) {
          status = 'active';
          // Live elapsed time
          const checkIn = new Date(entry.checkInTime);
          hoursWorked = Math.max(0, (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
        } else if (entry.checkOutTime) {
          status = 'checked_out';
          const checkIn = new Date(entry.checkInTime);
          const checkOut = new Date(entry.checkOutTime);
          hoursWorked = Math.max(0, (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
        }
      }

      return {
        userId: member.userId,
        displayName: member.displayName || 'Unknown',
        avatarUrl: member.avatarUrl || null,
        role: member.role || 'member',
        status,
        checkInTime: entry?.checkInTime || null,
        checkOutTime: entry?.checkOutTime || null,
        hoursWorked,
      };
    });
  }, [workspaceMembers, todayTeamAttendance, openTeamAttendance, now]);

  // Sort: active first, then checked_out, then not_checked_in
  const sorted = useMemo(() => {
    const order = { active: 0, checked_out: 1, not_checked_in: 2 };
    return [...memberStatuses].sort((a, b) => order[a.status] - order[b.status]);
  }, [memberStatuses]);

  const activeCount = useMemo(() => sorted.filter(m => m.status === 'active').length, [sorted]);

  if (isTodayTeamAttendanceLoading && (!todayTeamAttendance || todayTeamAttendance.length === 0)) {
    return (
      <Card className="shadow-sm border-none lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-none lg:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <div className="flex items-center gap-2.5">
          <CardTitle className="text-lg">Team Activity</CardTitle>
          <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 h-5">
            {activeCount} active
          </Badge>
        </div>
        <Users className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <ScrollArea className={sorted.length > 6 ? "h-[340px]" : ""}>
          <div className="space-y-1">
            {sorted.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Avatar with status dot */}
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs font-semibold">
                      {member.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Circle
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card fill-current ${
                      member.status === 'active'
                        ? 'text-green-500'
                        : member.status === 'checked_out'
                        ? 'text-slate-400'
                        : 'text-slate-300'
                    }`}
                  />
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.displayName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {member.role}
                  </p>
                </div>

                {/* Hours + times */}
                <div className="flex items-center gap-3 shrink-0">
                  {member.status !== 'not_checked_in' && mounted && (
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatHours(member.hoursWorked)}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {formatTime(member.checkInTime)}
                        {member.checkOutTime ? ` – ${formatTime(member.checkOutTime)}` : ' – now'}
                      </p>
                    </div>
                  )}

                  {/* Status badge */}
                  <Badge
                    variant={member.status === 'active' ? 'default' : 'secondary'}
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full min-w-[60px] justify-center ${
                      member.status === 'active'
                        ? 'bg-green-500/15 text-green-700 border-green-500/20 hover:bg-green-500/20'
                        : member.status === 'checked_out'
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}
                  >
                    {member.status === 'active' ? 'Active' : member.status === 'checked_out' ? 'Done' : 'Offline'}
                  </Badge>
                </div>
              </div>
            ))}

            {sorted.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No team members found.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
