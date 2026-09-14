import { firebaseConfig } from '@/firebase/config';

/**
 * Which firebaseConfig keys map to which env var name — used to report
 * exactly what's missing, rather than a generic "Firebase failed to
 * initialize" error surfacing later from deep inside the SDK.
 */
const REQUIRED_FIREBASE_ENV_VARS: { configKey: keyof typeof firebaseConfig; envVar: string }[] = [
  { configKey: 'apiKey', envVar: 'NEXT_PUBLIC_FIREBASE_API_KEY' },
  { configKey: 'authDomain', envVar: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN' },
  { configKey: 'projectId', envVar: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' },
  { configKey: 'storageBucket', envVar: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET' },
  { configKey: 'messagingSenderId', envVar: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID' },
  { configKey: 'appId', envVar: 'NEXT_PUBLIC_FIREBASE_APP_ID' },
];

export function getMissingFirebaseEnvVars(): string[] {
  return REQUIRED_FIREBASE_ENV_VARS
    .filter(({ configKey }) => !firebaseConfig[configKey])
    .map(({ envVar }) => envVar);
}
