# Contract: `convex/calls.ts` and `convex/signals.ts`

All functions require an authenticated caller who is authorized for the
call's scope: a member of the voice channel's server, or a participant of
the DM thread.

## `mutation joinCall({ scopeType: "voiceChannel" | "dmThread", scopeId: string })`
- Effect: finds the active call for `(scopeType, scopeId)` via
  `by_scope_active`, creating one if none is active; inserts a
  `callParticipants` row for the caller with `micOn: true, cameraOn: true`.
  (FR-022)
- Errors: `CALL_FULL` if 4 active participants already exist (FR-023, US5
  scenario 7).
- Returns: `{ callId, existingParticipants: Id<"users">[] }` so the joining
  client knows who to open peer connections to (full-mesh, research.md #5).

## `mutation leaveCall({ callId: Id<"calls"> })`
- Effect: sets the caller's `callParticipants.leftAt = now`. If no active
  participants remain, sets `calls.endedAt = now`. (FR-026)

## `mutation setMediaState({ callId: Id<"calls">, micOn?: boolean, cameraOn?: boolean })`
- Effect: updates the caller's own `callParticipants` row. (FR-024)

## `mutation setSpeaking({ callId: Id<"calls">, isSpeaking: boolean })`
- Effect: updates the caller's own `callParticipants.isSpeaking`, throttled
  client-side (e.g., at most every 250ms) to avoid write amplification.
  (FR-025)

## `query listCallParticipants({ callId: Id<"calls"> })`
- Returns: `Array<{ userId, micOn, cameraOn, isSpeaking }>` for currently
  active (`leftAt == null`) participants. (FR-025, FR-027)

## `mutation sendSignal({ callId, toUserId, kind: "offer"|"answer"|"ice-candidate", payload: string })`
- Effect: inserts a row into `signals` addressed to `toUserId`.

## `query listIncomingSignals({ callId: Id<"calls"> })`
- Returns: signals where `toUserId === caller`, ordered by `createdAt`.
- Client contract: the caller MUST de-duplicate by `_id` against
  already-applied signals before feeding a row into its `RTCPeerConnection`
  (research.md #4 — idempotency requirement).
