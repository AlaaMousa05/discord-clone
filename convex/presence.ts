import { v } from 'convex/values'
import { mutation, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireAuth } from './lib/authz'

/** Presence rows with no heartbeat in this window are treated as offline. */
export const PRESENCE_STALE_MS = 30_000

export const heartbeat = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .unique()
    if (existing !== null) {
      await ctx.db.patch(existing._id, { lastHeartbeatAt: Date.now() })
    } else {
      await ctx.db.insert('presence', {
        userId,
        sessionId: args.sessionId,
        lastHeartbeatAt: Date.now(),
      })
    }
  },
})

export const endSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .unique()
    if (existing !== null) {
      await ctx.db.delete(existing._id)
    }
  },
})

/**
 * A user is online if any of their `presence` rows has a heartbeat within
 * the staleness window (FR-002's multi-session rule).
 */
export async function isUserOnline(ctx: QueryCtx, userId: Id<'users'>): Promise<boolean> {
  const cutoff = Date.now() - PRESENCE_STALE_MS
  const recentSession = await ctx.db
    .query('presence')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .filter((q) => q.gt(q.field('lastHeartbeatAt'), cutoff))
    .first()
  return recentSession !== null
}
