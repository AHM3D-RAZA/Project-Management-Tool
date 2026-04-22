"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection,
  getDocs,
  updateDoc, 
  increment, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useFirestore, useAuth } from '@/firebase';
import { Loader2, AlertCircle, LogIn, CheckCircle2, Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function JoinWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.inviteId as string;
  const db = useFirestore();
  const auth = useAuth();

  const bgImage = PlaceHolderImages.find(img => img.id === 'auth-bg');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const [joining, setJoining] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    async function fetchInvitation() {
      if (!db || !inviteId) return;
      try {
        const inviteRef = doc(db, 'invitations', inviteId);
        const inviteSnap = await getDoc(inviteRef);

        if (!inviteSnap.exists()) {
          setInviteError('Invitation not found or has expired');
          setInviteLoading(false);
          return;
        }

        const data = inviteSnap.data();
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setInviteError('This invitation has expired');
          setInviteLoading(false);
          return;
        }

        if (data.status !== 'active') {
          setInviteError('This invitation is no longer active');
          setInviteLoading(false);
          return;
        }

        if (data.maxUses !== 'unlimited' && data.usageCount >= data.maxUses) {
          setInviteError('This invitation has reached its maximum uses');
          setInviteLoading(false);
          return;
        }

        setInvitation({ id: inviteSnap.id, ...data });
        setInviteLoading(false);
      } catch (error: any) {
        setInviteError('Failed to load invitation details');
        setInviteLoading(false);
      }
    }
    fetchInvitation();
  }, [db, inviteId]);

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setSignInError(`Sign in failed: ${error.message}`);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setSignInError(null);
    try {
      if (authMode === 'signup') {
        if (!name.trim()) throw new Error('Name is required');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setSignInError(error.message);
    } finally {
      setSigningIn(false);
    }
  };

  const invitedEmailNorm = invitation?.invitedEmail?.toLowerCase().trim();
  const userEmailNorm = user?.email?.toLowerCase().trim();
  const emailMismatch = Boolean(
    invitedEmailNorm && userEmailNorm && userEmailNorm !== invitedEmailNorm
  );

  const handleJoinWorkspace = async () => {
    if (!user || !invitation || !db) return;
    if (invitation.invitedEmail) {
      const u = user.email?.toLowerCase().trim();
      if (!u || u !== invitation.invitedEmail.toLowerCase().trim()) {
        setInviteError(
          'This invitation was sent to a different email address. Sign in with the account that received the invite.'
        );
        return;
      }
    }
    setJoining(true);
    try {
      const workspaceRef = doc(db, 'workspaces', invitation.workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);
      if (!workspaceSnap.exists()) throw new Error('Workspace no longer exists');

      const workspaceData = workspaceSnap.data();
      const isAlreadyMember = workspaceData.memberRoles?.[user.uid];

      const isEmailInvite = invitation.type === 'email';
      const grantAllProjectsForMember =
        isEmailInvite &&
        invitation.role === 'member' &&
        (!invitation.targetProjectIds || invitation.targetProjectIds.length === 0);

      if (!isAlreadyMember) {
        // 1. Update Workspace Roles
        await updateDoc(workspaceRef, {
          [`memberRoles.${user.uid}`]: invitation.role || 'member',
          updatedAt: serverTimestamp(),
        });

        // 2. Increment usage and complete email invites
        const inviteRef = doc(db, 'invitations', invitation.id);
        if (invitation.type === 'email' || invitation.maxUses === 1) {
          await updateDoc(inviteRef, { usageCount: increment(1), status: 'used' });
        } else {
          await updateDoc(inviteRef, { usageCount: increment(1) });
        }

        // 3. Create Member Profile
        const memberRef = doc(db, 'workspaces', invitation.workspaceId, 'members', user.uid);
        await setDoc(memberRef, {
          id: user.uid,
          workspaceId: invitation.workspaceId,
          userId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email?.toLowerCase() || '',
          avatarUrl: user.photoURL || null,
        }, { merge: true });
      }

      // 4. Grant access to projects (project-level scoping)
      // Email invites:
      // - member + no project selection => grant ALL workspace projects
      // - member + specific selections => grant only those projects
      if (invitation.role === 'member' && isEmailInvite) {
        const projectIds = grantAllProjectsForMember
          ? (await getDocs(collection(db, 'workspaces', invitation.workspaceId, 'projects'))).docs.map((d) => d.id)
          : (invitation.targetProjectIds || []);

        for (const projId of projectIds) {
          const projRef = doc(db, 'workspaces', invitation.workspaceId, 'projects', projId);
          const projSnap = await getDoc(projRef);
          if (!projSnap.exists()) continue;
          const projData = projSnap.data();
          const allowedIds = [...(projData.allowedUserIds || []), user.uid];
          await updateDoc(projRef, { allowedUserIds: Array.from(new Set(allowedIds)) });
        }
      }

      // 5. Sync User Profile
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        id: user.uid,
        email: user.email?.toLowerCase(),
        name: user.displayName || 'User',
        avatarUrl: user.photoURL || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setJoined(true);
      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      setInviteError('Failed to join: ' + (error.message || 'Check your permissions.'));
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || (inviteLoading && !inviteError)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0">
        <Image src={bgImage?.imageUrl || 'https://picsum.photos/seed/65/1920/1080'} alt="PSF Project Tracker" fill className="object-cover" priority data-ai-hint="modern office" />
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      </div>

      <Card className="max-w-md w-full border-none shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300 backdrop-blur-md bg-card/95">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {joined ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <Users className="h-8 w-8 text-primary" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold font-headline">{joined ? 'Welcome!' : 'Join Workspace'}</CardTitle>
            <CardDescription>
              {inviteError ? 'There was a problem' : joined ? 'Redirecting...' : invitation ? `You've been invited to join ${invitation.workspaceName}` : 'Preparing...'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {inviteError ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3 text-sm border border-destructive/20">
              <AlertCircle className="h-5 w-5 shrink-0" /> {inviteError}
            </div>
          ) : !joined ? (
            <div className="space-y-6">
              {!user ? (
                <div className="space-y-6">
                  <Tabs value={authMode} onValueChange={(v: any) => setAuthMode(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="login">Login</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    <form onSubmit={handleEmailAuth} className="space-y-4 mt-6">
                      {authMode === 'signup' && (
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      </div>
                      {signInError && <div className="text-xs text-destructive">{signInError}</div>}
                      <Button type="submit" className="w-full h-11" disabled={signingIn}>
                        {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : (authMode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
                        {authMode === 'login' ? 'Login & Join' : 'Sign Up & Join'}
                      </Button>
                    </form>
                  </Tabs>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full gap-2 h-11 bg-background/50" onClick={handleGoogleSignIn} disabled={signingIn}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {emailMismatch && invitation?.invitedEmail && (
                    <div className="p-3 text-sm border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg">
                      This invite was sent to <strong>{invitation.invitedEmail}</strong>. Sign out and sign in with that email to join.
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-background/50">
                    <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} className="h-10 w-10 rounded-full" alt="" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold truncate">{user.displayName || 'User'}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </div>
                  <Button className="w-full h-11" onClick={handleJoinWorkspace} disabled={joining || emailMismatch}>
                    {joining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : `Join ${invitation?.workspaceName}`}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 gap-4">
               <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
               <p className="text-sm text-muted-foreground italic">Setting up your workspace...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
