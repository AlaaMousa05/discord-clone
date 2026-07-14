import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireServerMember, requireServerOwner } from './lib/authz'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

async function getActiveCall(ctx: QueryCtx | MutationCtx, channelId: Id<'channels'>) {
  return ctx.db
    .query('calls')
    .withIndex('by_scope_active', (q) =>
      q.eq('scopeType', 'voiceChannel').eq('scopeId', channelId).eq('endedAt', undefined),
    )
    .unique()
}

export const listChannels = query({
  args: { serverId: v.id('servers') },
  handler: async (ctx, args) => {
    await requireServerMember(ctx, args.serverId)
    const channels = await ctx.db
      .query('channels')
      .withIndex('by_server', (q) => q.eq('serverId', args.serverId))
      .collect()

    const sorted = channels.sort((a, b) => a.createdAt - b.createdAt)
    return Promise.all(
      sorted.map(async (c) => {
        if (c.kind !== 'voice') {
          return { _id: c._id, name: c.name, kind: c.kind, connectedVoiceUserIds: [] as Id<'users'>[] }
        }
        const activeCall = await getActiveCall(ctx, c._id)
        if (activeCall === null) {
          return { _id: c._id, name: c.name, kind: c.kind, connectedVoiceUserIds: [] as Id<'users'>[] }
        }
        const participants = await ctx.db
          .query('callParticipants')
          .withIndex('by_call_active', (q) => q.eq('callId', activeCall._id).eq('leftAt', undefined))
          .collect()
        return {
          _id: c._id,
          name: c.name,
          kind: c.kind,
          connectedVoiceUserIds: participants.map((p) => p.userId),
        }
      }),
    )
  },
})

export const createChannel = mutation({
  args: {
    serverId: v.id('servers'),
    name: v.string(),
    kind: v.union(v.literal('text'), v.literal('voice')),
  },
  handler: async (ctx, args) => {
    await requireServerOwner(ctx, args.serverId)
    await ctx.db.insert('channels', {
      serverId: args.serverId,
      name: args.name,
      kind: args.kind,
      createdAt: Date.now(),
    })
  },
})

export const renameChannel = mutation({
  args: {
    channelId: v.id('channels'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId)
    if (channel === null) throw new Error('NOT_FOUND')
    await requireServerOwner(ctx, channel.serverId)
    await ctx.db.patch(args.channelId, { name: args.name })
  },
})

export const deleteChannel = mutation({
  args: { channelId: v.id('channels') },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId)
    if (channel === null) throw new Error('NOT_FOUND')
    await requireServerOwner(ctx, channel.serverId)

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_channel_and_createdAt', (q) => q.eq('channelId', args.channelId))
      .collect()
    await Promise.all(messages.map((m) => ctx.db.delete(m._id)))

    if (channel.kind === 'voice') {
      const activeCall = await getActiveCall(ctx, args.channelId)
      if (activeCall !== null) {
        const participants = await ctx.db
          .query('callParticipants')
          .withIndex('by_call_active', (q) => q.eq('callId', activeCall._id).eq('leftAt', undefined))
          .collect()
        await Promise.all(participants.map((p) => ctx.db.patch(p._id, { leftAt: Date.now() })))
        await ctx.db.patch(activeCall._id, { endedAt: Date.now() })
      }
    }

    await ctx.db.delete(args.channelId)
  },
})
