# Phase 1 Data Model: Real-Time Chat & Voice/Video Communities

Tables below are expressed independent of Convex syntax first (entity /
fields / relationships / rules), then mapped to the concrete
`convex/schema.ts` table list. Every table that is read by more than one
lookup pattern lists the indexes it needs, per the constitution's "an index
for every access pattern" rule.

## Entities

### User (`users`)
Managed by Convex Auth (password provider); extended with app-specific profile fields.

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"users"> | Convex Auth managed |
| `email` / auth fields | — | Managed by Convex Auth password provider |
| `displayName` | string | Not unique (FR clarification: duplicates allowed) |
| `avatarUrl` | string | |

Indexes: Convex Auth manages its own lookup; no additional index needed for the fields above beyond `by_id` (default).

### Server (`servers`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"servers"> | |
| `name` | string | Renameable by owner (FR-008) |
| `imageUrl` | string \| null | Optional |
| `ownerId` | Id<"users"> | Current owner; reassigned on transfer (FR-032) |
| `inviteCode` | string | Single permanent code/link component (FR-005); unique |
| `createdAt` | number | |

Indexes:
- `by_inviteCode` on `inviteCode` — resolve invite links (FR-006).

### Membership (`serverMembers`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"serverMembers"> | |
| `serverId` | Id<"servers"> | |
| `userId` | Id<"users"> | |
| `joinedAt` | number | Used for ownership-transfer tie-break (research.md #6) |

Indexes:
- `by_server` on `serverId` — list members of a server (FR-007), find longest-tenured member for ownership transfer.
- `by_user` on `userId` — list servers a user belongs to (server rail), and check shared-server eligibility for DMs (FR-020).
- `by_server_and_user` on `[serverId, userId]` — membership/authorization check on every server-scoped request (Constitution IV).

Rules: A row's existence means membership. Owner is derived from `servers.ownerId`, not a flag here (a server has exactly one owner at a time). Deleting a row = removing a member (FR-009); the member may re-insert a row later via a valid invite (rejoin).

### Channel (`channels`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"channels"> | |
| `serverId` | Id<"servers"> | |
| `name` | string | |
| `kind` | "text" \| "voice" | |
| `createdAt` | number | Preserves creation order; the initial "general" channel is created with the server itself |

Indexes:
- `by_server` on `serverId` — list a server's channels (FR-010), ordered by `createdAt`.

Rules: Deleting a channel cascades to delete all its `messages` (FR-012) and end any active `calls` tied to it (Edge Cases).

### Message (`messages`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"messages"> | |
| `channelId` | Id<"channels"> | Only set for channel messages |
| `authorId` | Id<"users"> | |
| `content` | string | |
| `createdAt` | number | |
| `editedAt` | number \| null | Non-null ⇒ show "edited" marker (FR-017) |

Indexes:
- `by_channel_and_createdAt` on `[channelId, createdAt]` — newest-first paginated history with infinite scroll (FR-018).

Rules: Only `authorId === caller` may edit/delete (FR-016, FR-030). Deleting a channel deletes all rows where `channelId` matches.

### Direct Conversation (`directMessageThreads`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"directMessageThreads"> | |
| `userAId` | Id<"users"> | Lower of the two IDs by convention, to keep the pair canonical |
| `userBId` | Id<"users"> | Higher of the two IDs by convention |
| `createdAt` | number | |

Indexes:
- `by_users` on `[userAId, userBId]` — find-or-create the thread for a given pair (FR-020), with IDs sorted before lookup so the pair is always queried the same way regardless of who initiated.

Rules: Creating/opening a thread requires the two users to share at least one `serverMembers` row with matching `serverId` (query both users' `by_user` membership lists and check for overlap) (FR-020).

### Direct Message (`directMessages`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"directMessages"> | |
| `threadId` | Id<"directMessageThreads"> | |
| `authorId` | Id<"users"> | |
| `content` | string | |
| `createdAt` | number | |
| `editedAt` | number \| null | |

Indexes:
- `by_thread_and_createdAt` on `[threadId, createdAt]` — same pagination pattern as channel messages (FR-021).

### Typing Indicator (`typingIndicators`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"typingIndicators"> | |
| `scopeType` | "channel" \| "dmThread" | |
| `scopeId` | string | `channelId` or `threadId` value |
| `userId` | Id<"users"> | |
| `lastTypedAt` | number | Heartbeat timestamp; rows older than ~5s are treated as "not typing" by the query, not deleted eagerly |

Indexes:
- `by_scope` on `[scopeType, scopeId]` — list who's currently typing in a channel/DM (FR-019).
- `by_scope_and_user` on `[scopeType, scopeId, userId]` — upsert this user's heartbeat row.

### Presence (`presence`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"presence"> | |
| `userId` | Id<"users"> | |
| `sessionId` | string | One row per active session/tab (client-generated on load) |
| `lastHeartbeatAt` | number | Row considered live if within staleness window (~30s) |

Indexes:
- `by_user` on `userId` — a user is "online" if ANY of their session rows is live (FR-002 multi-session rule); "offline" once none are.

Rules: A session's row is upserted on heartbeat and removed on clean logout; on unclean disconnect it simply goes stale and is ignored by readers (no separate cleanup job required for correctness, though a periodic sweep MAY delete very old rows for storage hygiene).

### Call (`calls`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"calls"> | |
| `scopeType` | "voiceChannel" \| "dmThread" | |
| `scopeId` | string | `channelId` or `threadId` |
| `startedAt` | number | |
| `endedAt` | number \| null | Set when the last participant leaves, or the channel is deleted |

Indexes:
- `by_scope_active` on `[scopeType, scopeId, endedAt]` — find the current active call for a voice channel/DM (join-or-create logic, FR-022).

### Call Participant (`callParticipants`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"callParticipants"> | |
| `callId` | Id<"calls"> | |
| `userId` | Id<"users"> | |
| `joinedAt` | number | |
| `leftAt` | number \| null | Non-null ⇒ no longer connected |
| `micOn` | boolean | (FR-024) |
| `cameraOn` | boolean | (FR-024) |
| `isSpeaking` | boolean | Updated client-side from local audio-level detection, written at a throttled rate (FR-025) |

Indexes:
- `by_call_active` on `[callId, leftAt]` — list current participants of a call (FR-025, FR-027); enforce the ≤4 active-participant cap on join (FR-023, US5 scenario 7).
- `by_user_active` on `[userId, leftAt]` — find a user's current call (e.g., to disconnect them if removed from the server, Edge Cases).

### Signal (`signals`)

| Field | Type | Notes |
|---|---|---|
| `_id` | Id<"signals"> | |
| `callId` | Id<"calls"> | |
| `fromUserId` | Id<"users"> | |
| `toUserId` | Id<"users"> | Signals are point-to-point between two peers in the mesh |
| `kind` | "offer" \| "answer" \| "ice-candidate" | |
| `payload` | string (JSON) | SDP or ICE candidate payload |
| `createdAt` | number | |

Indexes:
- `by_call_and_recipient` on `[callId, toUserId]` — each peer subscribes only to signals addressed to them for the active call (research.md #4).

Rules: Client-side, each applied signal's `_id` MUST be tracked to avoid re-applying it if the subscription re-delivers the same row (idempotency per Constitution I / research.md #4). Old signal rows for an ended call MAY be deleted for hygiene but are not required for correctness.

## Cross-cutting authorization rule (Constitution IV)

Every query/mutation above MUST, before touching data:
1. Resolve the authenticated caller (`getAuthUserId`); reject if absent.
2. For server-scoped actions: verify a `serverMembers` row exists for
   `(serverId, callerId)` via `by_server_and_user` (reject if not a member).
3. For owner-only actions (rename server, remove member,
   create/rename/delete channel, per FR-031): additionally verify
   `servers.ownerId === callerId`.
4. For message/DM edit-delete: verify `messages.authorId === callerId` (or
   `directMessages.authorId === callerId`) (FR-016, FR-030).

## State transitions

- **Server ownership**: `ownerId` reassigned to the remaining member with the
  earliest `joinedAt` when the current owner's `serverMembers` row is removed
  and other members remain; if none remain, the server and all dependent
  rows (`channels`, `messages`, `serverMembers`, `calls`, etc.) are deleted
  (FR-032).
- **Call lifecycle**: no active `calls` row (by `by_scope_active`) → created
  on first join → `callParticipants` rows added/updated as members join/leave
  → `endedAt` set once the last active participant leaves or the owning
  channel is deleted.
- **Message**: created → optionally edited (`editedAt` set, content replaced)
  → optionally deleted (row removed; channel deletion bulk-deletes all rows
  for that channel).
