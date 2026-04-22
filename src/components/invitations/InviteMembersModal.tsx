"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Search, 
  Mail, 
  Loader2, 
  UserPlus,
  Box
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

export function InviteMembersModal({ 
  isOpen, 
  onOpenChange, 
  store 
}: { 
  isOpen: boolean, 
  onOpenChange: (open: boolean) => void, 
  store: any 
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('send-email');
  
  // Selection State (Shared between tabs)
  const [role, setRole] = useState<'member' | 'lead'>('member');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  // Email invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Search State
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab !== 'find-user' || !searchEmail.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      if (searchEmail.trim().length >= 2) {
        setIsSearching(true);
        try {
          const users = await store.searchUsersByEmail(searchEmail);
          setSearchResults(users);
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchEmail, activeTab, store]);

  const handleSendEmailInvite = async () => {
    setIsSending(true);
    try {
      await store.sendEmailInvite({
        recipientEmail: inviteEmail,
        role,
        targetProjectIds: selectedProjects,
        joinUrl: typeof window !== 'undefined' ? window.location.origin : '',
      });
      toast({ 
        title: 'Invitation sent',
        description: `We emailed ${inviteEmail.trim()} with a link to join.`,
      });
      setInviteEmail('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not send invite', description: error.message || 'Try again.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleProject = (id: string) => {
    setSelectedProjects(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleAddDirect = async (user: any, targetRole: 'member' | 'lead') => {
    try {
      await store.directAddMember(user, targetRole, selectedProjects);
      toast({ 
        title: 'Member added!', 
        description: `${user.name || user.email} is now a ${targetRole}${selectedProjects.length > 0 ? ` with access to ${selectedProjects.length} projects` : ''}.` 
      });
      setSearchResults([]);
      setSearchEmail('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const ProjectSelection = () => (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Box className="h-3 w-3" /> Target Projects (Optional)
      </Label>
      <p className="text-[10px] text-muted-foreground pb-2">
        If role is Member and you select projects, access is limited to those projects.
        If none selected, they get access to all workspace projects.
      </p>
      <ScrollArea className="h-[120px] rounded-md border p-2">
        <div className="space-y-2">
          {store.workspaceProjects.map((p: any) => (
            <div key={p.id} className="flex items-center space-x-2">
              <Checkbox 
                id={`proj-${p.id}`} 
                checked={selectedProjects.includes(p.id)} 
                onCheckedChange={() => handleToggleProject(p.id)}
              />
              <label 
                htmlFor={`proj-${p.id}`} 
                className="text-xs font-medium leading-none cursor-pointer"
              >
                {p.name}
              </label>
            </div>
          ))}
          {store.workspaceProjects.length === 0 && (
            <div className="text-[10px] text-center py-4 text-muted-foreground italic">
              No projects in this workspace yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Members
          </DialogTitle>
          <DialogDescription>
            Send an email invitation or add someone who already uses PSF Project Tracker.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send-email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email invite
            </TabsTrigger>
            <TabsTrigger value="find-user" className="gap-2">
              <Search className="h-4 w-4" />
              Find user
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send-email" className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Recipient email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">
                  They will receive a message with a link to sign in and join this workspace (same as before).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Assign Role</Label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ProjectSelection />

              <Button 
                className="w-full" 
                onClick={handleSendEmailInvite} 
                disabled={isSending || !inviteEmail.trim()}
              >
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send invitation email
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="find-user" className="space-y-6 py-4">
            <div className="space-y-6">
              <ProjectSelection />
              
              <div className="space-y-4">
                <Label>Search Members</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Type an email to search..." 
                    className="pl-9" 
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-3 max-h-[250px] overflow-y-auto min-h-[100px]">
                  {isSearching && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm">Searching...</span>
                    </div>
                  )}
                  
                  {!isSearching && searchResults.map(user => {
                    const isAlreadyMember = store.activeWorkspace?.memberRoles?.[user.id] !== undefined;
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{user.name || 'User'}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isAlreadyMember ? (
                            <Badge variant="secondary">Member</Badge>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="h-8 px-2 text-[10px]" onClick={() => handleAddDirect(user, 'member')}>
                                Add Member
                              </Button>
                              <Button size="sm" variant="secondary" className="h-8 px-2 text-[10px]" onClick={() => handleAddDirect(user, 'lead')}>
                                Add Lead
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {!isSearching && searchResults.length === 0 && searchEmail.length >= 2 && (
                    <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                      No results for "{searchEmail}"
                    </div>
                  )}
                  
                  {!isSearching && searchEmail.length < 2 && (
                    <div className="text-center py-6 text-muted-foreground text-xs italic">
                      Type at least 2 characters to search
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
