import type {NextConfig} from 'next';
import {withSentryConfig} from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Re-enabled: the codebase now passes `tsc --noEmit` cleanly, so real
    // type errors should fail the build instead of shipping silently.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Only needed to upload source maps for readable stack traces in
  // Sentry — safe to leave unset (build just skips the upload with a
  // warning). See README.md for setup.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Quiets the CLI in normal dev/build output.
  silent: true,
});
