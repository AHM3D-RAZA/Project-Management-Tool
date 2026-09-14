import * as Sentry from '@sentry/nextjs';

// Next.js calls this once per runtime on startup. We load the matching
// Sentry config file (server vs. edge) rather than initializing both
// everywhere, since the edge runtime can't run the Node.js SDK.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Reports errors thrown during rendering/data-fetching on the server that
// Next.js catches internally (the client-side error.tsx/global-error.tsx
// boundaries handle the browser side separately).
export const onRequestError = Sentry.captureRequestError;
