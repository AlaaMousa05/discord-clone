import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/authz'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

const MAX_ACTIVE_PARTICIPANTS = 4

const scopeType = v.union(v.literal('voiceChannel'), v.literal('dmThread'))

async function findActiveCall(ctx: MutationCtx, scope: { scopeType: 'voiceChannel' | 'dmThread'; scopeId: string }) {
  return ctx.db
    .query('calls')
    .withIndex('by_scope_active', (q) =>
      q.eq('scopeType', scope.scopeType).eq('scopeId', scope.scopeId).eq('endedAt', undefined),
    )
    .unique()
}

async function listActiveParticipants(ctx: MutationCtx, callId: Id<'calls'>) {
  return ctx.db
    .query('callParticipants')
    .withIndex('by_call_active', (q) => q.eq('callId', callId).eq('leftAt', undefined))
    .collect()
}

export const joinCall = mutation({
  args: { scopeType, scopeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    let call = await findActiveCall(ctx, args)
    if (call === null) {
      const callId = await ctx.db.insert('calls', {
        scopeType: args.scopeType,
        scopeId: args.scopeId,
        startedAt: Date.now(),
      })
      call = (await ctx.db.get(callId))!
    }

    const activeParticipants = await listActiveParticipants(ctx, call._id)

    // Already-active participant re-joining (e.g. tab refresh): treat as a
    // no-op rejoin rather than double-counting toward the cap.
    const existingOwnRow = activeParticipants.find((p) => p.userId === userId)
    if (existingOwnRow !== undefined) {
      return {
        callId: call._id,
        existingParticipants: activeParticipants
          .filter((p) => p.userId !== userId)
          .map((p) => p.userId),
      }
    }

    if (activeParticipants.length >= MAX_ACTIVE_PARTICIPANTS) {
      throw new Error('CALL_FULL')
    }

    await ctx.db.insert('callParticipants', {
      callId: call._id,
      userId,
      joinedAt: Date.now(),
      micOn: true,
      cameraOn: true,
    })

    return { callId: call._id, existingParticipants: activeParticipants.map((p) => p.userId) }
  },
})

export const leaveCall = mutation({
  args: { callId: v.id('calls') },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const participant = await ctx.db
      .query('callParticipants')
      .withIndex('by_call_active', (q) => q.eq('callId', args.callId).eq('leftAt', undefined))
      .filter((q) => q.eq(q.field('userId'), userId))
      .unique()
    if (participant !== null) {
      await ctx.db.patch(participant._id, { leftAt: Date.now() })
    }

    const remaining = await listActiveParticipants(ctx, args.callId)
    if (remaining.length === 0) {
      const call = await ctx.db.get(args.callId)
      if (call !== null && call.endedAt === undefined) {
        await ctx.db.patch(args.callId, { endedAt: Date.now() })
      }
    }
  },
})

export const listCallParticipants = query({
  args: { callId: v.id('calls') },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    const participants = await ctx.db
      .query('callParticipants')
      .withIndex('by_call_active', (q) => q.eq('callId', args.callId).eq('leftAt', undefined))
      .collect()
    return participants.map((p) => ({ userId: p.userId, micOn: p.micOn, cameraOn: p.cameraOn }))
  },
})

export const setMediaState = mutation({
  args: {
    callId: v.id('calls'),
    micOn: v.optional(v.boolean()),
    cameraOn: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const participant = await ctx.db
      .query('callParticipants')
      .withIndex('by_call_active', (q) => q.eq('callId', args.callId).eq('leftAt', undefined))
      .filter((q) => q.eq(q.field('userId'), userId))
      .unique()
    if (participant === null) throw new Error('NOT_FOUND')
    await ctx.db.patch(participant._id, {
      ...(args.micOn !== undefined ? { micOn: args.micOn } : {}),
      ...(args.cameraOn !== undefined ? { cameraOn: args.cameraOn } : {}),
    })
  },
})

/**
 * The currently active call for a scope, if any — used to show who's
 * connected to a voice channel without that user having joined via this
 * client (FR-027).
 */
export const getActiveCallForScope = query({
  args: { scopeType, scopeId: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    const call = await ctx.db
      .query('calls')
      .withIndex('by_scope_active', (q) =>
        q.eq('scopeType', args.scopeType).eq('scopeId', args.scopeId).eq('endedAt', undefined),
      )
      .unique()
    if (call === null) return null
    const participants = await ctx.db
      .query('callParticipants')
      .withIndex('by_call_active', (q) => q.eq('callId', call._id).eq('leftAt', undefined))
      .collect()
    return { callId: call._id, participantUserIds: participants.map((p) => p.userId) }
  },
})
