import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function MissingFirebaseConfig({ missingVars }: { missingVars: string[] }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Missing Firebase configuration</CardTitle>
          <CardDescription>
            The app can&apos;t start until these are set in your <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1.5 font-mono text-sm">
            {missingVars.map((v) => (
              <li key={v} className="rounded-md bg-muted px-3 py-1.5 text-destructive">
                {v}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Find these under Firebase Console → Project Settings → Your apps → (Web app) → SDK setup and configuration.
            After adding them, restart <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">npm run dev</code> — Next.js only reads <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> at startup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
