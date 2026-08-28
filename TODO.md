# Known limitations / planned follow-ups

## Instant member backfill on self-service join (needs Blaze plan)

**Where:** `src/lib/member-sync.ts`, `src/hooks/use-nexus-store.ts` (the
`pendingMemberSync` effect), `src/app/join/[inviteId]/page.tsx`,
`firestore.rules` (`Workspace.pendingMemberSync` handling in
`isAcceptingInvite`).

**Current behavior:** when someone joins a workspace via a self-service
invite (link or email), they can't yet see pre-existing projects/tasks/etc.
immediately — Firestore's list-query security model means a brand-new
member's own client can't backfill its own membership onto documents it
isn't allowed to list yet (see the comments in `member-sync.ts` for the
full explanation). Instead, they set a `pendingMemberSync` flag on the
workspace, and the fix runs automatically the next time *any admin's*
client has that workspace open — which in practice is almost always
within moments, but isn't instant if no admin happens to be active.

**The proper fix:** a Cloud Function that triggers the moment
`workspaces/{id}.memberRoles` changes and runs the same sync
server-side with the Admin SDK (which bypasses the list-permission
chicken-and-egg problem entirely, since it doesn't go through security
rules). This closes the gap completely — no waiting on an admin at all.

**Why it isn't done yet:** Cloud Functions cannot be deployed on
Firebase's free Spark plan under any circumstances, even for a function
this small — it requires upgrading the Firebase project to the Blaze
(pay-as-you-go) plan, which means **linking a real credit card** to the
project. In practice this specific fix would cost **$0/month** — Blaze's
free monthly quota (2,000,000 invocations, 400,000 GB-seconds compute,
5 GB egress) comfortably covers it — but the card has to be on file
regardless of whether anything is ever actually billed.

**Action needed before starting this:** confirm you're OK linking a
card to the Firebase project (Console → Project Settings → Usage and
Billing → Upgrade to Blaze). Once that's done, this becomes a
straightforward addition — a `functions/` directory, one Firestore
`onUpdate` trigger on `workspaces/{workspaceId}`, deployed via
`firebase deploy --only functions`.
