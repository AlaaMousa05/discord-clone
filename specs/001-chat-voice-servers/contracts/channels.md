# Contract: `convex/channels.ts`

All functions require an authenticated caller who is a member of the
channel's server, unless noted.

## `query listChannels({ serverId: Id<"servers"> })`
- Returns: `Array<{ _id, name, kind, connectedVoiceUserIds: Id<"users">[] }>`
  ordered by `createdAt`. `connectedVoiceUserIds` is populated for voice
  channels from the active call's `callParticipants` (FR-010, FR-027).

## `mutation createChannel({ serverId: Id<"servers">, name: string, kind: "text" | "voice" })`
- Auth: caller must be the server's owner. (FR-011, FR-031)

## `mutation renameChannel({ channelId: Id<"channels">, name: string })`
- Auth: caller must be the owner of the channel's server.

## `mutation deleteChannel({ channelId: Id<"channels"> })`
- Auth: caller must be the owner of the channel's server.
- Effect: deletes all `messages` in the channel (FR-012); if the channel is a
  voice channel with an active call, ends the call and disconnects all
  participants (Edge Cases).
