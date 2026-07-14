import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.ts')

function setup() {
  return convexTest(schema, modules)
}

async function createUser(t: ReturnType<typeof setup>, name: string) {
  return t.run(async (ctx) => ctx.db.insert('users', { name }))
}

describe('deleteAccount', () => {
  test('transfers ownership of an owned server to the longest-tenured remaining member', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const memberId = await createUser(t, 'Member')
    const owner = t.withIdentity({ subject: ownerId })
    const member = t.withIdentity({ subject: memberId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })
    const { inviteCode } = await owner.query(api.servers.getInviteLink, { serverId })
    await member.mutation(api.servers.joinServerByInvite, { inviteCode })

    await owner.mutation(api.users.deleteAccount, {})

    const server = await member.query(api.servers.getServer, { serverId })
    expect(server.ownerId).toBe(memberId)
    await expect(t.run((ctx) => ctx.db.get(ownerId))).resolves.toBeNull()
  })

  test('deletes the server entirely when the owner was the last member', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const owner = t.withIdentity({ subject: ownerId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Solo Server' })
    await owner.mutation(api.users.deleteAccount, {})

    await expect(t.run((ctx) => ctx.db.get(serverId))).resolves.toBeNull()
  })

  test('leaves servers the caller merely belongs to untouched for other members', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const memberId = await createUser(t, 'Member')
    const owner = t.withIdentity({ subject: ownerId })
    const member = t.withIdentity({ subject: memberId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })
    const { inviteCode } = await owner.query(api.servers.getInviteLink, { serverId })
    await member.mutation(api.servers.joinServerByInvite, { inviteCode })

    await member.mutation(api.users.deleteAccount, {})

    const server = await owner.query(api.servers.getServer, { serverId })
    expect(server.ownerId).toBe(ownerId)
    const members = await owner.query(api.serverMembers.listMembers, { serverId })
    expect(members).toHaveLength(1)
  })
})
