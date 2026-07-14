import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import PresenceDot from './PresenceDot'

export default function MemberList({ serverId }: { serverId: Id<'servers'> }) {
  const members = useQuery(api.serverMembers.listMembers, { serverId })
  const currentUser = useQuery(api.users.getCurrentUser)
  const getOrCreateDmThread = useMutation(api.directMessages.getOrCreateDmThread)
  const navigate = useNavigate()

  async function handleMessage(otherUserId: Id<'users'>) {
    const { threadId } = await getOrCreateDmThread({ otherUserId })
    navigate(`/dm/${threadId}`)
  }

  return (
    <aside className="w-60 flex-shrink-0 overflow-y-auto bg-surface p-2">
      <div className="mb-2 px-2 text-xs font-semibold uppercase text-text-muted">
        Members — {members?.length ?? 0}
      </div>
      {members?.map((member) => (
        <div
          key={member.userId}
          className="group flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-surface-raised"
        >
          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-surface-raised">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                {member.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0">
              <PresenceDot userId={member.userId} />
            </span>
          </div>
          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
            {member.displayName}
            {member.isOwner && ' 👑'}
          </span>
          {currentUser && member.userId !== currentUser._id && (
            <button
              onClick={() => void handleMessage(member.userId)}
              title="Message"
              className="hidden flex-shrink-0 text-xs text-text-muted transition-colors hover:text-text-primary group-hover:block"
            >
              💬
            </button>
          )}
        </div>
      ))}
    </aside>
  )
}
