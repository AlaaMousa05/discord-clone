import type { Id } from '../../convex/_generated/dataModel'

interface Member {
  userId: Id<'users'>
  displayName: string
  avatarUrl?: string
}

export default function VoiceChannelPanel({
  connectedUserIds,
  members,
}: {
  connectedUserIds: Id<'users'>[]
  members: Member[]
}) {
  if (connectedUserIds.length === 0) return null

  const byId = new Map(members.map((m) => [m.userId, m]))

  return (
    <div className="ml-4 space-y-0.5 pb-1">
      {connectedUserIds.map((userId) => {
        const member = byId.get(userId)
        return (
          <div key={userId} className="flex items-center gap-2 px-2 py-0.5 text-xs text-text-muted">
            <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded-full bg-surface-raised">
              {member?.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px]">
                  {(member?.displayName ?? '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate">{member?.displayName ?? 'Unknown'}</span>
          </div>
        )
      })}
    </div>
  )
}
