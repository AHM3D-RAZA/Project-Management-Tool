"use client";

import React from 'react';
import { useNexusStore } from '@/hooks/use-nexus-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Shield, FileEdit, Trash2, UserPlus, Info } from 'lucide-react';

interface AuditLogsViewProps {
  store: ReturnType<typeof useNexusStore>;
}

export function AuditLogsView({ store }: AuditLogsViewProps) {
  if (!store.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Shield className="h-16 w-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-semibold text-muted-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          You do not have permission to view workspace audit logs. Please contact a workspace owner or lead.
        </p>
      </div>
    );
  }

  if (store.isAuditLogsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground animate-pulse">Loading audit logs...</p>
      </div>
    );
  }

  const logs = store.workspaceAuditLogs || [];

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <UserPlus className="h-4 w-4 text-emerald-500" />;
      case 'update': return <FileEdit className="h-4 w-4 text-blue-500" />;
      case 'delete':
      case 'remove': 
      case 'revoke': return <Trash2 className="h-4 w-4 text-rose-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'update': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'delete':
      case 'remove':
      case 'revoke': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-lg border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Access Log</h2>
          <p className="text-muted-foreground mt-1">
            Review security and modification events across {store.activeWorkspace?.name}.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Latest Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No audit logs available for this workspace yet.
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="min-w-full inline-block align-middle">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actor
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Entity
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {logs.map((log) => {
                      const date = new Date(log.timestamp);
                      const isActorMe = store.currentUser?.id === log.actorId;
                      // Display actor as "You" if it's the current user, or search members list to get display name. 
                      // For a robust UI we might need the actual member map from store, but the actorId is available.
                      const actorProfile = store.workspaceMembers?.find(m => m.id === log.actorId);
                      const actorName = isActorMe ? "You" : (actorProfile?.displayName || log.actorId.substring(0, 8) + '...');
                      
                      return (
                        <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {format(date, 'MMM d, yyyy HH:mm:ss')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{actorName}</span>
                              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                                {log.actorRole}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                              {getActionIcon(log.action)}
                              <span className="capitalize">{log.action}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">
                            {log.entityType}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground truncate max-w-sm" title={log.summary}>
                            {log.summary}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
