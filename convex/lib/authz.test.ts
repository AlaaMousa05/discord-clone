import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from '../schema'
import { api } from '../_generated/api'

const modules = import.meta.glob('../**/*.ts')

function setup() {
  return convexTest(schema, modules)
}

async function createUser(t: ReturnType<typeof setup>, name: string) {
  return t.run(async (ctx) => ctx.db.insert('users', { name }))
}

describe('requireServerMember (via servers.getServer / messages.sendMessage)', () => {
  test('rejects a caller who is not a server member', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const outsiderId = await createUser(t, 'Outsider')
    const owner = t.withIdentity({ subject: ownerId })
    const outsider = t.withIdentity({ subject: outsiderId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })

    await expect(outsider.query(api.servers.getServer, { serverId })).rejects.toThrow('FORBIDDEN')
  })

  test('allows a member to read the server', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const owner = t.withIdentity({ subject: ownerId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })

    const server = await owner.query(api.servers.getServer, { serverId })
    expect(server.name).toBe('Test Server')
  })

  test('rejects sendMessage from a non-member', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const outsiderId = await createUser(t, 'Outsider')
    const owner = t.withIdentity({ subject: ownerId })
    const outsider = t.withIdentity({ subject: outsiderId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })
    const [channel] = await owner.query(api.channels.listChannels, { serverId })

    await expect(
      outsider.mutation(api.messages.sendMessage, { channelId: channel._id, content: 'hi' }),
    ).rejects.toThrow('FORBIDDEN')
  })
})

describe('requireServerOwner (via channels.createChannel / servers.renameServer)', () => {
  test('rejects a non-owner member creating a channel', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const memberId = await createUser(t, 'Member')
    const owner = t.withIdentity({ subject: ownerId })
    const member = t.withIdentity({ subject: memberId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })
    const { inviteCode } = await owner.query(api.servers.getInviteLink, { serverId })
    await member.mutation(api.servers.joinServerByInvite, { inviteCode })

    await expect(
      member.mutation(api.channels.createChannel, { serverId, name: 'random', kind: 'text' }),
    ).rejects.toThrow('FORBIDDEN')
  })

  test('rejects a non-owner member renaming the server', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const memberId = await createUser(t, 'Member')
    const owner = t.withIdentity({ subject: ownerId })
    const member = t.withIdentity({ subject: memberId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })
    const { inviteCode } = await owner.query(api.servers.getInviteLink, { serverId })
    await member.mutation(api.servers.joinServerByInvite, { inviteCode })

    await expect(
      member.mutation(api.servers.renameServer, { serverId, name: 'Renamed' }),
    ).rejects.toThrow('FORBIDDEN')
  })

  test('allows the owner to create a channel', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const owner = t.withIdentity({ subject: ownerId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })

    await expect(
      owner.mutation(api.channels.createChannel, { serverId, name: 'random', kind: 'text' }),
    ).resolves.toBeNull()
  })
})

describe('requireAuthor (via messages.editMessage / deleteMessage)', () => {
  test('rejects editing a message authored by someone else', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const memberId = await createUser(t, 'Member')
    const owner = t.withIdentity({ subject: ownerId })
    const member = t.withIdentity({ subject: memberId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })
    const { inviteCode } = await owner.query(api.servers.getInviteLink, { serverId })
    await member.mutation(api.servers.joinServerByInvite, { inviteCode })
    const [channel] = await owner.query(api.channels.listChannels, { serverId })
    await owner.mutation(api.messages.sendMessage, { channelId: channel._id, content: 'original' })

    const { page } = await owner.query(api.messages.listMessages, {
      channelId: channel._id,
      paginationOpts: { numItems: 10, cursor: null },
    })
    const [message] = page

    await expect(
      member.mutation(api.messages.editMessage, { messageId: message._id, content: 'hacked' }),
    ).rejects.toThrow('FORBIDDEN')
    await expect(
      member.mutation(api.messages.deleteMessage, { messageId: message._id }),
    ).rejects.toThrow('FORBIDDEN')
  })

  test('allows the author to edit their own message', async () => {
    const t = setup()
    const ownerId = await createUser(t, 'Owner')
    const owner = t.withIdentity({ subject: ownerId })

    const { serverId } = await owner.mutation(api.servers.createServer, { name: 'Test Server' })
    const [channel] = await owner.query(api.channels.listChannels, { serverId })
    await owner.mutation(api.messages.sendMessage, { channelId: channel._id, content: 'original' })

    const { page } = await owner.query(api.messages.listMessages, {
      channelId: channel._id,
      paginationOpts: { numItems: 10, cursor: null },
    })
    const [message] = page

    await expect(
      owner.mutation(api.messages.editMessage, { messageId: message._id, content: 'edited' }),
    ).resolves.toBeNull()
  })
})

describe('requireAuth', () => {
  test('rejects an unauthenticated caller', async () => {
    const t = setup()
    await expect(t.mutation(api.servers.createServer, { name: 'Nope' })).rejects.toThrow(
      'UNAUTHENTICATED',
    )
  })
})
