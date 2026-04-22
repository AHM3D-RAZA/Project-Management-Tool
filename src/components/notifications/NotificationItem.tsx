
"use client";

import React from 'react';
import { Notification } from '@/lib/types';
import { UserPlus, Edit, MessageSquare, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
  notification: Notification;
  onClick: (notif: Notification) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = notification.type === 'task_assigned' 
    ? UserPlus 
    : notification.type === 'task_updated' 
      ? Edit 
      : MessageSquare;

  return (
    <div 
      className={cn(
        "flex gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0",
        !notification.read && "bg-primary/5"
      )}
      onClick={() => onClick(notification)}
    >
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
        notification.type === 'task_assigned' ? "bg-blue-100 text-blue-600" :
        notification.type === 'task_updated' ? "bg-orange-100 text-orange-600" :
        "bg-green-100 text-green-600"
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <p className="text-xs font-bold truncate">{notification.title}</p>
          {!notification.read && <Circle className="h-2 w-2 fill-primary text-primary" />}
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground/60 font-medium pt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
