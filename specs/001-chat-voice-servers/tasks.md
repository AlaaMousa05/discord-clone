---

description: "Task list for Real-Time Chat & Voice/Video Communities"
---

# Tasks: Real-Time Chat & Voice/Video Communities

**Input**: Design documents from `/specs/001-chat-voice-servers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not explicitly requested in spec.md. A minimal set of authorization unit tests (T053) and frontend smoke tests (T056) are included per plan.md's stated testing strategy (`convex-test` + Vitest), not as full TDD coverage.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to US1–US5 from spec.md
- File paths are exact per plan.md's Project Structure

## Notes on gaps closed relative to the design docs

A few underspecified points from `data-model.md`/`contracts/` are resolved concretely in the task descriptions below rather than left ambiguous for implementation time:
- Invite code generation (FR-005) is assigned to `createServer` (T018), since no contract function previously created it.
- Message author enrichment (FR-015) is folded into the message-listing tasks (T022, T039) so clients never need a separate per-message profile lookup.
- Account deletion (FR-032's "deletes their account" branch) gets its own task (T054), reusing the ownership-transfer logic from `leaveServer` (T032).
- "isSpeaking" is implemented as **local, client-only** Web Audio analysis (T047) rather than a Convex-persisted field, since every participant already receives the remote audio track directly over WebRTC — this avoids an unnecessary high-frequency write path through the database (Constitution III, Simplicity & YAGNI).
- The full-mesh signaling protocol's implicit "joiner initiates" convention, per-peer signal routing by `fromUserId`, and connection teardown-on-departure are all made explicit as requirements of `useWebRTCCall` (T046).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize the Vite + React 18 + TypeScript project at the repository root (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`)
- [X] T002 [P] Install and configure Tailwind CSS (`postcss.config.js`, `src/index.css` `@theme`) with a Discord-like dark theme (base colors, spacing scale) — Tailwind v4's CSS-first config is used, so there is no `tailwind.config.js`
- [X] T003 [P] Configure ESLint + Prettier for TypeScript/React in `eslint.config.js` (flat config, as scaffolded) / `.prettierrc`
- [X] T004 Initialize the Convex project scaffold (`convex/` directory, `convex.json`, `convex/tsconfig.json`) — **manual follow-up required**: run `npx convex dev` once to authenticate and generate `convex/_generated/`
- [X] T005 [P] Install React Router and create the empty route shell in `src/main.tsx` and `src/App.tsx`
- [X] T006 [P] Create `.env.local.example` documenting required env vars and confirm `.env.local` is in `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Define all tables and indexes from `data-model.md` in `convex/schema.ts` (`users` profile fields, `servers`, `serverMembers`, `channels`, `messages`, `directMessageThreads`, `directMessages`, `typingIndicators`, `presence`, `calls`, `callParticipants`, `signals`) — `users` reuses Convex Auth's built-in `name`/`image` fields as displayName/avatarUrl rather than duplicating columns; `callParticipants` intentionally has no `isSpeaking` column (computed client-side per T047)
- [X] T008 Configure Convex Auth with the password provider in `convex/auth.ts`, `convex/auth.config.ts`, and `convex/http.ts`; wrap the app with its provider in `src/main.tsx`
- [X] T009 [P] Implement `convex/users.ts`: `getCurrentUser` query and `updateProfile` mutation (`displayName`, `avatarUrl`)
- [X] T010 [P] Implement shared authorization helpers in `convex/lib/authz.ts`: `requireAuth(ctx)`, `requireServerMember(ctx, serverId)`, `requireServerOwner(ctx, serverId)`, `requireAuthor(ctx, entity)` — every function in later phases MUST call the appropriate helper first, per Constitution IV
- [X] T011 [P] Build `src/routes/SignupPage.tsx` and `src/routes/LoginPage.tsx` using the Convex Auth password provider's sign-up/sign-in actions
- [X] T012 Wire routes in `src/App.tsx` for `/signup`, `/login`, `/servers/:serverId/:channelId?`, `/dm/:threadId`, with an auth-gated layout that redirects unauthenticated users to `/login` (placeholder `ServerPage`/`DirectMessagePage` components pending US2/US4)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Sign Up, Log In, and See Who's Online (Priority: P1)

**Goal**: Users can sign up, log in/out, and presence (online/offline, multi-session-aware) is tracked and queryable in real time.

**Independent Test**: The heartbeat/staleness/multi-session-aggregation logic can be verified directly against `convex/presence.ts` (e.g., via `convex-test`) even before any UI consumes it. End-to-end visual confirmation that "User B sees User A go offline" requires a shared-server context, which is introduced in User Story 2 — this is inherent to FR-002 scoping presence visibility to shared-server members, not a sequencing error.

### Implementation for User Story 1

- [X] T013 [P] [US1] Implement `convex/presence.ts`: `heartbeat({ sessionId })` mutation (upserts `presence` row with `lastHeartbeatAt = now`) and `endSession({ sessionId })` mutation (deletes the row)
- [X] T014 [P] [US1] Add `getUserPresence({ userId })` query to `convex/users.ts`: authorized if caller shares a server with `userId` or `userId === caller`; returns `isOnline` computed from whether any of that user's `presence` rows (via `by_user`) is within the staleness window (~30s)
- [X] T015 [US1] Implement `src/hooks/usePresenceHeartbeat.ts`: calls `heartbeat` on an interval (~10s) with a stable per-tab `sessionId`, and calls `endSession` on `beforeunload` — per user feedback, the session id is an in-memory `crypto.randomUUID()` (module-level constant), not persisted to `sessionStorage`
- [X] T016 [US1] Mount `usePresenceHeartbeat` in the authenticated layout in `src/App.tsx` so every logged-in session heartbeats automatically
- [X] T017 [US1] Add an online/offline status dot renderer (`src/components/PresenceDot.tsx`) consuming `getUserPresence`, for reuse by `MemberList` (US2/US3) and DM UI (US4)

**Checkpoint**: Presence infrastructure complete; fully visible once User Story 2's member list exists.

---

## Phase 4: User Story 2 - Create a Server and Chat in Real Time (Priority: P1) 🎯 MVP

**Goal**: A user can create a server (with its default "general" channel), invite another user, and both can exchange real-time text messages with typing indicators and infinite-scroll history.

**Independent Test**: Create a server, join it as a second user via invite link, and confirm messages sent by either member appear for the other without a refresh.

### Implementation for User Story 2

- [X] T018 [P] [US2] Implement `convex/servers.ts` `createServer({ name, imageUrl? })`: creates the server with `ownerId = caller` and a freshly generated unique `inviteCode` (e.g., random URL-safe token, retried on collision against `by_inviteCode`), inserts the caller's `serverMembers` row, and creates the default "general" text `channel` (FR-003, FR-004, FR-005) — also added `listMyServers` (not in the original contract) since `ServerRail` needs it
- [X] T019 [P] [US2] Implement `getInviteLink({ serverId })` query and `joinServerByInvite({ inviteCode })` mutation in `convex/servers.ts` (resolve via `by_inviteCode`; insert a `serverMembers` row for the caller if not already a member) (FR-005, FR-006)
- [X] T020 [P] [US2] Implement `convex/serverMembers.ts` `listMembers({ serverId })`: returns each member's `displayName`, `avatarUrl`, `isOwner` (compare to `servers.ownerId`), and `isOnline` (reusing T014's presence logic) (FR-007)
- [X] T021 [P] [US2] Implement `convex/channels.ts`: `listChannels({ serverId })` query (ordered by `createdAt`) and `createChannel`/`renameChannel`/`deleteChannel` mutations, all owner-only via `requireServerOwner`; `deleteChannel` cascades deletion of the channel's `messages` (FR-010, FR-011, FR-012)
- [X] T022 [US2] Implement `convex/messages.ts` `sendMessage({ channelId, content })` and `listMessages({ channelId, paginationOpts })`: the list query returns messages newest-first via Convex's built-in cursor pagination (`paginationOptsValidator`/`.paginate()`, used instead of a hand-rolled `before`/`limit` cursor), each row enriched with the author's `displayName`/`avatarUrl` (batched lookup against `users`, not a per-message client-side join) (FR-013, FR-014, FR-015, FR-018)
- [X] T023 [US2] Implement `convex/typingIndicators.ts` `setTyping({ scopeType: "channel", scopeId })` mutation and `listTypingUsers({ scopeType, scopeId })` query (filters to rows within the ~5s staleness window, excluding the caller) (FR-019)
- [X] T024 [P] [US2] Build `src/components/ServerRail.tsx` and `src/components/ChannelSidebar.tsx` (channel list via `listChannels`, grouped by `kind`)
- [X] T025 [P] [US2] Build `src/components/ChatPane.tsx`, `src/components/MessageItem.tsx` (author name/avatar/timestamp/content), and `src/components/MessageComposer.tsx` (calls `sendMessage`)
- [X] T026 [US2] Add newest-first infinite-scroll-up pagination to `ChatPane.tsx`, using Convex's `usePaginatedQuery` (matching T022's backend pagination style) with a scroll handler that calls `loadMore` near the oldest loaded message (depends on T022, T025)
- [X] T027 [US2] Build `src/components/TypingIndicatorBar.tsx` and `src/hooks/useTypingHeartbeat.ts` (calls `setTyping` on keystroke, throttled), wired into `MessageComposer.tsx` (depends on T023, T025)
- [X] T028 [US2] Build `src/routes/ServerPage.tsx` composing `ServerRail` + `ChannelSidebar` + `ChatPane` + `MemberList` (member list now shows real presence from US1) (depends on T017, T020, T024, T025) — also built `src/components/MemberList.tsx` itself, which tasks.md referenced here and in T042 but never scheduled as its own task
- [X] T029 [US2] Add a "create server" modal/form (invokes `createServer`) and an invite-link landing flow (route that calls `joinServerByInvite`, prompting login/signup first if unauthenticated, per Edge Cases) (depends on T018, T019) — implemented via `CreateServerModal.tsx`, `InvitePage.tsx`, and a `state.from` return-to-destination flow in `AuthGate`/`LoginPage`/`SignupPage` so an unauthenticated invite click returns to the invite after login. Also added `InviteButton.tsx` (not in the original task) since nothing otherwise exposed `getInviteLink` in the UI — without it FR-005's "owner shares an invite link" scenario had no way to actually get a link to share

**Checkpoint**: User Stories 1 AND 2 fully functional and independently testable — this is the MVP.

---

## Phase 5: User Story 3 - Manage Servers, Channels, and Messages (Priority: P2)

**Goal**: The owner can rename the server, manage channels, and remove members; any author can edit/delete their own messages.

**Independent Test**: As owner, rename the server, create/rename/delete a channel, and remove a member; as a message author, edit and delete a message — each independently of the other stories.

### Implementation for User Story 3

- [X] T030 [P] [US3] Add `renameServer({ serverId, name })` mutation to `convex/servers.ts`, owner-only via `requireServerOwner` (FR-008, FR-031) — this landed earlier than scheduled, alongside `createServer` in the US1/US2 pass
- [X] T031 [P] [US3] Add `removeMember({ serverId, userId })` mutation to `convex/serverMembers.ts`, owner-only; if the target has an active `callParticipants` row in one of the server's voice channels, close it too (Edge Cases) (FR-009, FR-031)
- [X] T032 [P] [US3] Add `leaveServer({ serverId })` mutation to `convex/serverMembers.ts`: deletes the caller's `serverMembers` row; if the caller was the owner and other members remain, reassigns `servers.ownerId` to the member with the earliest `joinedAt` (research.md #6); if no members remain, deletes the server and all dependent rows (`channels`, `messages`, `calls`, etc.) (FR-032)
- [X] T033 [US3] Add `editMessage({ messageId, content })` and `deleteMessage({ messageId })` mutations to `convex/messages.ts`, author-only via `requireAuthor`; `editMessage` sets `editedAt` (FR-016, FR-017, FR-030)
- [X] T034 [US3] Add edit/delete controls (visible only to the author) and the "edited" marker to `src/components/MessageItem.tsx` (depends on T033) — required refactoring `ChatPane`/`MessageComposer`/`MessageItem` to be scope-generic (props/callbacks instead of hardcoded channel calls) so T041 could reuse them for DMs without duplicating a parallel component tree; added `ChannelChatPane.tsx` as the channel-specific data-fetching wrapper around the now-generic `ChatPane`
- [X] T035 [US3] Add a server-settings UI (rename server, member list with an owner-only "remove" action) — new `src/components/ServerSettingsPanel.tsx`, opened from `ServerPage.tsx` (depends on T030, T031) — also added `servers.getServer` query (no prior query exposed the current server name/ownerId to the client)
- [X] T036 [US3] Add owner-only channel management controls (create/rename/delete) to `src/components/ChannelSidebar.tsx` (depends on T021)
- [X] T037 [US3] In `src/routes/ServerPage.tsx`, watch `listChannels` and redirect to the "general" channel if the currently active `channelId` disappears (covers the channel-deleted-while-viewing edge case) (depends on T028, T021)

**Checkpoint**: User Stories 1–3 fully functional.

---

## Phase 6: User Story 4 - Direct Messages (Priority: P2)

**Goal**: Any two users who share a server can open a 1-on-1 DM with the same real-time/edit/delete behavior as a channel.

**Independent Test**: Two users sharing a server open a DM and exchange, edit, and delete messages in real time; a third user with no shared server cannot open a DM with either.

### Implementation for User Story 4

- [X] T038 [P] [US4] Implement `getOrCreateDmThread({ otherUserId })` in `convex/directMessages.ts`: canonicalizes the pair as `(min(id), max(id))` before lookup/insert into `directMessageThreads`; authorized only if the caller and `otherUserId` share a `serverMembers` row (overlap check via `by_user` on both sides) (FR-020) — also added `getThreadInfo` (not in the original contract) to resolve the DM partner's profile for the page header
- [X] T039 [P] [US4] Implement `listDirectMessages`, `sendDirectMessage`, `editDirectMessage`, `deleteDirectMessage` in `convex/directMessages.ts`, mirroring `convex/messages.ts`'s pagination and author-enrichment pattern (T022, T033) (FR-021)
- [X] T040 [P] [US4] Extend `convex/typingIndicators.ts` usage to `scopeType: "dmThread"` (schema already polymorphic; no migration needed) (FR-019 applied to DMs) — satisfied entirely by `ChatPane`'s generic `scope` prop; no code change to `typingIndicators.ts` itself was needed
- [X] T041 [US4] Build `src/routes/DirectMessagePage.tsx`, reusing `ChatPane`/`MessageItem`/`MessageComposer`/`TypingIndicatorBar` against the DM thread (depends on T025, T027, T038, T039) — added `DmChatPane.tsx` as the DM-specific data-fetching wrapper (mirrors `ChannelChatPane.tsx`); also includes `ServerRail` so a DM isn't a navigation dead-end
- [X] T042 [US4] Add a "message this user" entry point in `src/components/MemberList.tsx` that calls `getOrCreateDmThread` and navigates to `/dm/:threadId` (depends on T038)

**Checkpoint**: User Stories 1–4 fully functional.

---

## Phase 7: User Story 5 - Voice and Video Calls (Priority: P3)

**Goal**: A member can join a voice channel (or a DM) to start/join a live call with up to 4 participants, toggle mic/camera, see video tiles and speaking/mute state, and leave.

**Independent Test**: Two members join the same voice channel and confirm each sees the other's video tile, mute state, and speaking indicator, and can leave independently of any text-channel activity.

### Implementation for User Story 5

- [X] T043 [P] [US5] Implement `convex/calls.ts`: `joinCall({ scopeType, scopeId })` (finds/creates the active call via `by_scope_active`, rejects with `CALL_FULL` at 4 active participants, returns `{ callId, existingParticipants }`), `leaveCall({ callId })`, `listCallParticipants({ callId })`, `setMediaState({ callId, micOn?, cameraOn? })` (FR-022, FR-023, FR-024, FR-026) — also added `getActiveCallForScope` (DM calls need this to show "Join" vs "Start" without first calling `joinCall`); `channels.listChannels` and `channels.deleteChannel` were extended to enrich voice channels with `connectedVoiceUserIds` and to end an active call on channel deletion, respectively, now that `calls`/`callParticipants` exist
- [X] T044 [P] [US5] Implement `convex/signals.ts`: `sendSignal({ callId, toUserId, kind, payload })` mutation and `listIncomingSignals({ callId })` query (filtered to `toUserId === caller` via `by_call_and_recipient`) — no speaking-state signaling here (see T047)
- [X] T045 [US5] Implement `src/lib/webrtc.ts`: an `RTCPeerConnection` factory configured with STUN-only ICE servers (`stun:stun.l.google.com:19302`)
- [X] T046 [US5] Implement `src/hooks/useWebRTCCall.ts`, the full-mesh peer manager:
  - On `joinCall` returning a non-empty `existingParticipants`, the joining client is the **initiator**: it creates one `RTCPeerConnection` per existing participant and sends each an offer (existing participants never initiate on seeing a new participant appear — this is a fixed protocol rule to avoid offer/answer glare)
  - Routes every row from `listIncomingSignals` to the peer connection keyed by that row's `fromUserId`, creating one if it doesn't exist yet
  - Tracks applied signal `_id`s and ignores already-applied rows (idempotency against subscription re-delivery, per Constitution I)
  - Closes and discards a peer connection when the corresponding participant's `listCallParticipants` row disappears or its `leftAt` is set
  - **Bug found and fixed during real-browser verification**: `listCallParticipants` returns every active participant *including the caller*; the hook now fetches the current user and filters them out before building peer/UI state, otherwise the caller got a duplicate self-tile
  - **Bug found and fixed during real-browser verification**: an earlier version called `leaveCall` from this hook's unmount cleanup ("leave when the component unmounts"). Under React 18 StrictMode's dev-mode mount→cleanup→remount cycle this ended every call immediately after joining (confirmed via `npx convex data calls` showing `startedAt`≈`endedAt` for every row). Removed entirely — leaving is now only the explicit `leave()` call wired to the "Leave Call" button; the hook's unmount cleanup only tears down local peer connections/media/audio context. Known tradeoff: a user who closes the tab without clicking "Leave Call" remains a server-side participant (same class of limitation as presence's heartbeat staleness)
  - (depends on T043, T044, T045)
- [X] T047 [US5] Add local speaking detection to `useWebRTCCall.ts`: attach a Web Audio `AnalyserNode` to each remote `MediaStream` and derive a per-participant `isSpeaking` boolean as local React state — no Convex write path for this value (depends on T046)
- [X] T048 [P] [US5] Build `src/components/VoiceChannelPanel.tsx`: shows connected members per voice channel, derived from `listChannels`'s per-channel connected-user list (backed by `listCallParticipants`) (FR-027)
- [X] T049 [US5] Build `src/components/CallView.tsx`: video tiles, mic/camera toggle buttons (call `setMediaState`), mute/speaking indicators (from T047), leave-call button (calls `leaveCall`) (depends on T046, T047)
- [X] T050 [US5] Wire "join voice channel" in `src/components/ChannelSidebar.tsx` (voice-kind channels) to `joinCall` + `useWebRTCCall` + `CallView` (depends on T046, T049)
- [X] T051 [US5] Add a "start video call" entry point in `src/routes/DirectMessagePage.tsx` using `scopeType: "dmThread"`, reusing `joinCall`/`useWebRTCCall`/`CallView` (FR-028) (depends on T041, T046, T049)
- [X] T052 [US5] In `removeMember` (T031)'s corresponding client flow, confirm that closing a removed member's `callParticipants` row is picked up by other participants' `useWebRTCCall` teardown logic (T046) with no additional signal required — added the explicit assertion to `quickstart.md` scenario 5, step 8, no new code

**Checkpoint**: All five user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and verification that span multiple user stories

- [X] T053 [P] `convex-test` unit tests for `convex/lib/authz.ts` (T010) covering non-member, non-owner, and non-author rejection paths across `servers.ts`, `channels.ts`, `messages.ts` — the highest-value coverage per Constitution IV — implemented in `convex/lib/authz.test.ts` (9 cases); added `vitest`/`convex-test`/`@edge-runtime/vm` toolchain (`vitest.config.ts`, `npm test`)
- [X] T054 [P] Add `deleteAccount()` mutation to `convex/users.ts`: for every server the caller owns (found via the caller's `serverMembers` `by_user` rows filtered to `servers.ownerId === caller`), reuse `leaveServer`'s transfer/delete logic (T032); then remove the caller's `serverMembers` rows across all remaining servers — closes FR-032's "deletes their account" branch — `leaveServer`'s body was extracted to the shared `removeMemberAndHandleOwnership` helper in `convex/serverMembers.ts` so both mutations share one code path; covered by `convex/users.test.ts` (ownership transfer, last-member server deletion, unaffected-other-server cases). No UI entry point was in scope for this task.
- [X] T055 [P] Full Tailwind dark-theme pass across `ServerRail`, `ChannelSidebar`, `MemberList`, `ChatPane`, `CallView` for visual consistency with plan.md's Discord-like layout spec — the existing `@theme` token system (T002) was already applied consistently everywhere, so this pass closed the remaining gaps rather than reworking the palette:
  - Fixed a real inconsistency: `ChannelChatPane` had no channel-name header (unlike `DirectMessagePage`'s DM header) and hardcoded the composer placeholder to `Message #general` regardless of the actual channel — added a `# channelName` header bar and a correct per-channel placeholder
  - Extracted a shared `src/components/Modal.tsx` (overlay + panel, Escape-to-close, click-outside-to-close, `border-border`/`shadow-2xl` treatment) and migrated `CreateServerModal`, `ServerSettingsPanel`, `InviteButton`'s dialog onto it, replacing three near-duplicate ad-hoc overlay implementations that previously had no Escape/click-outside handling at all
  - Added global thin dark scrollbars (`src/index.css`) so browser-default light scrollbar chrome no longer clashes with the dark theme in any scrollable pane
  - Swept interactive elements for consistent `transition-colors`/`transition-all` and `focus-visible:ring-2 focus-visible:ring-accent` (buttons, links, and text inputs previously varied on both) across `ServerRail`, `ChannelSidebar`, `MessageItem`, `MessageComposer`, `MemberList`, `CallView`, `LoginPage`/`SignupPage`, `DirectMessagePage`
  - `CallView`'s overlay and video tiles gained `backdrop-blur-sm`/`shadow-lg` for a more premium glass feel; `LoginPage`/`SignupPage` panels now match the modal/settings panel's `border-border`/`shadow-2xl` treatment
  - Verified via `tsc -b`, `eslint .`, `vitest run` (17/17 passing), and `vite build` — no visual/browser regression check was performed (no browser-automation tool available in this session); recommend a manual pass alongside T057
- [X] T056 [P] Vitest + React Testing Library smoke tests: `useWebRTCCall`'s signal de-duplication/idempotency (T046) and `usePresenceHeartbeat`'s heartbeat/cleanup behavior (T015) — `src/hooks/useWebRTCCall.test.tsx` (2 cases, mocking `convex/react`/`RTCPeerConnection`), `src/hooks/usePresenceHeartbeat.test.tsx` (3 cases)
- [X] T057 Run `quickstart.md` validation scenarios 1–5 end-to-end with two manual browser sessions (and a 3rd/4th for the call-capacity check) — completed manually by the user against the local dev deployment; also surfaced and fixed two real defects along the way: an invalid `JWT_PRIVATE_KEY`/`JWKS` pair on the local deployment (was symmetric/HS256 placeholder data instead of the RS256 PKCS#8 keypair Convex Auth requires — regenerated via `jose`'s `generateKeyPair("RS256")`/`exportPKCS8`/`exportJWK`, matching `@convex-dev/auth`'s own CLI), and a stale-session infinite-refresh loop caused by resetting the local backend while a browser tab held an old session (resolved by clearing `__convexAuthJWT`/`__convexAuthRefreshToken` client-side)
- [X] T058 Informally verify SC-001–SC-009 against the running app (message delivery/presence/call-join timing, 500-message scroll performance, channel-delete cascade correctness) — confirmed working by the user; "manual validation is successful and everything works perfectly"

---

## Phase 9: Deployment (Convex Production + Vercel)

**Purpose**: Take the app live on a real Convex production deployment and a public Vercel URL, replacing the anonymous local-only dev deployment used through Phase 8

**Decisions locked in for this phase**: new Convex account (created via the interactive `npx convex login` step); Vercel deployment via GitHub auto-deploy (not the bare `vercel` CLI) — this repo had no git history before this phase, so T059 initializes it

- [X] T059 Initialize git for the repo (`git init`, default branch renamed to `main`) and make the initial commit — verified `.gitignore` already excludes `node_modules`, `dist`, and `.env.local` (and `.convex/local` is separately excluded by its own nested `.gitignore`) before staging, so no secrets or generated artifacts were committed
- [X] T060 Create a GitHub repository and push `main` to it — https://github.com/AlaaMousa05/discord-clone
- [X] T061 `npx convex login` (user action — interactive browser OAuth; new Convex account `alaa-mousa025`)
- [X] T062 `npx convex deploy` — production deployment `alaa-mousa025:discord-clone:production` (`agile-kangaroo-768`) created and serving `schema.ts` + all Convex functions at `https://agile-kangaroo-768.convex.cloud`
- [X] T063 Configure production auth keys: generated a fresh RS256 PKCS#8 `JWT_PRIVATE_KEY`/`JWKS` pair via `jose.generateKeyPair("RS256")` → `exportPKCS8`/`exportJWK`, piped directly into `npx convex env set --prod` (value passed via stdin, never written to a file or printed) — confirmed independent from the local dev deployment's keypair, not reused
- [X] T064 Set `SITE_URL` on the production deployment to `https://discord-clone-chi-plum.vercel.app` via `npx convex env set --prod SITE_URL ...`
- [X] T065 Imported the GitHub repo into Vercel; Framework Preset Vite, Build Command `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL`, Output Directory `dist`
- [X] T066 Added `CONVEX_DEPLOY_KEY` as a Vercel project environment variable — generated by the user directly via `npx convex deployment token create --prod` and pasted only into Vercel's UI (kept out of chat/disk this time); the first key generated earlier in this phase was pasted into chat and revoked as compromised before this one was created
- [X] T067 First Vercel deploy succeeded — live at https://discord-clone-chi-plum.vercel.app; looped back and completed T064 above with this exact URL
- [~] T068 Smoke-test the live production URL end-to-end (sign up, create a server, send a message, start a voice call). Automated read-only checks passed: page returns HTTP 200, the shipped JS bundle resolves to `agile-kangaroo-768.convex.cloud` with zero `localhost`/`127.0.0.1` references, and `/.well-known/jwks.json` serves the correct single RSA key. Writing a real signup/test record directly into production via CLI was deliberately not done unilaterally (no explicit authorization for that write) — the interactive walkthrough itself (sign up, create server, message, second-user invite join, voice join) is pending the user's own pass against the live URL
- [X] T069 Fixed a deployment-config bug found during the user's manual T068 walkthrough: opening a shared invite link (`/invite/:inviteCode`) directly returned Vercel's own HTTP 404, before the React app ever loaded — confirmed via `curl` that `/login` and `/invite/...` both 404'd while `/` returned 200. Root cause: no `vercel.json` SPA-fallback rewrite for this `BrowserRouter` app, so Vercel's static file server had no rule to fall back to `index.html` for routes that aren't real files on disk. Added `vercel.json` with a catch-all rewrite to `index.html` (Vercel's documented pattern for client-side-routed SPAs). Also hardened `src/routes/InvitePage.tsx`, which had a real secondary defect: `joinServerByInvite`'s promise had no `.catch`, so an invalid/expired invite code would leave the page stuck on "Joining server…" forever with no feedback — now shows an error message with a way back home. Verified `tsc -b`/`eslint .`/`vitest run` (17/17)/`vite build` before pushing; pushed to `main` to trigger the connected Vercel auto-deploy

**Checkpoint**: App is live on a public Vercel URL backed by a real Convex production deployment, fully independent of the local anonymous dev deployment used for Phases 1–8

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational only (does not require US1's UI, but the full member-list presence display in T028 pulls in US1's T017)
- **User Story 3 (Phase 5)**: Depends on Foundational + US2 (extends `servers.ts`/`channels.ts`/`messages.ts` created in US2)
- **User Story 4 (Phase 6)**: Depends on Foundational + US2 (reuses `ChatPane`/`MessageComposer` and needs `serverMembers` from US2 for the shared-server check)
- **User Story 5 (Phase 7)**: Depends on Foundational + US2 (voice channels from `channels.ts`) + US4 (DM calls reuse `directMessageThreads`)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies (summary)

- US1: No dependency on other stories (infrastructure only; full visual confirmation needs US2's member list)
- US2: No dependency on other stories — this is the MVP
- US3: Extends US2's entities; not independently buildable before US2
- US4: Reuses US2's messaging components and membership data; not independently buildable before US2
- US5: Builds on US2 (voice channels) and US4 (DM calls); the voice-channel-only path does not require US4, but the "start call from DM" path (T051) does

### Parallel Opportunities

- All `[P]` Setup tasks (T002, T003, T005, T006) in parallel after T001
- Foundational `[P]` tasks (T009, T010, T011) in parallel after T007/T008
- Within US2, T018–T021 (four independent Convex modules) in parallel; T024–T025 (independent components) in parallel
- Within US3, T030–T032 (three independent mutations, different concerns in different files/functions) in parallel
- Within US5, T043–T044 (Convex) in parallel with each other; T048 in parallel with T045–T047
- Across stories: once Foundational is done, US2 and US1 can be staffed in parallel; US3/US4 can start as soon as US2's core files exist, even before US2's UI polish tasks finish, if multiple developers are working

---

## Parallel Example: User Story 2

```bash
# Launch independent Convex modules together:
Task: "Implement convex/servers.ts createServer in convex/servers.ts"
Task: "Implement convex/serverMembers.ts listMembers in convex/serverMembers.ts"
Task: "Implement convex/channels.ts listChannels/createChannel/renameChannel/deleteChannel in convex/channels.ts"

# Launch independent UI components together:
Task: "Build ServerRail and ChannelSidebar in src/components/ServerRail.tsx and src/components/ChannelSidebar.tsx"
Task: "Build ChatPane, MessageItem, MessageComposer in src/components/ChatPane.tsx, MessageItem.tsx, MessageComposer.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything else)
3. Complete Phase 3: User Story 1 (presence infrastructure)
4. Complete Phase 4: User Story 2 (server creation + real-time chat)
5. **STOP and VALIDATE**: run `quickstart.md` scenarios 1–2 with two browser sessions
6. Deploy/demo if ready — this is a usable Discord-like text-chat MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 + US2 → MVP (auth, presence, servers, channels, real-time chat) → validate → demo
3. US3 → management/moderation layered on top → validate → demo
4. US4 → direct messages → validate → demo
5. US5 → voice/video calls → validate → demo (final feature set)

### Parallel Team Strategy

With multiple developers, after Foundational is done:
- Developer A: US1 → US3 (both extend the server/member model)
- Developer B: US2 (core chat, the critical path most other stories depend on)
- Developer C: US4 → US5 (once US2's messaging components and US4's threads exist)
