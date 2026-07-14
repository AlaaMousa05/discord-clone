import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import Modal from './Modal'

function RenameServerForm({
  serverId,
  initialName,
}: {
  serverId: Id<'servers'>
  initialName: string
}) {
  const [name, setName] = useState(initialName)
  const renameServer = useMutation(api.servers.renameServer)

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    await renameServer({ serverId, name: trimmed })
  }

  return (
    <form onSubmit={(event) => void handleRename(event)} className="flex gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="min-w-0 flex-1 rounded bg-surface-deep px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />
      <button
        type="submit"
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Rename
      </button>
    </form>
  )
}

export default function ServerSettingsPanel({
  serverId,
  onClose,
}: {
  serverId: Id<'servers'>
  onClose: () => void
}) {
  const server = useQuery(api.servers.getServer, { serverId })
  const currentUser = useQuery(api.users.getCurrentUser)
  const members = useQuery(api.serverMembers.listMembers, { serverId })
  const removeMember = useMutation(api.serverMembers.removeMember)

  const isOwner = Boolean(server && currentUser && server.ownerId === currentUser._id)

  return (
    <Modal title="Server Settings" onClose={onClose} maxWidth="md">
      {server &&
        (isOwner ? (
          // Keyed so this form's local state re-initializes from the
          // current name if the panel is reopened for a different server.
          <RenameServerForm key={server._id} serverId={server._id} initialName={server.name} />
        ) : (
          <p className="text-text-primary">{server.name}</p>
        ))}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-text-muted">Members</div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {members?.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between rounded px-2 py-1 hover:bg-surface-raised"
            >
              <span className="text-sm text-text-primary">
                {member.displayName}
                {member.isOwner && ' 👑'}
              </span>
              {isOwner && !member.isOwner && (
                <button
                  onClick={() => void removeMember({ serverId, userId: member.userId })}
                  className="text-xs text-danger transition-colors hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-3 py-1.5 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
