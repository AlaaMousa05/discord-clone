import { getAuthUserId } from '@convex-dev/auth/server'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type Ctx = QueryCtx | MutationCtx

/**
 * Every query/mutation MUST call this (directly or via the helpers below)
 * before touching data, per the constitution's Security/Auth principle.
 */
export async function requireAuth(ctx: Ctx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) throw new Error('UNAUTHENTICATED')
  return userId
}

/** Verifies the caller is a member of `serverId`; returns the caller's id. */
export async function requireServerMember(
  ctx: Ctx,
  serverId: Id<'servers'>,
): Promise<Id<'users'>> {
  const userId = await requireAuth(ctx)
  const membership = await ctx.db
    .query('serverMembers')
    .withIndex('by_server_and_user', (q) => q.eq('serverId', serverId).eq('userId', userId))
    .unique()
  if (membership === null) throw new Error('FORBIDDEN')
  return userId
}

/** Verifies the caller is the owner of `serverId`; returns the caller's id. */
export async function requireServerOwner(
  ctx: Ctx,
  serverId: Id<'servers'>,
): Promise<Id<'users'>> {
  const userId = await requireServerMember(ctx, serverId)
  const server = await ctx.db.get(serverId)
  if (server === null) throw new Error('NOT_FOUND')
  if (server.ownerId !== userId) throw new Error('FORBIDDEN')
  return userId
}

/** Verifies the caller authored `entity` (a message or direct message row). */
export async function requireAuthor(
  ctx: Ctx,
  entity: { authorId: Id<'users'> },
): Promise<Id<'users'>> {
  const userId = await requireAuth(ctx)
  if (entity.authorId !== userId) throw new Error('FORBIDDEN')
  return userId
}

/**
 * True if the two users have at least one server in common. Used both for
 * presence visibility (FR-002) and DM eligibility (FR-020).
 */
export async function sharesServerWith(
  ctx: Ctx,
  userAId: Id<'users'>,
  userBId: Id<'users'>,
): Promise<boolean> {
  if (userAId === userBId) return true
  const aMemberships = await ctx.db
    .query('serverMembers')
    .withIndex('by_user', (q) => q.eq('userId', userAId))
    .collect()
  if (aMemberships.length === 0) return false
  const aServerIds = new Set(aMemberships.map((m) => m.serverId))
  const bMemberships = await ctx.db
    .query('serverMembers')
    .withIndex('by_user', (q) => q.eq('userId', userBId))
    .collect()
  return bMemberships.some((m) => aServerIds.has(m.serverId))
}
