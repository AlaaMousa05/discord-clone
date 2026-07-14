import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { requireAuthor, requireServerMember } from './lib/authz'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

async function enrichWithAuthor(ctx: QueryCtx, message: Doc<'messages'>) {
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

export const listMessages = query({
  args: {
    channelId: v.id('channels'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId)
    if (channel === null) throw new Error('NOT_FOUND')
    await requireServerMember(ctx, channel.serverId)

    const result = await ctx.db
      .query('messages')
      .withIndex('by_channel_and_createdAt', (index) => index.eq('channelId', args.channelId))
      .order('desc')
      .paginate(args.paginationOpts)

    return { ...result, page: await Promise.all(result.page.map((m) => enrichWithAuthor(ctx, m))) }
  },
})

export const sendMessage = mutation({
  args: {
    channelId: v.id('channels'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId)
    if (channel === null) throw new Error('NOT_FOUND')
    const authorId = await requireServerMember(ctx, channel.serverId)
    await ctx.db.insert('messages', {
      channelId: args.channelId,
      authorId,
      content: args.content,
      createdAt: Date.now(),
    })
  },
})

export const editMessage = mutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (message === null) throw new Error('NOT_FOUND')
    await requireAuthor(ctx, message)
    await ctx.db.patch(args.messageId, { content: args.content, editedAt: Date.now() })
  },
})

export const deleteMessage = mutation({
  args: { messageId: v.id('messages') },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (message === null) throw new Error('NOT_FOUND')
    await requireAuthor(ctx, message)
    await ctx.db.delete(args.messageId)
  },
})
