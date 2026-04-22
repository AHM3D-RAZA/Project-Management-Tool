"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkUpdateModal } from '@/components/attendance/WorkUpdateModal';

export function AttendanceCard({ store }: { store: any }) {
  const {
    todayAttendance,
    isAttendanceLoading,
    openAttendanceEntry,
    checkIn,
    checkOut,
    activeWorkspace,
    currentUser,
    saveWorkUpdate
  } = store;
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWorkUpdateModalOpen, setIsWorkUpdateModalOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
  }, []);

  // Update `now` every 60 seconds to accurately compare the changing time gap dynamically
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Request notification permission and set up hourly notifications when checked in
  useEffect(() => {
    if (!mounted || !openAttendanceEntry) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Set up hourly notification
    const notificationInterval = setInterval(() => {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Work Update Reminder', {
          body: 'Time to provide your work update',
          icon: '/favicon.ico',
          tag: 'work-update-reminder',
        });
        
        notification.onclick = () => {
          setIsWorkUpdateModalOpen(true);
          notification.close();
        };
      }
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(notificationInterval);
  }, [mounted, openAttendanceEntry]);

  const handleCheckIn = async () => {
    if (!activeWorkspace?.id || !currentUser?.id) return;
    setIsProcessing(true);
    try {
      await checkIn();
      toast({ title: 'Checked in successfully' });
    } catch (error: any) {
      console.error('Check-in error:', error);
      toast({
        variant: 'destructive',
        title: 'Check-in failed',
        description: error?.message || 'Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeWorkspace?.id || !currentUser?.id) return;
    setIsProcessing(true);
    try {
      await checkOut();
      toast({ title: 'Checked out successfully' });
    } catch (error: any) {
      console.error('Check-out error:', error);
      const isDelayError = error.message?.includes('Must wait at least 8 hours');
      toast({
        variant: isDelayError ? 'default' : 'destructive',
        title: isDelayError ? 'Check-out not available yet' : 'Check-out failed',
        description: error.message || 'Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveWorkUpdate = useCallback(async (updateText: string) => {
    try {
      await saveWorkUpdate(updateText);
      toast({ title: 'Work update saved successfully' });
    } catch (error: any) {
      console.error('Failed to save work update:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save work update',
        description: error.message || 'Please try again.'
      });
      throw error;
    }
  }, [saveWorkUpdate, toast]);

  // Determine attendance status using openAttendanceEntry (cross-midnight aware)
  const getStatus = () => {
    // If there's an open (unchecked-out) entry from any day, user is still checked in
    if (openAttendanceEntry) return 'checked_in';
    // If today has a completed entry, user is done
    if (todayAttendance?.checkOutTime) return 'checked_out';
    // Otherwise not checked in
    return 'not_checked_in';
  };

  const status = getStatus();

  // Use the open entry for display when checked in (could be from a previous day)
  const activeEntry = openAttendanceEntry || todayAttendance;

  // Calculate if 8 hours have passed natively
  let canCheckOut = false;
  let remainingHoursDisplay = '';
  
  if (activeEntry?.checkInTime) {
    const checkInTime = new Date(activeEntry.checkInTime);
    // getTime() returns purely milliseconds so we find the time difference natively 
    const msSinceCheckIn = now.getTime() - checkInTime.getTime();
    const hoursSinceCheckIn = msSinceCheckIn / (1000 * 60 * 60);

    if (hoursSinceCheckIn >= 8) {
      canCheckOut = true;
    } else {
      const remainingMs = (8 * 60 * 60 * 1000) - msSinceCheckIn;
      const hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
      const minsRemaining = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      
      remainingHoursDisplay = hoursRemaining > 0 
        ? `${hoursRemaining}h ${minsRemaining}m` 
        : `${minsRemaining}m`;
    }
  }

  const formatTime = (isoString: string) => {
    if (!mounted || !isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isAttendanceLoading && !todayAttendance && !openAttendanceEntry) {
    return (
      <Card className="shadow-sm border-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">Attendance</CardTitle>
        <Clock className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-2xl font-bold">
            {status === 'not_checked_in' && (
              <span className="text-muted-foreground">Not checked in</span>
            )}
            {status === 'checked_in' && (
              <span className="text-green-600">
                {formatTime(activeEntry?.checkInTime)}
              </span>
            )}
            {status === 'checked_out' && (
              <span className="text-muted-foreground">
                {formatTime(todayAttendance?.checkOutTime)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {status === 'not_checked_in' && 'Today'}
            {status === 'checked_in' && (
              activeEntry?.dateKey !== new Date().toISOString().split('T')[0]
                ? `Checked in (${activeEntry?.dateKey})`
                : 'Checked in'
            )}
            {status === 'checked_out' && (
              todayAttendance?.autoCheckout ? 'Auto checked out' : 'Checked out'
            )}
          </div>
          <div className="pt-2">
            {status === 'not_checked_in' && (
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={handleCheckIn}
                disabled={isProcessing || !activeWorkspace?.id}
              >
                <LogIn className="h-4 w-4" />
                Check in
              </Button>
            )}
            {status === 'checked_in' && (
              <div className="space-y-1">
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleCheckOut}
                  disabled={isProcessing || !canCheckOut}
                >
                  <LogOut className="h-4 w-4" />
                  Check out
                </Button>
                {!canCheckOut && remainingHoursDisplay && (
                  <p className="text-[10px] text-center text-muted-foreground w-full">
                    Available in {remainingHoursDisplay}
                  </p>
                )}
              </div>
            )}
            {status === 'checked_out' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                disabled
              >
                <CheckCircle2 className="h-4 w-4" />
                Done for today
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <WorkUpdateModal
        isOpen={isWorkUpdateModalOpen}
        onClose={() => setIsWorkUpdateModalOpen(false)}
        onSave={handleSaveWorkUpdate}
      />
    </Card>
  );
}

