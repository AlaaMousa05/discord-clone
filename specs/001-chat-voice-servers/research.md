# Phase 0 Research: Real-Time Chat & Voice/Video Communities

All Technical Context fields were supplied directly by the user/constitution
(no `NEEDS CLARIFICATION` markers remained), so this research focuses on
validating and documenting the concrete design decisions those choices imply.

## 1. Backend/data platform: Convex vs. a traditional REST+DB+WebSocket stack

- **Decision**: Use Convex as the single database, backend function layer,
  and real-time transport. Reads are Convex queries consumed via `useQuery`
  (automatically reactive); writes are Convex mutations.
- **Rationale**: Convex's reactive query subscriptions remove the need for a
  hand-rolled WebSocket/pub-sub layer to satisfy Real-Time Reliability
  (Constitution I) — every `useQuery` call re-runs and re-renders whenever
  its underlying data changes, which is exactly the "no manual polling"
  requirement. It also gives one typed schema shared by client and server
  (Constitution II) with zero extra plumbing.
- **Alternatives considered**: Node/Express + PostgreSQL + Socket.io was
  rejected as strictly more moving parts (separate DB, separate realtime
  server, hand-written pub/sub) for no functional benefit at this scale — a
  Simplicity/YAGNI (Constitution III) violation. Firebase/Firestore was
  rejected because the user explicitly specified Convex.

## 2. Auth: Convex Auth password provider

- **Decision**: Use `@convex-dev/auth` (Convex Auth) with the password
  provider for sign-up/login (FR-001).
- **Rationale**: First-party integration with Convex's identity
  (`ctx.auth.getUserIdentity()` / `getAuthUserId`) so every query/mutation can
  authenticate the caller in one call, which is required by every function
  under Constitution IV. Avoids standing up a separate auth service.
- **Alternatives considered**: Rolling a custom password+session table was
  rejected — reimplementing hashing/session security is unnecessary risk when
  a maintained provider exists (Constitution III and IV both favor this).

## 3. Presence & typing indicators: heartbeat tables vs. WebSocket connection tracking

- **Decision**: `presence` and `typingIndicators` tables store one row per
  (user, scope) with a `lastActiveAt`/`lastTypedAt` timestamp, refreshed by a
  client-side heartbeat (e.g., every 10s for presence, on each keystroke burst
  for typing, both throttled). Reads filter out rows older than a small
  staleness threshold (e.g., presence stale after ~30s of no heartbeat, typing
  stale after ~5s) so a crashed/closed tab naturally reads as
  offline/not-typing without any explicit disconnect signal.
- **Rationale**: This directly satisfies the Constitution I requirement that
  every real-time feature define its disconnect/reconnect behavior — staleness
  IS the disconnect behavior, with no separate code path needed. It also
  naturally supports FR-002's multi-session rule (online if ANY session's
  heartbeat is fresh) since presence is keyed by (user, session) or by user
  with last-write-wins across sessions, whichever the data model chooses (see
  data-model.md).
- **Alternatives considered**: Tracking presence via Convex's connection
  lifecycle (open/close events) was rejected — Convex does not expose a
  first-class "client disconnected" hook to application code the way a raw
  WebSocket server would, and heartbeat+staleness is the documented Convex
  pattern for presence.

## 4. Voice/video signaling: Convex table vs. dedicated signaling server

- **Decision**: A `signals` table holds rows of `{ callId, fromUserId,
  toUserId, kind: "offer"|"answer"|"ice-candidate", payload, createdAt }`.
  Each peer subscribes (via `useQuery`) to signals addressed to them for the
  active call and applies each to the matching `RTCPeerConnection`.
- **Rationale**: Reuses the same real-time primitive as chat instead of
  introducing a second real-time transport (Socket.io), per Simplicity/YAGNI.
  Because `useQuery` subscriptions can re-deliver the same underlying rows on
  re-render, signal application logic MUST be idempotent — applying the same
  offer/answer twice, or the same ICE candidate twice, MUST be a safe no-op
  (e.g., track already-applied signal IDs client-side). This is the concrete
  form of Constitution I's "idempotent or explicitly de-duplicated" rule for
  this feature.
- **Alternatives considered**: A raw WebSocket signaling server was rejected
  as an unnecessary second real-time system. A hosted signaling/SFU service
  (LiveKit, Twilio) was rejected per explicit user instruction to use native
  `RTCPeerConnection` only.

## 5. Call topology and NAT traversal: full-mesh + STUN-only

- **Decision**: Full-mesh WebRTC — every participant opens a direct
  `RTCPeerConnection` to every other participant in the same call (up to 4
  participants ⇒ up to 6 simultaneous peer connections, 3 per participant).
  ICE servers are limited to Google's public STUN
  (`stun:stun.l.google.com:19302`); no TURN relay is configured.
- **Rationale**: Matches FR-023's "at least 2, target up to 4" scale exactly;
  a full SFU/MCU is unnecessary infrastructure at this ceiling
  (Simplicity/YAGNI). STUN-only is the explicit, accepted v1 tradeoff from
  the constitution — some strict-NAT/symmetric-NAT pairs will fail to
  establish a direct connection with no TURN fallback. This limitation MUST
  be surfaced to the user (e.g., a visible "couldn't connect" state per
  participant) rather than failing silently, to satisfy Constitution I's
  reconciliation requirement.
- **Alternatives considered**: An SFU (e.g., self-hosted mediasoup) would
  handle NAT traversal and scale better but was rejected as premature
  complexity for a 4-participant ceiling, and contradicts the explicit "no
  SDK like LiveKit or Twilio" instruction.

## 6. Ownership transfer selection rule (from spec Assumptions)

- **Decision**: When a server owner leaves or their account is deleted,
  ownership transfers to the remaining member with the earliest
  `serverMembers.joinedAt` timestamp (i.e., the longest-tenured remaining
  member). If no member remains, the server and all its data are deleted.
- **Rationale**: The spec's Assumptions section flagged the exact selection
  rule as an implementation detail deferred to planning; longest-tenured is
  the simplest deterministic rule requiring no additional voting/config UI
  (Simplicity/YAGNI), and is a common, predictable convention.
- **Alternatives considered**: Random selection was rejected as
  non-deterministic and harder to explain/test. Requiring manual designation
  ahead of time was rejected as unnecessary scope beyond the spec's owner/
  member model.

## Outstanding NEEDS CLARIFICATION

None — Technical Context is fully resolved.
