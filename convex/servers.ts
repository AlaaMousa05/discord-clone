import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, requireServerMember, requireServerOwner } from './lib/authz'

function generateInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export const createServer = mutation({
  args: {
    name: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireAuth(ctx)
    const now = Date.now()

    let inviteCode = generateInviteCode()
    // Extremely unlikely to collide, but guard against it since inviteCode
    // must be unique (FR-005, FR-006).
    while (
      (await ctx.db
        .query('servers')
        .withIndex('by_inviteCode', (q) => q.eq('inviteCode', inviteCode))
        .unique()) !== null
    ) {
      inviteCode = generateInviteCode()
    }

    const serverId = await ctx.db.insert('servers', {
      name: args.name,
      imageUrl: args.imageUrl,
      ownerId,
      inviteCode,
      createdAt: now,
    })

    await ctx.db.insert('serverMembers', {
      serverId,
      userId: ownerId,
      joinedAt: now,
    })

    await ctx.db.insert('channels', {
      serverId,
      name: 'general',
      kind: 'text',
      createdAt: now,
    })

    return { serverId }
  },
})

export const getServer = query({
  args: { serverId: v.id('servers') },
  handler: async (ctx, args) => {
    await requireServerMember(ctx, args.serverId)
    const server = await ctx.db.get(args.serverId)
    if (server === null) throw new Error('NOT_FOUND')
    return { _id: server._id, name: server.name, imageUrl: server.imageUrl, ownerId: server.ownerId }
  },
})

export const renameServer = mutation({
  args: {
    serverId: v.id('servers'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerOwner(ctx, args.serverId)
    await ctx.db.patch(args.serverId, { name: args.name })
  },
})

export const getInviteLink = query({
  args: { serverId: v.id('servers') },
  handler: async (ctx, args) => {
    await requireServerMember(ctx, args.serverId)
    const server = await ctx.db.get(args.serverId)
    if (server === null) throw new Error('NOT_FOUND')
    return { inviteCode: server.inviteCode }
  },
})

export const joinServerByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const server = await ctx.db
      .query('servers')
      .withIndex('by_inviteCode', (q) => q.eq('inviteCode', args.inviteCode))
      .unique()
    if (server === null) throw new Error('NOT_FOUND')

    const existing = await ctx.db
      .query('serverMembers')
      .withIndex('by_server_and_user', (q) =>
        q.eq('serverId', server._id).eq('userId', userId),
      )
      .unique()
    if (existing === null) {
      await ctx.db.insert('serverMembers', {
        serverId: server._id,
        userId,
        joinedAt: Date.now(),
      })
    }
    return { serverId: server._id }
  },
})

export const listMyServers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const memberships = await ctx.db
      .query('serverMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const servers = await Promise.all(memberships.map((m) => ctx.db.get(m.serverId)))
    return servers
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({ _id: s._id, name: s.name, imageUrl: s.imageUrl }))
  },
})
