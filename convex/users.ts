import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, sharesServerWith } from './lib/authz'
import { isUserOnline } from './presence'
import { removeMemberAndHandleOwnership } from './serverMembers'

/**
 * `displayName`/`avatarUrl` are aliases for Convex Auth's built-in
 * `users.name`/`users.image` fields (see convex/schema.ts).
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    const user = await ctx.db.get(userId)
    if (user === null) return null
    return {
      _id: user._id,
      displayName: user.name ?? '',
      avatarUrl: user.image,
    }
  },
})

export const getUserPresence = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const callerId = await requireAuth(ctx)
    if (callerId !== args.userId) {
      const shared = await sharesServerWith(ctx, callerId, args.userId)
      if (!shared) throw new Error('FORBIDDEN')
    }
    return { userId: args.userId, isOnline: await isUserOnline(ctx, args.userId) }
  },
})

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) throw new Error('UNAUTHENTICATED')
    await ctx.db.patch(userId, {
      ...(args.displayName !== undefined ? { name: args.displayName } : {}),
      ...(args.avatarUrl !== undefined ? { image: args.avatarUrl } : {}),
    })
  },
})

/**
 * Deletes the caller's account (FR-032). For every server the caller is a
 * member of, this reuses `leaveServer`'s ownership-transfer/server-deletion
 * logic (so an owned server with other members transfers ownership rather
 * than vanishing), then deletes the caller's user row itself.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)

    const memberships = await ctx.db
      .query('serverMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    for (const membership of memberships) {
      await removeMemberAndHandleOwnership(ctx, membership.serverId, userId)
    }

    const presenceRows = await ctx.db
      .query('presence')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    await Promise.all(presenceRows.map((p) => ctx.db.delete(p._id)))

    await ctx.db.delete(userId)
  },
})
