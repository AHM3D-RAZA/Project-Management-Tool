"use client";

import { NexusShell } from '@/components/NexusShell';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { useNexusStore } from '@/hooks/use-nexus-store';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const { user, isUserLoading, isAuthReady } = useUser();
  const auth = useAuth();
  const store = useNexusStore();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // UI State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bgImage = PlaceHolderImages.find(img => img.id === 'auth-bg');

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return;
      setError('Login failed: ' + (err.message || 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (authMode === 'signup') {
        if (!name.trim()) throw new Error('Name is required');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      let message = "An error occurred during authentication.";
      
      if (err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please check your credentials.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Try logging in instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else {
        message = err.message || message;
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (isUserLoading || !isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full relative flex flex-col items-center justify-center p-4">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0">
          <Image 
            src={bgImage?.imageUrl || 'https://picsum.photos/seed/65/1920/1080'} 
            alt="PSF Project Tracker background" 
            fill 
            className="object-cover"
            priority
            data-ai-hint={bgImage?.imageHint || "modern office"}
          />
          <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
        </div>

        <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-bold font-headline text-primary drop-shadow-sm">PSF Project Tracker</h1>
            <p className="text-muted-foreground font-medium">Manage projects with speed and clarity.</p>
          </div>

          <div className="bg-card/95 p-6 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-md space-y-6">
            <Tabs value={authMode} onValueChange={(v: any) => setAuthMode(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleEmailAuth} className="space-y-4 mt-6">
                {authMode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      placeholder="Jane Doe" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                      className="bg-background/50"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="jane@example.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="bg-background/50"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full gap-2 h-11" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                   authMode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {authMode === 'login' ? 'Login' : 'Create Account'}
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

            <Button variant="outline" className="w-full gap-2 h-11 bg-background/50" onClick={handleGoogleLogin} disabled={loading}>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated but no workspaces, show onboarding (wait for load)
  if (!store.isWorkspacesLoading && store.workspaces.length === 0) {
    return <OnboardingFlow store={store} />;
  }

  return (
    <main className="min-h-screen">
      <NexusShell />
    </main>
  );
}
