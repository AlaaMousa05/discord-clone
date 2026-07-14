import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/authz'

export const sendSignal = mutation({
  args: {
    callId: v.id('calls'),
    toUserId: v.id('users'),
    kind: v.union(v.literal('offer'), v.literal('answer'), v.literal('ice-candidate')),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const fromUserId = await requireAuth(ctx)
    await ctx.db.insert('signals', {
      callId: args.callId,
      fromUserId,
      toUserId: args.toUserId,
      kind: args.kind,
      payload: args.payload,
      createdAt: Date.now(),
    })
  },
})

export const listIncomingSignals = query({
  args: { callId: v.id('calls') },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const signals = await ctx.db
      .query('signals')
      .withIndex('by_call_and_recipient', (q) => q.eq('callId', args.callId).eq('toUserId', userId))
      .collect()
    return signals.map((s) => ({
      _id: s._id,
      fromUserId: s.fromUserId,
      kind: s.kind,
      payload: s.payload,
      createdAt: s.createdAt,
    }))
  },
})
