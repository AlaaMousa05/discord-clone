import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/authz'

const TYPING_STALE_MS = 5_000

const scopeType = v.union(v.literal('channel'), v.literal('dmThread'))

export const setTyping = mutation({
  args: { scopeType, scopeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const existing = await ctx.db
      .query('typingIndicators')
      .withIndex('by_scope_and_user', (q) =>
        q.eq('scopeType', args.scopeType).eq('scopeId', args.scopeId).eq('userId', userId),
      )
      .unique()
    if (existing !== null) {
      await ctx.db.patch(existing._id, { lastTypedAt: Date.now() })
    } else {
      await ctx.db.insert('typingIndicators', {
        scopeType: args.scopeType,
        scopeId: args.scopeId,
        userId,
        lastTypedAt: Date.now(),
      })
    }
  },
})

export const listTypingUsers = query({
  args: { scopeType, scopeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const cutoff = Date.now() - TYPING_STALE_MS
    const rows = await ctx.db
      .query('typingIndicators')
      .withIndex('by_scope', (q) => q.eq('scopeType', args.scopeType).eq('scopeId', args.scopeId))
      .filter((q) => q.gt(q.field('lastTypedAt'), cutoff))
      .collect()
    return rows.filter((r) => r.userId !== userId).map((r) => r.userId)
  },
})
