# PSF Project Tracker

A modern project + task management app built with **Next.js (App Router)**, **TypeScript**, **Tailwind**, and **Firebase (Auth + Firestore)**.

## What you get

- **Workspaces** with member roles (admin/owner/lead/member)
- **Projects** and **tasks** (board + list views)
- **Task detail panel** with comments
- **Subtasks** with inline editing + progress indicators
- **Invitations** (email invites) and join flow

## Tech stack

- **Next.js** (App Router)
- **React** + **TypeScript**
- **Tailwind CSS** + shadcn/ui
- **Firebase Auth** + **Cloud Firestore**
- **Resend** (email delivery) via server action + `fetch`

## Prerequisites

- Node.js **18+** (recommended: latest LTS)
- npm (or pnpm/yarn)
- A Firebase project (Firestore + Auth enabled)
- (Optional) A Resend account + API key (for email invites)

## 1) Install dependencies

```bash
npm install
```

## 2) Create a Firebase project

In the Firebase Console:

- **Create a project**
- **Enable Firestore**
  - Start in **production** or **test** mode (your rules will define access)
- **Enable Authentication**
  - Enable **Email/Password**
  - (Optional) enable **Google** provider

Then create a **Web App** in Firebase and copy the config values.

## 3) Configure environment variables

Create a `.env.local` file in the project root.

### Firebase (client)

Add your Firebase web config values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
```

### Resend (email invites)

Email invites use Resend via a server action. Add:

```bash
RESEND_API_KEY="re_..."
```

The default sender is `PSF Project Tracker <onboarding@resend.dev>`.  
For production, use a verified domain/sender in Resend and update the sender in:

- `src/app/actions/send-workspace-invite-email.ts`

### Google Drive Picker (optional)

To enable Google Drive file picker for task attachments, add both your Google OAuth client ID and API key:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
NEXT_PUBLIC_GOOGLE_API_KEY="your-google-api-key"
```

To set up Google Drive Picker:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Picker API and Google Drive API
4. Create OAuth 2.0 credentials (Web application)
   - Add your app's URL to authorized JavaScript origins
   - Copy the client ID to `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
5. Create API credentials (API key)
   - Copy the API key to `NEXT_PUBLIC_GOOGLE_API_KEY`

## 4) Deploy Firestore security rules

This repo includes `firestore.rules`. Deploy them to your Firebase project using the Firebase CLI.

1) Install Firebase tools (one-time):

```bash
npm install -g firebase-tools
```

2) Login and select your project:

```bash
firebase login
firebase use --add
```

3) Deploy rules:

```bash
firebase deploy --only firestore:rules
```

## 5) Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes on invites

- Workspace admins can invite by **email**
- The invited user clicks the email link and completes the **join** flow
- For email invites restricted to the invited email address, the app validates the signed-in user email on join

## Deploying the app

### Option A: Vercel (recommended)

1) Import this repo into Vercel  
2) Add the same environment variables from `.env.local` in Vercel project settings  
3) Deploy

### Option B: Firebase Hosting (advanced)

You can deploy a Next.js app to Firebase Hosting, but it requires additional setup (SSR / functions / rewrites). If you want this path, tell me your preferred hosting approach (SSR vs static export) and I’ll tailor the exact steps for this codebase.

## Known limitations

See [`TODO.md`](./TODO.md) for tracked follow-ups — currently: instant
member backfill on self-service workspace join (needs the Firebase
project on the Blaze plan for a Cloud Function; free-tier workaround is
already in place).

## Troubleshooting

- **“Missing or insufficient permissions” (Firestore)**:
  - Ensure you deployed `firestore.rules` to the correct Firebase project
  - Confirm your app’s `NEXT_PUBLIC_FIREBASE_PROJECT_ID` matches that project
- **Email invites not sending**:
  - Verify `RESEND_API_KEY`
  - Verify your sender domain/address in Resend (for production)
