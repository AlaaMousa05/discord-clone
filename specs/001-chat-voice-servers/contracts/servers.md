# Contract: `convex/servers.ts` and `convex/serverMembers.ts`

All functions require an authenticated caller. `FORBIDDEN` below always means
"authenticated but not authorized for this resource."

## `mutation createServer({ name: string, imageUrl?: string })`
- Effect: creates the server with `ownerId = caller`, inserts a `serverMembers`
  row for the caller, and creates a default "general" text channel. (FR-003, FR-004)
- Returns: `{ serverId }`

## `mutation renameServer({ serverId: Id<"servers">, name: string })`
- Auth: caller must be the server's `ownerId`. (FR-008, FR-031)
- Errors: `FORBIDDEN` if not owner.

## `query getInviteLink({ serverId: Id<"servers"> })`
- Auth: caller must be a member.
- Returns: `{ inviteCode }` — the single permanent code (FR-005).

## `mutation joinServerByInvite({ inviteCode: string })`
- Auth: any authenticated user.
- Effect: resolves `inviteCode` to a server and inserts a `serverMembers` row
  for the caller if one doesn't already exist. (FR-006)
- Errors: `NOT_FOUND` if the code doesn't resolve to a server.

## `query listMembers({ serverId: Id<"servers"> })`
- Auth: caller must be a member.
- Returns: `Array<{ userId, displayName, avatarUrl, isOnline, isOwner }>` (FR-007)

## `mutation removeMember({ serverId: Id<"servers">, userId: Id<"users"> })`
- Auth: caller must be the server's owner; cannot remove self via this
  function (owner leaving uses `leaveServer`). (FR-009, FR-031)
- Effect: deletes the target's `serverMembers` row; if the target is
  currently in a call in one of the server's voice channels, ends their
  `callParticipants` row too (Edge Cases).
- Errors: `FORBIDDEN` if not owner, `NOT_FOUND` if target isn't a member.

## `mutation leaveServer({ serverId: Id<"servers"> })`
- Auth: caller must be a member.
- Effect: deletes caller's `serverMembers` row. If caller is the owner and
  other members remain, reassigns `ownerId` to the remaining member with the
  earliest `joinedAt` (FR-032, research.md #6). If caller is the owner and no
  members remain, deletes the server and all dependent rows.
