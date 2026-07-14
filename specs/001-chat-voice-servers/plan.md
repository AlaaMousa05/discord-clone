# Implementation Plan: Real-Time Chat & Voice/Video Communities

**Branch**: `001-chat-voice-servers` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-chat-voice-servers/spec.md`

## Summary

A Discord-style web app: users sign up/log in, create servers with text and
voice channels, chat in real time (edit/delete/typing/infinite scroll),
message each other via 1-on-1 DMs, and join voice/video calls (up to 4
participants) in a voice channel or from a DM. Built as a single-repo React +
Vite frontend backed entirely by Convex (database, queries/mutations, auth,
and presence/signaling tables), with voice/video handled by native WebRTC in a
full-mesh topology using public STUN only (no TURN, no SDK).

## Technical Context

**Language/Version**: TypeScript (strict mode) throughout — React 18 frontend, Convex functions (Node/V8 runtime managed by Convex)

**Primary Dependencies**: React 18, React Router, Tailwind CSS, Vite, Convex (`convex` package + Convex Auth password provider), native browser `RTCPeerConnection` API (no WebRTC SDK)

**Storage**: Convex tables (defined in `convex/schema.ts`): `users`, `servers`, `serverMembers`, `channels`, `messages`, `directMessageThreads`, `directMessages`, `typingIndicators`, `presence`, `calls`, `callParticipants`, `signals`

**Testing**: `convex-test` for Convex query/mutation unit tests; Vitest + React Testing Library for frontend component/hook smoke tests; manual scenario walkthroughs in `quickstart.md` for real-time and WebRTC flows that are impractical to fully automate

**Target Platform**: Modern desktop browsers with WebRTC support (Chrome/Edge/Firefox), served as a web app

**Project Type**: Web application — single repo, Vite frontend at the root + Convex backend functions in `convex/`

**Performance Goals**: Message delivery to other members <1s (SC-002); presence status propagation <5s (SC-003); voice-channel join-to-visible/audible <3s (SC-004); sustained performance at ~100 members / ~50 concurrently active per server (SC-009)

**Constraints**: No TURN server — calls across strict NAT/symmetric-NAT networks may fail to connect (accepted v1 limitation per constitution); full-mesh WebRTC caps practical call size at 4 participants (up to ~12 simultaneous peer connections); invite links are permanent and non-revocable in v1 (FR-005)

**Scale/Scope**: Small-community scale — up to ~100 members per server, ~50 concurrently online/active per server, calls up to 4 participants; 5 user stories, 32 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Real-Time Reliability** — PASS. Convex `useQuery` subscriptions give
  reactive, always-consistent UI state (no manual polling). Presence and
  typing indicators are heartbeat + stale-cleanup based, which inherently
  defines reconnect/disconnect behavior (a stale heartbeat naturally expires
  status). WebRTC signaling messages (SDP/ICE) written to the `signals` table
  MUST be treated as at-least-once delivery in design (a peer may see the same
  signal row more than once via subscription re-fires) — call setup logic
  MUST be idempotent to re-application of the same offer/answer/candidate.
  This is carried into Phase 1 design (data-model.md / research.md).
- **II. Type Safety & Schema Discipline** — PASS. TypeScript strict mode
  end-to-end; Convex generates typed client bindings from `convex/schema.ts`
  and function definitions, so client and server share one schema-derived
  source of truth (no hand-duplicated types). All mutation/query args MUST use
  Convex validators (`v.*`) so boundary validation is enforced at the schema
  level.
- **III. Simplicity & YAGNI** — PASS. Single repo, no component library, no
  WebRTC SDK, no extra backend service beyond Convex. Full-mesh topology is
  the simplest approach that satisfies the ≤4-participant requirement (an SFU
  would be premature infrastructure for this scale).
- **IV. Security, Authentication & Authorization** — PASS, with an explicit
  design rule carried into Phase 1: every Convex query/mutation MUST call the
  authenticated-user helper first and MUST verify the caller's membership
  (and, for owner-only actions, ownership) against the target
  server/channel/message before reading or writing. This is a mandatory
  contract for every function in `data-model.md`/`contracts/`, not an
  incidental detail.

No violations requiring justification — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-chat-voice-servers/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
convex/
├── schema.ts                # All table definitions + indexes
├── auth.ts                  # Convex Auth config (password provider)
├── auth.config.ts
├── users.ts                 # profile queries/mutations, display name/avatar
├── servers.ts                # create/rename server, invite link, ownership transfer
├── serverMembers.ts          # join via invite, remove member, list members+status
├── channels.ts                # create/rename/delete text & voice channels
├── messages.ts                # send/edit/delete, paginated history query
├── directMessages.ts          # DM thread lookup/create, send/edit/delete
├── typingIndicators.ts        # heartbeat upsert + stale-read filtering
├── presence.ts                 # heartbeat upsert + stale-read filtering, online/offline
├── calls.ts                    # join/leave voice or DM call, participant mute/video state
└── signals.ts                  # WebRTC offer/answer/ICE candidate exchange

src/
├── main.tsx
├── App.tsx                    # React Router routes + Convex/Auth providers
├── routes/
│   ├── SignupPage.tsx
│   ├── LoginPage.tsx
│   ├── ServerPage.tsx          # server rail + channel sidebar + chat/voice pane + member list
│   └── DirectMessagePage.tsx
├── components/
│   ├── ServerRail.tsx
│   ├── ChannelSidebar.tsx
│   ├── MemberList.tsx
│   ├── ChatPane.tsx
│   ├── MessageItem.tsx
│   ├── MessageComposer.tsx
│   ├── TypingIndicatorBar.tsx
│   ├── VoiceChannelPanel.tsx    # shows connected members per voice channel
│   └── CallView.tsx             # video tiles, mute/camera controls, speaking indicator
├── hooks/
│   ├── usePresenceHeartbeat.ts
│   ├── useTypingHeartbeat.ts
│   └── useWebRTCCall.ts         # full-mesh RTCPeerConnection management via signals table
└── lib/
    └── webrtc.ts                # peer connection factory, STUN config

tests/
├── convex/                     # convex-test unit tests, one file per convex/*.ts module
└── components/                 # Vitest + RTL smoke tests for critical UI flows
```

**Structure Decision**: Single repo, matching the constitution's mandated
layout — Vite React app at the repository root, all backend logic as Convex
functions under `convex/`. This is a web application in shape (frontend +
backend) but Convex collapses "backend" into typed functions + reactive
queries rather than a separate server process, so there is no standalone
`backend/` directory.

## Complexity Tracking

*No violations — table intentionally omitted.*
