import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { requireAuth, requireAuthor, sharesServerWith } from './lib/authz'
import type { Doc } from './_generated/dataModel'
import type { Id } from './_generated/dataModel'
import type { QueryCtx, MutationCtx } from './_generated/server'

/** Canonical (lower, higher) ordering so a pair is always looked up the same way. */
function canonicalPair(a: Id<'users'>, b: Id<'users'>): [Id<'users'>, Id<'users'>] {
  return a < b ? [a, b] : [b, a]
}

async function findThread(
  ctx: QueryCtx | MutationCtx,
  userAId: Id<'users'>,
  userBId: Id<'users'>,
) {
  const [lo, hi] = canonicalPair(userAId, userBId)
  return ctx.db
    .query('directMessageThreads')
    .withIndex('by_users', (q) => q.eq('userAId', lo).eq('userBId', hi))
    .unique()
}

/** Verifies the caller is a participant of `threadId`; returns the caller's id. */
async function requireThreadParticipant(ctx: QueryCtx | MutationCtx, threadId: Id<'directMessageThreads'>) {
  const userId = await requireAuth(ctx)
  const thread = await ctx.db.get(threadId)
  if (thread === null) throw new Error('NOT_FOUND')
  if (thread.userAId !== userId && thread.userBId !== userId) throw new Error('FORBIDDEN')
  return userId
}

async function enrichWithAuthor(ctx: QueryCtx, message: Doc<'directMessages'>) {
  const author = await ctx.db.get(message.authorId)
  return {
    _id: message._id,
    authorId: message.authorId,
    authorDisplayName: author?.name ?? 'Unknown',
    authorAvatarUrl: author?.image,
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
  }
}

export const getThreadInfo = query({
  args: { threadId: v.id('directMessageThreads') },
  handler: async (ctx, args) => {
    const userId = await requireThreadParticipant(ctx, args.threadId)
    const thread = await ctx.db.get(args.threadId)
    if (thread === null) throw new Error('NOT_FOUND')
    const otherUserId = thread.userAId === userId ? thread.userBId : thread.userAId
    const otherUser = await ctx.db.get(otherUserId)
    if (otherUser === null) throw new Error('NOT_FOUND')
    return {
      otherUser: {
        _id: otherUser._id,
        displayName: otherUser.name ?? 'Unknown',
        avatarUrl: otherUser.image,
      },
    }
  },
})

export const getOrCreateDmThread = mutation({
  args: { otherUserId: v.id('users') },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    if (userId === args.otherUserId) throw new Error('FORBIDDEN')
    const shared = await sharesServerWith(ctx, userId, args.otherUserId)
    if (!shared) throw new Error('FORBIDDEN')

    const existing = await findThread(ctx, userId, args.otherUserId)
    if (existing !== null) return { threadId: existing._id }

    const [userAId, userBId] = canonicalPair(userId, args.otherUserId)
    const threadId = await ctx.db.insert('directMessageThreads', {
      userAId,
      userBId,
      createdAt: Date.now(),
    })
    return { threadId }
  },
})

export const listDirectMessages = query({
  args: {
    threadId: v.id('directMessageThreads'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireThreadParticipant(ctx, args.threadId)
    const result = await ctx.db
      .query('directMessages')
      .withIndex('by_thread_and_createdAt', (index) => index.eq('threadId', args.threadId))
      .order('desc')
      .paginate(args.paginationOpts)

    return { ...result, page: await Promise.all(result.page.map((m) => enrichWithAuthor(ctx, m))) }
  },
})

export const sendDirectMessage = mutation({
  args: {
    threadId: v.id('directMessageThreads'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const authorId = await requireThreadParticipant(ctx, args.threadId)
    await ctx.db.insert('directMessages', {
      threadId: args.threadId,
      authorId,
      content: args.content,
      createdAt: Date.now(),
    })
  },
})

export const editDirectMessage = mutation({
  args: {
    messageId: v.id('directMessages'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (message === null) throw new Error('NOT_FOUND')
    await requireAuthor(ctx, message)
    await ctx.db.patch(args.messageId, { content: args.content, editedAt: Date.now() })
  },
})

export const deleteDirectMessage = mutation({
  args: { messageId: v.id('directMessages') },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (message === null) throw new Error('NOT_FOUND')
    await requireAuthor(ctx, message)
    await ctx.db.delete(args.messageId)
  },
})
