'use client';

import { useEffect } from 'react';

// This catches errors thrown from within the root layout itself — notably
// FirebaseErrorListener (see src/components/FirebaseErrorListener.tsx),
// which is rendered as a sibling of {children} in layout.tsx, not inside
// it. A plain error.tsx only wraps routed page content, not the layout
// that contains it, so it can't catch this. global-error.tsx replaces the
// ENTIRE root layout when active, which is why it has to define its own
// <html>/<body> — it can't rely on layout.tsx's, since that's exactly
// what failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled root-level app error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '28rem',
              background: '#fff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                margin: '0 auto 1rem',
                width: '3rem',
                height: '3rem',
                borderRadius: '9999px',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              ⚠️
            </div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              An unexpected error occurred. This has been logged — reloading usually fixes it.
            </p>
            <button
              onClick={reset}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                marginBottom: '0.5rem',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/')}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
