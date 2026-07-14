# Contract: `convex/presence.ts`

## `mutation heartbeat({ sessionId: string })`
- Auth: any authenticated caller.
- Effect: upserts the caller's `presence` row for `sessionId` with
  `lastHeartbeatAt = now`. Called on an interval (e.g. every 10s) by every
  open client session. (FR-002)

## `mutation endSession({ sessionId: string })`
- Auth: any authenticated caller.
- Effect: deletes the caller's `presence` row for `sessionId` (called on
  clean logout/tab close via `beforeunload`, best-effort — unclean
  disconnects rely on staleness instead).

Presence reads are exposed via `users.getUserPresence` and
`servers.listMembers` (see those contracts) rather than a separate query
here, since presence is always consumed alongside profile/member data.
