// Sentry init for the browser. Runs once, early, before hydration.
// No-ops automatically when NEXT_PUBLIC_SENTRY_DSN isn't set, so this is
// safe to ship even in environments (like local dev) with no Sentry
// project configured — see README.md for setup.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Basic error tracking only for now — no session replay, no performance
  // tracing beyond Sentry's low default, to keep this a contained,
  // "turn errors into issues" integration rather than a bigger observability
  // build-out.
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
