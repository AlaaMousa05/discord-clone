# Quickstart: Real-Time Chat & Voice/Video Communities

## Prerequisites

- Node.js and npm installed.
- A Convex account/project (`npx convex dev` will prompt to log in and create
  one on first run).
- Two browser windows/profiles (or one normal + one incognito) to simulate
  two different users.

## Setup

```bash
npm install
npx convex dev      # provisions the Convex deployment, watches convex/ for changes
```

In a second terminal:

```bash
npm run dev          # starts the Vite dev server
```

Create `.env.local` (not committed) with the Convex deployment URL that
`npx convex dev` prints on first run, per Convex's standard setup — no other
secrets are required since Convex Auth manages credentials server-side.

## Validation Scenarios

Each scenario maps to a user story in `spec.md` and should be run manually
against the running dev app (two browser sessions as User A and User B).

### 1. Auth & presence (User Story 1)
1. Sign up as User A in browser 1; sign up as User B in browser 2.
2. Have both join the same server (see scenario 2) so they can see each
   other's status.
3. Confirm User A shows "online" in User B's member list, and vice versa.
4. Close User A's tab; within ~5s (SC-003) User B should see User A go
   "offline".

### 2. Create a server & real-time chat (User Story 2)
1. As User A, create a server ("Test Server"); confirm the "general" text
   channel exists immediately.
2. Copy the invite link (`servers.getInviteLink`) and open it as User B;
   confirm User B becomes a member and sees "general".
3. As User A, send a message in "general"; confirm it appears in User B's
   window within ~1s (SC-002) with name, avatar, timestamp, content.
4. Start typing as User B (without sending); confirm User A sees a typing
   indicator.
5. Send >50 messages (or seed via a script) and confirm scrolling up in the
   channel loads older history incrementally.

### 3. Server/channel/message management (User Story 3)
1. As owner (User A), rename the server; confirm User B sees the new name
   live.
2. Create a new text channel and a voice channel; confirm both appear for
   User B.
3. Delete the text channel; confirm its messages are gone for both users.
4. As User B, edit one of their own messages; confirm it shows an "edited"
   marker for both users. Attempt to edit User A's message as User B and
   confirm it is rejected.
5. As owner, remove User B from the server; confirm User B loses access.
   Rejoin User B via the same invite link and confirm access is restored.

### 4. Direct messages (User Story 4)
1. As User A, open a DM with User B (they share "Test Server").
2. Send, edit, and delete messages in the DM; confirm real-time updates on
   both sides.
3. Create a third user, User C, who does not share any server with User A;
   confirm no DM option is available between A and C.

### 5. Voice/video calls (User Story 5)
1. As User A, join the voice channel created above; confirm the call starts
   and User A's own tile shows local video.
2. As User B, join the same voice channel; confirm both users see each
   other's video tile within ~3s (SC-004), and the channel list shows both as
   connected.
3. Toggle User A's microphone off; confirm User B sees the mute indicator.
4. Speak as User B; confirm User A sees a "speaking" indicator on User B's
   tile.
5. Leave the call as User A; confirm User B's view removes User A's tile.
6. From the DM between User A and User B, start a video call and confirm the
   same join/mute/leave behavior works 1-on-1.
7. Optional: join with a 3rd and 4th participant to confirm the call
   supports up to 4; attempt a 5th join and confirm it is rejected as full.
8. As owner, while User B is connected to a voice channel call, remove User B
   from the server (scenario 3.5 above). Confirm User B's tile disappears
   from User A's `CallView` with no additional code path beyond
   `useWebRTCCall`'s existing "participant no longer in `listCallParticipants`"
   teardown (T046/T052) — `removeMember` ending B's `callParticipants` row is
   sufficient; no explicit "hang up" signal is sent or needed.

## Automated checks

- `npx convex test` (via `convex-test`) runs unit tests for the functions in
  `contracts/` — authorization rejection paths (non-member, non-owner,
  non-author) are the highest-value cases to cover per Constitution IV.
- `npm run test` (Vitest) runs frontend hook/component smoke tests, notably
  `useWebRTCCall`'s signal de-duplication logic (research.md #4) and the
  presence/typing heartbeat hooks.
