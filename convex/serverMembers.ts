import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireServerMember, requireServerOwner } from './lib/authz'
import { isUserOnline } from './presence'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

export const listMembers = query({
  args: { serverId: v.id('servers') },
  handler: async (ctx, args) => {
    await requireServerMember(ctx, args.serverId)
    const server = await ctx.db.get(args.serverId)
    if (server === null) throw new Error('NOT_FOUND')

    const memberships = await ctx.db
      .query('serverMembers')
      .withIndex('by_server', (q) => q.eq('serverId', args.serverId))
      .collect()

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId)
        if (user === null) return null
        return {
          userId: user._id,
          displayName: user.name ?? '',
          avatarUrl: user.image,
          isOwner: user._id === server.ownerId,
          isOnline: await isUserOnline(ctx, user._id),
        }
      }),
    )
    return members.filter((m): m is NonNullable<typeof m> => m !== null)
  },
})

/**
 * Disconnects `userId` from any active call in one of this server's voice
 * channels (Edge Case: removed/departed members must leave calls immediately).
 */
async function disconnectFromServerVoiceCalls(
  ctx: MutationCtx,
  serverId: Id<'servers'>,
  userId: Id<'users'>,
) {
  const voiceChannels = (
    await ctx.db
      .query('channels')
      .withIndex('by_server', (q) => q.eq('serverId', serverId))
      .collect()
  ).filter((c) => c.kind === 'voice')

  for (const channel of voiceChannels) {
    const activeCall = await ctx.db
      .query('calls')
      .withIndex('by_scope_active', (q) =>
        q.eq('scopeType', 'voiceChannel').eq('scopeId', channel._id).eq('endedAt', undefined),
      )
      .unique()
    if (activeCall === null) continue

    const participant = await ctx.db
      .query('callParticipants')
      .withIndex('by_call_active', (q) => q.eq('callId', activeCall._id).eq('leftAt', undefined))
      .filter((q) => q.eq(q.field('userId'), userId))
      .unique()
    if (participant !== null) {
      await ctx.db.patch(participant._id, { leftAt: Date.now() })
    }
  }
}

export const removeMember = mutation({
  args: {
    serverId: v.id('servers'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireServerOwner(ctx, args.serverId)
    const membership = await ctx.db
      .query('serverMembers')
      .withIndex('by_server_and_user', (q) =>
        q.eq('serverId', args.serverId).eq('userId', args.userId),
      )
      .unique()
    if (membership === null) throw new Error('NOT_FOUND')

    await disconnectFromServerVoiceCalls(ctx, args.serverId, args.userId)
    await ctx.db.delete(membership._id)
  },
})

/**
 * Removes `userId`'s membership from `serverId`, transferring ownership (to
 * the longest-tenured remaining member, per research.md #6) or deleting the
 * server outright if no members remain. Shared by `leaveServer` and
 * `users.deleteAccount` (FR-032).
 */
export async function removeMemberAndHandleOwnership(
  ctx: MutationCtx,
  serverId: Id<'servers'>,
  userId: Id<'users'>,
) {
  const server = await ctx.db.get(serverId)
  if (server === null) throw new Error('NOT_FOUND')

  const membership = await ctx.db
    .query('serverMembers')
    .withIndex('by_server_and_user', (q) => q.eq('serverId', serverId).eq('userId', userId))
    .unique()
  if (membership === null) throw new Error('NOT_FOUND')

  await disconnectFromServerVoiceCalls(ctx, serverId, userId)
  await ctx.db.delete(membership._id)

  if (server.ownerId !== userId) return

  const remaining = await ctx.db
    .query('serverMembers')
    .withIndex('by_server', (q) => q.eq('serverId', serverId))
    .collect()

  if (remaining.length === 0) {
    // No members left: delete the server and everything scoped to it.
    const channels = await ctx.db
      .query('channels')
      .withIndex('by_server', (q) => q.eq('serverId', serverId))
      .collect()
    for (const channel of channels) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_channel_and_createdAt', (q) => q.eq('channelId', channel._id))
        .collect()
      await Promise.all(messages.map((m) => ctx.db.delete(m._id)))
      await ctx.db.delete(channel._id)
    }
    await ctx.db.delete(serverId)
    return
  }

  const nextOwner = remaining.reduce((oldest, m) => (m.joinedAt < oldest.joinedAt ? m : oldest))
  await ctx.db.patch(serverId, { ownerId: nextOwner.userId })
}

export const leaveServer = mutation({
  args: { serverId: v.id('servers') },
  handler: async (ctx, args) => {
    const userId = await requireServerMember(ctx, args.serverId)
    await removeMemberAndHandleOwnership(ctx, args.serverId, userId)
  },
})
