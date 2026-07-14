import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

type Scope = { scopeType: 'channel' | 'dmThread'; scopeId: string }

export default function TypingIndicatorBar({ scope }: { scope: Scope }) {
  const typingUserIds = useQuery(api.typingIndicators.listTypingUsers, scope)

  if (typingUserIds === undefined || typingUserIds.length === 0) {
    return <div className="h-5" />
  }

  return (
    <div className="h-5 px-4 text-xs italic text-text-muted">
      {typingUserIds.length === 1 ? 'Someone is typing…' : 'Several people are typing…'}
    </div>
  )
}
