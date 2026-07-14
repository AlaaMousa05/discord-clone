import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export default function PresenceDot({ userId }: { userId: Id<'users'> }) {
  const presence = useQuery(api.users.getUserPresence, { userId })
  const isOnline = presence?.isOnline ?? false

  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-surface ${
        isOnline ? 'bg-online' : 'bg-offline'
      }`}
      role="status"
      aria-label={isOnline ? 'Online' : 'Offline'}
      title={isOnline ? 'Online' : 'Offline'}
    />
  )
}
