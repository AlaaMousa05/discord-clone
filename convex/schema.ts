import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

/**
 * Convex Auth's built-in `users` table already provides `name` and `image`
 * fields, which this app uses directly as `displayName`/`avatarUrl`
 * (see convex/users.ts) rather than duplicating equivalent columns.
 */
export default defineSchema({
  ...authTables,

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id('users'),
    inviteCode: v.string(),
    createdAt: v.number(),
  }).index('by_inviteCode', ['inviteCode']),

  serverMembers: defineTable({
    serverId: v.id('servers'),
    userId: v.id('users'),
    joinedAt: v.number(),
  })
    .index('by_server', ['serverId'])
    .index('by_user', ['userId'])
    .index('by_server_and_user', ['serverId', 'userId']),

  channels: defineTable({
    serverId: v.id('servers'),
    name: v.string(),
    kind: v.union(v.literal('text'), v.literal('voice')),
    createdAt: v.number(),
  }).index('by_server', ['serverId']),

  messages: defineTable({
    channelId: v.id('channels'),
    authorId: v.id('users'),
    content: v.string(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  }).index('by_channel_and_createdAt', ['channelId', 'createdAt']),

  directMessageThreads: defineTable({
    userAId: v.id('users'),
    userBId: v.id('users'),
    createdAt: v.number(),
  }).index('by_users', ['userAId', 'userBId']),

  directMessages: defineTable({
    threadId: v.id('directMessageThreads'),
    authorId: v.id('users'),
    content: v.string(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  }).index('by_thread_and_createdAt', ['threadId', 'createdAt']),

  typingIndicators: defineTable({
    scopeType: v.union(v.literal('channel'), v.literal('dmThread')),
    scopeId: v.string(),
    userId: v.id('users'),
    lastTypedAt: v.number(),
  })
    .index('by_scope', ['scopeType', 'scopeId'])
    .index('by_scope_and_user', ['scopeType', 'scopeId', 'userId']),

  presence: defineTable({
    userId: v.id('users'),
    sessionId: v.string(),
    lastHeartbeatAt: v.number(),
  }).index('by_user', ['userId']),

  calls: defineTable({
    scopeType: v.union(v.literal('voiceChannel'), v.literal('dmThread')),
    scopeId: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  }).index('by_scope_active', ['scopeType', 'scopeId', 'endedAt']),

  callParticipants: defineTable({
    callId: v.id('calls'),
    userId: v.id('users'),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
    micOn: v.boolean(),
    cameraOn: v.boolean(),
  })
    .index('by_call_active', ['callId', 'leftAt'])
    .index('by_user_active', ['userId', 'leftAt']),

  signals: defineTable({
    callId: v.id('calls'),
    fromUserId: v.id('users'),
    toUserId: v.id('users'),
    kind: v.union(v.literal('offer'), v.literal('answer'), v.literal('ice-candidate')),
    payload: v.string(),
    createdAt: v.number(),
  }).index('by_call_and_recipient', ['callId', 'toUserId']),
})
