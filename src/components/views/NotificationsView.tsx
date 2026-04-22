
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, UserPlus, Edit, MessageSquare, Circle, Loader2, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { useNexusStore } from '@/hooks/use-nexus-store';

const iconMap = {
  task_assigned: <UserPlus className="h-4 w-4 text-blue-500" />,
  task_updated: <Edit className="h-4 w-4 text-orange-500" />,
  comment_added: <MessageSquare className="h-4 w-4 text-green-500" />,
  mentioned: <AtSign className="h-4 w-4 text-purple-500" />,
};

export function NotificationsView({ store }: { store: any }) {
  const { notifications, isLoading } = useNotifications(50);
  const { markNotificationAsRead } = store;

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold font-headline">Activity Feed</h2>
        </div>
        {!isLoading && notifications.length > 0 && (
          <p className="text-xs text-muted-foreground">{notifications.length} recent events</p>
        )}
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <CardContent className="p-0">
          <div className="divide-y">
            {notifications.map((notif: any) => (
              <div 
                key={notif.id} 
                className={cn(
                  "p-6 flex items-start gap-4 transition-colors hover:bg-muted/30 cursor-pointer",
                  !notif.read && "bg-primary/5 border-l-4 border-l-primary"
                )}
                onClick={() => !notif.read && markNotificationAsRead(notif.id)}
              >
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                  notif.type === 'task_assigned' ? "bg-blue-100 text-blue-600" :
                  notif.type === 'task_updated' ? "bg-orange-100 text-orange-600" :
                  notif.type === 'mentioned' ? "bg-purple-100 text-purple-600" :
                  "bg-green-100 text-green-600"
                )}>
                  {iconMap[notif.type as keyof typeof iconMap] || <Bell className="h-4 w-4" />}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{notif.title}</span>
                    <span className="text-[10px] text-muted-foreground/60 font-medium">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {notif.message}
                  </p>
                  
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      <span className="text-primary/70">{notif.actorName}</span>
                    </div>
                    {!notif.read && (
                      <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {!isLoading && notifications.length === 0 && (
            <div className="p-16 text-center text-muted-foreground space-y-4">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
                <Bell className="h-8 w-8 opacity-20" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">No recent activity</h3>
                <p className="max-w-xs mx-auto text-sm">Notifications about task assignments and updates will appear here.</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="p-20 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                <span className="text-xs text-muted-foreground font-medium">Syncing activity...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
