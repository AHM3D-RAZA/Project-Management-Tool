
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Rocket, Layout, FolderOpen, ListTodo, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingFlowProps {
  store: any;
}

export function OnboardingFlow({ store }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const [taskTitle, setTaskTitle] = useState('');

  const handleComplete = async () => {
    setLoading(true);
    try {
      // 1. Create Workspace
      const wsId = await store.createWorkspace(wsName, wsDesc);
      if (!wsId) throw new Error("Failed to create workspace");

      // 2. Create Project (optional)
      let projId: string | null = null;
      if (projName.trim()) {
        projId = await store.createProject(wsId, projName, projDesc);
        if (!projId) throw new Error("Failed to create project");
      }

      // 3. Create Task (optional)
      if (projId && taskTitle.trim()) {
        await store.createTask(wsId, projId, {
          title: taskTitle.trim(),
          status: 'todo',
          priority: 'medium',
          assigneeUserId: store.currentUser.id,
        });
      }

      // Store's internal state will update, triggering re-render of page.tsx
    } catch (error) {
      console.error("Onboarding failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);
  const hasProjectName = Boolean(projName.trim());
  const canCreateTask = hasProjectName && Boolean(taskTitle.trim());

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-2">
            <Rocket className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold font-headline">Welcome to PSF Project Tracker</h1>
          <p className="text-muted-foreground">Let's set up your first workspace to get you started.</p>
        </div>

        <div className="flex justify-between max-w-xs mx-auto mb-4">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                step === s ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20" : 
                step > s ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {s}
            </div>
          ))}
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 1 && <><Layout className="w-5 h-5 text-primary" /> Create Your Workspace</>}
              {step === 2 && <><FolderOpen className="w-5 h-5 text-primary" /> Start a Project</>}
              {step === 3 && <><ListTodo className="w-5 h-5 text-primary" /> Add a Task</>}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Workspaces are top-level containers for your team and projects."}
              {step === 2 && "Projects are optional. You can skip and add them later."}
              {step === 3 && "Break down your work into manageable tasks (optional)."}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 py-4 min-h-[250px] flex flex-col justify-center">
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Workspace Name</Label>
                  <Input 
                    id="ws-name" 
                    placeholder="e.g. Engineering, Marketing, Home Ops" 
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-desc">Description (Optional)</Label>
                  <Textarea 
                    id="ws-desc" 
                    placeholder="Briefly describe the purpose of this workspace"
                    value={wsDesc}
                    onChange={(e) => setWsDesc(e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="proj-name">Project Name</Label>
                  <Input 
                    id="proj-name" 
                    placeholder="e.g. Mobile App Redesign, Campaign Launch" 
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-desc">Description (Optional)</Label>
                  <Textarea 
                    id="proj-desc" 
                    placeholder="What's this project about?"
                    value={projDesc}
                    onChange={(e) => setProjDesc(e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="task-title">First Task Title</Label>
                  <Input 
                    id="task-title" 
                    placeholder="e.g. Design wireframes, Initial research" 
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground italic">You can add more tasks, assignees, and deadlines once you're on the dashboard.</p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-6 bg-muted/30 rounded-b-lg">
            {step > 1 ? (
              <Button variant="ghost" onClick={prevStep} disabled={loading}>
                Back
              </Button>
            ) : <div />}
            
            <div className="flex gap-3">
              {step < 3 ? (
                <Button 
                  onClick={nextStep} 
                  disabled={step === 1 ? !wsName.trim() : false}
                  className="gap-2"
                >
                  {step === 2 && !hasProjectName ? 'Skip Project & Continue' : 'Continue'}{' '}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button 
                  onClick={handleComplete} 
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {canCreateTask ? 'Create & Launch' : 'Skip Task & Launch'}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
