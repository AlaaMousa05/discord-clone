import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import Modal from './Modal'

export default function InviteButton({ serverId }: { serverId: Id<'servers'> }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const invite = useQuery(api.servers.getInviteLink, open ? { serverId } : 'skip')
  const inviteUrl = invite ? `${window.location.origin}/invite/${invite.inviteCode}` : ''

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-2 pb-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded bg-surface-raised px-2 py-1.5 text-left text-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Invite People
      </button>

      {open && (
        <Modal title="Invite People" onClose={() => setOpen(false)}>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="min-w-0 flex-1 rounded bg-surface-deep px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex-shrink-0 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-3 py-1.5 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
