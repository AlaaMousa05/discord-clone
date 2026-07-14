# Feature Specification: Real-Time Chat & Voice/Video Communities

**Feature Branch**: `001-chat-voice-servers`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Build a real-time chat and video calling application modeled on Discord. Users & auth: Users sign up and log in. Each user has a display name and avatar. A user's online/offline status is visible to others. Servers: A logged-in user can create a server (a named community with an optional image). The creator becomes its owner. Users join servers via an invite link the owner can generate. A server lists its members and their online status in a sidebar. Owners can rename the server and remove members. Channels: Every server starts with a default \"general\" text channel. Members can see all channels; the owner can create, rename, and delete text channels and voice channels. Deleting a channel removes its messages. Messaging: Inside a text channel, members send text messages. Messages appear for all members in real time without refreshing. Each message shows author name, avatar, timestamp, and content. Authors can edit and delete their own messages; edits are marked. Messages load newest-first with infinite scroll for history. Typing indicators show when someone is composing. Direct messages: Any user can open a 1-on-1 DM conversation with another member of a shared server. DMs behave like channels (real time, edit, delete). Voice/video calls: A member can join a voice channel, which starts or joins a live call with the other members currently in that channel (support at least 2, target up to 4 participants). Participants can toggle their microphone and camera, see each other's video tiles, see who is speaking/muted, and leave the call. The channel list shows who is currently connected to each voice channel. 1-on-1 video calls can also be started from a DM. Out of scope for v1: message attachments/files, reactions, threads, roles/permissions beyond owner vs member, screen sharing, mobile apps, message search."

## Clarifications

### Session 2026-07-14

- Q: If a user is logged in from multiple devices/tabs at once, how should their online/offline status work? → A: Online if any session active — user shows online as long as at least one session is connected, and goes offline only when the last session disconnects.
- Q: What scale should v1 be designed to support (concurrent users per server, and any cap on server size)? → A: Small community scale — target up to ~100 members per server and ~50 concurrently online/active in a server at once; no hard membership cap enforced in v1.
- Q: Can two different users have the same display name? → A: Duplicates allowed — display names are just a friendly label, not an identifier; users are distinguished internally by account ID.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign Up, Log In, and See Who's Online (Priority: P1)

A new user creates an account with a display name and avatar, logs in, and can see
which of their fellow members are currently online or offline.

**Why this priority**: Identity and presence are the foundation every other story
depends on — nothing else in the app is meaningful without a logged-in user whose
status other members can see.

**Independent Test**: Can be fully tested by signing up two separate accounts,
logging into both, and confirming each sees the other's online/offline status
update as they log in and out.

**Acceptance Scenarios**:

1. **Given** no existing account, **When** a person signs up with a display name,
   avatar, and credentials, **Then** an account is created and they are logged in.
2. **Given** a registered user, **When** they log in with valid credentials,
   **Then** they reach the application and their status becomes "online" to others.
3. **Given** two logged-in users who share a server, **When** one of them logs out
   or closes the app, **Then** the other sees that user's status change to
   "offline" without refreshing the page.

---

### User Story 2 - Create a Server and Chat in Real Time (Priority: P1)

A logged-in user creates a server, which starts with a default "general" text
channel, and members exchange text messages that appear for everyone instantly.

**Why this priority**: Real-time text messaging inside a shared community is the
core value proposition of the product; a server with working chat is the smallest
viable slice of the whole application.

**Independent Test**: Can be fully tested by creating a server, having a second
member join it, and confirming messages sent by either member appear for the other
without a page refresh.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a server with a name (and
   optional image), **Then** the server is created with them as owner and a
   default "general" text channel already exists.
2. **Given** an existing server, **When** the owner generates an invite link and
   shares it, **Then** anyone who opens that link and is logged in becomes a
   member of the server.
3. **Given** a server with at least two members in the same text channel,
   **When** one member sends a message, **Then** all other members see the new
   message appear immediately, showing author name, avatar, timestamp, and
   content, without refreshing.
4. **Given** a member is typing in a channel, **When** other members are viewing
   that channel, **Then** they see a typing indicator for that member.
5. **Given** a channel with more messages than fit on screen, **When** a member
   scrolls up, **Then** older messages load progressively (infinite scroll),
   newest messages shown first.

---

### User Story 3 - Manage Servers, Channels, and Messages (Priority: P2)

The server owner manages the server's structure (name, members, channels) and any
member can edit or delete the messages they personally authored.

**Why this priority**: Once real-time chat works, ongoing usability requires the
ability to correct mistakes and keep the community organized — this is expected
maintenance functionality layered on top of the P1 core loop.

**Independent Test**: Can be fully tested by having the owner rename the server,
create/rename/delete a channel, remove a member, and having a message author edit
and delete their own message — each verified independently of the other stories.

**Acceptance Scenarios**:

1. **Given** a server they own, **When** the owner renames the server, **Then**
   all members see the updated name.
2. **Given** a server they own, **When** the owner creates a new text or voice
   channel, renames a channel, or deletes a channel, **Then** all members see the
   updated channel list; deleting a channel also removes all of its messages.
3. **Given** a server they own, **When** the owner removes a member, **Then** that
   member no longer has access to the server, and can regain access only by using
   a valid invite link again.
4. **Given** a message a user authored, **When** they edit it, **Then** all
   members see the updated content marked as edited; **when** they delete it,
   **Then** it is removed for all members.
5. **Given** a message authored by someone else, **When** another (non-author)
   member attempts to edit or delete it, **Then** the action is rejected.

---

### User Story 4 - Direct Messages (Priority: P2)

Any user can start a private 1-on-1 conversation with another member of a server
they share, with the same real-time, edit, and delete behavior as a channel.

**Why this priority**: Direct messages extend the core messaging experience to
private conversations; valuable but not required for the first community-chat
experience to work.

**Independent Test**: Can be fully tested by two users who share a server opening
a DM with each other and exchanging, editing, and deleting messages in real time,
independent of any server/channel setup beyond sharing one server.

**Acceptance Scenarios**:

1. **Given** two users who share at least one server, **When** one opens a DM with
   the other, **Then** a private 1-on-1 conversation is available to both.
2. **Given** an open DM conversation, **When** either participant sends, edits, or
   deletes a message, **Then** the other participant sees the change in real time.
3. **Given** two users who do not share any server, **When** one attempts to open
   a DM with the other, **Then** the action is not available.

---

### User Story 5 - Voice and Video Calls (Priority: P3)

A member joins a voice channel to start or join a live audio/video call with other
members currently connected to that channel, and can also start a 1-on-1 video
call directly from a DM.

**Why this priority**: Voice/video is a major differentiating feature but depends
on servers, channels, and membership already existing, and the app delivers
standalone value via text chat even before calling is available.

**Independent Test**: Can be fully tested by having two members join the same
voice channel and confirming both see each other's video tile, mute state, and
speaking indicator, and can leave the call independently of any text-channel
activity.

**Acceptance Scenarios**:

1. **Given** a voice channel with no active call, **When** a member joins it,
   **Then** a live call starts and the member is connected with audio/video.
2. **Given** a voice channel with an active call, **When** another member joins,
   **Then** they connect to the same call and existing participants see the new
   participant's video tile.
3. **Given** an active call, **When** a participant toggles their microphone or
   camera, **Then** other participants see that participant's updated mute/video
   state, and see who is currently speaking.
4. **Given** an active call, **When** a participant leaves, **Then** they
   disconnect and remaining participants no longer see that participant's tile.
5. **Given** a server's channel list, **When** members are connected to a voice
   channel, **Then** the channel list shows who is currently connected to it.
6. **Given** an open DM, **When** one participant starts a video call, **Then**
   the other participant can join a 1-on-1 call from that DM.
7. **Given** an active voice channel call, **When** a fifth member attempts to
   join, **Then** the system enforces the supported participant limit (see
   Assumptions) and communicates that the channel's call is full.

---

### Edge Cases

- What happens if a user's connection drops mid-call? They are treated as having
  left the call; other participants no longer see their tile, and they can
  rejoin the same voice channel if the call is still active.
- What happens when the server owner removes a member who is currently connected
  to one of that server's voice channels? The member is disconnected from the
  call immediately and loses access to the server.
- What happens when a channel is deleted while members are actively viewing it or
  connected to its voice call? Any active call in that channel ends for all
  participants, and viewing members are returned to another channel (e.g.,
  "general").
- What happens if the server owner deletes their own account or leaves the
  server? Ownership automatically transfers to another existing member (see
  Assumptions for the selection rule); the server and its channels/messages are
  preserved.
- What happens if a removed member still has the invite link? They can rejoin the
  server by using it again, the same as any new member.
- What happens when two members try to edit/delete the same message at the same
  moment, or a message is deleted by its author while another member is editing
  a reply to it? The delete takes effect and the message disappears for
  everyone; any in-flight edit on an already-deleted message is rejected.
- What happens when someone who is not a member of a server opens its invite
  link while logged out? They are prompted to log in or sign up first, then
  automatically added as a member.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a person to sign up with a display name, an
  avatar, and login credentials, and to subsequently log in and out.
- **FR-002**: System MUST show every user's current online/offline status to
  other users who share a server with them, and MUST update that status in real
  time as users log in, log out, or disconnect. A user with multiple
  simultaneous sessions (e.g., multiple devices/tabs) MUST show as "online" as
  long as at least one session is active, and MUST switch to "offline" only
  once every session has disconnected.
- **FR-003**: System MUST allow a logged-in user to create a server with a name
  and an optional image; the creating user becomes that server's owner.
- **FR-004**: System MUST automatically create a default text channel named
  "general" whenever a new server is created.
- **FR-005**: System MUST allow a server's owner to generate an invite link for
  that server; the link MUST remain valid indefinitely and MUST NOT be revocable
  or regenerable in v1.
- **FR-006**: System MUST allow any logged-in user who opens a valid invite link
  to become a member of the corresponding server.
- **FR-007**: System MUST display, for each server, a list of its members and
  each member's current online/offline status.
- **FR-008**: System MUST allow a server's owner to rename the server.
- **FR-009**: System MUST allow a server's owner to remove a member from the
  server; a removed member loses access immediately but MAY rejoin later using a
  valid invite link.
- **FR-010**: System MUST allow all members of a server to view its full list of
  text and voice channels.
- **FR-011**: System MUST allow a server's owner to create, rename, and delete
  both text channels and voice channels.
- **FR-012**: System MUST permanently remove all of a channel's messages when
  that channel is deleted.
- **FR-013**: System MUST allow any member of a text channel to send a text
  message to that channel.
- **FR-014**: System MUST deliver new messages to all members currently viewing a
  channel in real time, without requiring a page refresh.
- **FR-015**: System MUST display, for each message, the author's name and
  avatar, a timestamp, and the message content.
- **FR-016**: System MUST allow a message's author (and only that author) to edit
  or delete their own message.
- **FR-017**: System MUST visibly mark a message as edited after it has been
  edited.
- **FR-018**: System MUST load channel message history newest-first and support
  loading older messages incrementally (infinite scroll) as the member scrolls
  back.
- **FR-019**: System MUST show a typing indicator to other members of a channel
  while a member is composing a message.
- **FR-020**: System MUST allow any user to open a 1-on-1 direct message
  conversation with another user, provided the two share at least one server.
- **FR-021**: System MUST apply the same real-time delivery, edit, and delete
  behavior to direct messages as to channel messages.
- **FR-022**: System MUST allow a member to join a voice channel, starting a live
  call if none is active or joining the existing call if one is active.
- **FR-023**: System MUST support at least 2 and target up to 4 simultaneous
  participants in a single voice channel call.
- **FR-024**: System MUST allow each call participant to independently toggle
  their own microphone and camera on or off.
- **FR-025**: System MUST show every other connected participant's live video
  tile (or an equivalent placeholder when their camera is off), current
  mute/unmute state, and an indicator of who is currently speaking.
- **FR-026**: System MUST allow a participant to leave a call at any time,
  disconnecting them and removing their tile for remaining participants.
- **FR-027**: System MUST show, in the channel list, which members are currently
  connected to each voice channel.
- **FR-028**: System MUST allow a video call to be started directly from a 1-on-1
  DM conversation between two users.
- **FR-029**: System MUST prevent a non-member from accessing a server's
  channels, messages, or calls.
- **FR-030**: System MUST prevent any user other than a message's author from
  editing or deleting that message.
- **FR-031**: System MUST prevent any user other than a server's owner from
  renaming the server, removing members, or creating/renaming/deleting channels.
- **FR-032**: System MUST automatically transfer a server's ownership to another
  existing member if the current owner leaves the server or deletes their
  account, preserving the server and its channels/messages; if no other member
  remains, the server (and its channels/messages) is deleted.

### Key Entities

- **User**: A registered person; has login credentials, a display name, an
  avatar, and an online/offline status visible to others who share a server.
- **Server**: A named community with an optional image, exactly one current
  owner (a User), a set of member Users, a set of Channels, and one invite link.
- **Membership**: The relationship between a User and a Server they have joined,
  distinguishing the current owner from other members.
- **Channel**: A named space within a Server, either a text channel (holds
  Messages) or a voice channel (holds an optional live Call); has a creation
  order, with one text channel ("general") always present by default.
- **Message**: Text content posted by a User (the author) into a text Channel or
  a Direct Conversation; has a timestamp, an edited flag, and belongs to exactly
  one author.
- **Direct Conversation**: A private 1-on-1 messaging thread between two Users
  who share at least one Server; behaves like a Channel for messaging and calls.
- **Call**: A live voice/video session tied to a voice Channel or a Direct
  Conversation; has a set of currently connected Participants.
- **Call Participant**: A User's presence within an active Call, with independent
  microphone-on/off, camera-on/off, and speaking states.
- **Invite Link**: A single persistent link generated per Server that grants
  membership to whoever opens it while logged in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete sign-up and reach a usable server view in
  under 2 minutes.
- **SC-002**: A message sent in a text channel appears on another member's screen
  within 1 second under normal network conditions, with no manual refresh.
- **SC-003**: A user's online/offline status change is reflected to other members
  within 5 seconds of them logging in, logging out, or losing connection.
- **SC-004**: A member can join a voice channel and become visible/audible to
  existing participants within 3 seconds under normal network conditions.
- **SC-005**: At least 4 participants can be simultaneously connected to one
  voice channel call with each seeing every other participant's video tile and
  mute/speaking state.
- **SC-006**: 95% of first-time users can successfully create a server, invite
  another user, and exchange a message without external help.
- **SC-007**: Members can scroll back through at least 500 historical messages in
  a channel via infinite scroll without the interface becoming unresponsive.
- **SC-008**: Deleting a channel removes 100% of its messages, and removed
  content is never shown to any member afterward.
- **SC-009**: System sustains normal real-time performance (per SC-002–SC-004)
  for servers with up to 100 members and approximately 50 concurrently
  active/online members.

## Assumptions

- Authentication uses standard credential-based sign-up/login (e.g., email or
  username plus password); no specific identity provider or single-sign-on
  requirement was given.
- A server's invite link is a single, permanent link created automatically or on
  first request; it never expires and cannot be revoked or regenerated in v1 —
  the owner has no way to invalidate it (per explicit decision for v1).
- A member removed by the owner is not banned; they can rejoin later with a
  valid invite link, and this scenario has no cooldown or ban-list concept in
  v1.
- If a server's owner leaves the server or deletes their account, ownership
  automatically transfers to another existing member (selection rule, e.g.
  longest-tenured member, is an implementation detail for the planning phase);
  if no member remains, the server and its data are deleted.
- Voice channel calls support a minimum of 2 and a target maximum of 4
  simultaneous participants; behavior beyond 4 participants attempting to join
  the same channel is to reject the join with a "call full" indication.
- Roles/permissions are limited to exactly two levels in v1: owner and member;
  no custom roles or granular permissions exist.
- Message attachments/files, reactions, threads, screen sharing, mobile apps,
  and message search are explicitly out of scope for v1, per the feature
  description.
- Deleted messages and deleted channels are permanently removed (no soft-delete
  or recovery/undo mechanism) in v1.
- Direct messages require the two users to share at least one server in common;
  there is no global "add friend" concept independent of shared servers in v1.
