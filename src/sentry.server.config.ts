// Sentry init for the Node.js server runtime (server components, route
// handlers, server actions). Loaded by instrumentation.ts. See README.md
// for setup.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
