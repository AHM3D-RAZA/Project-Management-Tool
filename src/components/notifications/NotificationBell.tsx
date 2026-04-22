
"use client";

import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationItem } from './NotificationItem';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Notification } from '@/lib/types';

interface NotificationBellProps {
  onNavigateToTask: (wsId: string, projId: string, taskId: string) => void;
  markAsRead: (id: string) => void;
}

export function NotificationBell({ onNavigateToTask, markAsRead }: NotificationBellProps) {
  const { notifications, unreadCount, isLoading } = useNotifications(10);
  const [open, setOpen] = useState(false);

  const handleNotifClick = (notif: Notification) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.workspaceId && notif.projectId && notif.taskId) {
      onNavigateToTask(notif.workspaceId, notif.projectId, notif.taskId);
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-primary border-2 border-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-none">
        <div className="p-3 border-b flex items-center justify-between bg-card/50">
          <span className="text-sm font-bold font-headline">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {unreadCount} New
            </span>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {notifications.length > 0 ? (
            notifications.map(notif => (
              <NotificationItem 
                key={notif.id} 
                notification={notif} 
                onClick={handleNotifClick} 
              />
            ))
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-50">
              <Bell className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-semibold">All caught up!</p>
              <p className="text-[11px] text-muted-foreground">You don't have any notifications at the moment.</p>
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t text-center bg-muted/30">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground font-medium hover:text-primary transition-colors">
            View Activity Feed
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
