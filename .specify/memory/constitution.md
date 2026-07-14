<!--
Sync Impact Report
Version change: [TEMPLATE] → 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - I. Real-Time Reliability
  - II. Type Safety & Schema Discipline
  - III. Simplicity & YAGNI
  - IV. Security, Authentication & Authorization
  - Technology Stack (marked TBD, deferred)
  - Development Workflow
  - Governance
Removed sections: Generic placeholder scaffolding from constitution-template.md
Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (generic Constitution Check gate references this file; no changes needed)
  - ✅ .specify/templates/spec-template.md (no constitution-specific references found; no changes needed)
  - ✅ .specify/templates/tasks-template.md (no constitution-specific references found; no changes needed)
  - ✅ .claude/skills/speckit-*/SKILL.md (generic references only; no agent-specific renames needed)
Follow-up TODOs: none
(Superseded by the 1.0.1 sync note below — see history.)
-->

<!--
Sync Impact Report
Version change: 1.0.0 → 1.0.1
Modified principles: N/A
Added/removed sections: N/A
Changed: Technology Stack section filled in with the concrete stack chosen for
the 001-chat-voice-servers feature (React/Vite/Tailwind frontend, Convex
backend+auth+realtime, native WebRTC full-mesh calling). This resolves the
previously deferred TODO(TECH_STACK); no principle text changed.
Templates requiring updates: none (no references to the old TODO placeholder)
Follow-up TODOs: none
-->

# Discord Clone Constitution

## Core Principles

### I. Real-Time Reliability

Real-time features (messaging, presence, typing indicators, voice/video signaling,
notifications) MUST behave correctly under reconnects, out-of-order delivery, and
concurrent updates from multiple clients. Every real-time event handler MUST be
idempotent or explicitly de-duplicated, and MUST define behavior for the
disconnect/reconnect case before it is considered done. Optimistic UI updates MUST
reconcile with server state and MUST NOT silently diverge from it.

**Rationale**: A chat/voice application is judged primarily on whether messages,
presence, and calls stay consistent when networks are flaky. Race conditions and
duplicate/lost events in this domain are user-visible and erode trust immediately,
so correctness under concurrency and reconnection is non-negotiable rather than a
nice-to-have.

### II. Type Safety & Schema Discipline

All code MUST be written in a strictly-typed language/mode (no implicit `any` or
equivalent escape hatches without explicit justification in a code comment).
Data crossing a boundary (client↔server, server↔database, service↔service) MUST be
validated against an explicit schema at that boundary. Types/schemas shared between
client and server MUST be defined once and imported, never hand-duplicated.

**Rationale**: A social/chat platform has many independently-evolving surfaces
(REST/WebSocket payloads, DB models, UI state). Divergent hand-written types across
these surfaces are a leading source of production bugs; validating and sharing
schemas at boundaries catches mismatches at compile time or at the boundary instead
of in production.

### III. Simplicity & YAGNI

Start with the simplest structure that satisfies the current feature's spec. New
abstractions (generic frameworks, plugin systems, extra service layers) MUST NOT be
introduced speculatively; they require a concrete, cited current need. Prefer
duplicating a few similar lines over introducing a shared abstraction for two call
sites. Features and scope not present in the approved spec MUST NOT be added during
implementation.

**Rationale**: This is a small-team/solo project without the staffing to maintain
speculative infrastructure. Premature abstraction slows down the next feature more
than it helps the current one; complexity must earn its way into the codebase.

### IV. Security, Authentication & Authorization

Every request handler and real-time event handler MUST authenticate the caller and
authorize the action against the resource's ownership/role (server owner, channel
permission, membership) before performing it — there is no implicit trust based on
a request simply reaching the handler. User-generated content (messages, filenames,
uploaded media, display names) MUST be treated as untrusted and sanitized/escaped at
render and storage boundaries. Secrets (API keys, session/auth tokens, DB
credentials) MUST NOT be committed to the repository or logged.

**Rationale**: A Discord-style app exposes servers, channels, and roles with
differing access levels, and accepts continuous user-generated input; a single
missing authorization check or unsanitized render path turns into a
cross-server data leak or stored XSS. This principle is non-negotiable because
the failure mode is a security incident, not a bug ticket.

## Technology Stack

- **Frontend**: React 18 + TypeScript, built with Vite. Tailwind CSS for all
  styling (Discord-like dark theme: server rail, channel sidebar, chat pane,
  member list). React Router for navigation. No third-party component library.
- **Backend / Storage**: Convex as the combined database and backend. All
  tables MUST be defined in `convex/schema.ts` with an index for every access
  pattern the app uses. Reads MUST use Convex queries (real-time via
  `useQuery`); writes MUST use Convex mutations.
- **Auth**: Convex Auth with the password provider.
- **Real-time presence/typing**: Lightweight Convex tables updated on a
  heartbeat and cleaned up when stale — not a separate real-time transport.
- **Voice/video**: Native `RTCPeerConnection` (WebRTC), no third-party SDK
  (e.g., no LiveKit/Twilio). Full-mesh topology (every participant connects to
  every other), acceptable up to 4 peers. Google public STUN only
  (`stun:stun.l.google.com:19302`); no TURN server in v1 — strict-NAT networks
  may fail to connect, and this is an accepted v1 limitation, not a bug.
  Signaling (SDP/ICE) is exchanged through a Convex `signals` table, not a
  separate signaling server.
- **Repo layout**: Single repo — the Vite app at the repository root, Convex
  functions under `convex/`. Environment configuration via `.env.local`,
  which MUST NOT be committed.

This stack is binding for `/speckit-plan`: Technical Context fields MUST be
filled in directly from this section rather than marked `NEEDS CLARIFICATION`.

## Development Workflow

- Every feature MUST go through spec → plan → tasks before implementation begins;
  skipping directly to code is not permitted for non-trivial features.
- Each principle above MUST be checked explicitly during the Constitution Check gate
  in `/speckit-plan`; a violation MUST either be resolved or justified in the plan's
  Complexity Tracking table before proceeding.
- Pull requests / reviews MUST verify: real-time handlers cover the reconnect case,
  boundary schemas exist and are shared (not duplicated), no speculative
  abstractions were introduced, and every new endpoint/event has an explicit
  auth+authorization check.

## Governance

This constitution supersedes all other project practices and undocumented
conventions. Amendments require:

1. A documented proposal describing the change and its rationale.
2. A version bump following semantic versioning:
   - MAJOR: backward-incompatible removal or redefinition of a principle.
   - MINOR: a new principle or materially expanded guidance is added.
   - PATCH: clarifications or wording fixes with no semantic change.
3. Propagation of the change into any dependent templates (`plan-template.md`,
   `spec-template.md`, `tasks-template.md`) in the same change, if they reference
   the amended content.

All plans and reviews MUST verify compliance with this constitution. Complexity
that violates Principle III MUST be justified in writing (plan's Complexity
Tracking table) or the plan MUST be simplified before proceeding.

**Version**: 1.0.1 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
