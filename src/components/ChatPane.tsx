import { useRef } from 'react'
import MessageItem from './MessageItem'
import MessageComposer from './MessageComposer'
import TypingIndicatorBar from './TypingIndicatorBar'

const LOAD_MORE_THRESHOLD_PX = 100

export interface ChatMessage {
  _id: string
  authorId: string
  authorDisplayName: string
  authorAvatarUrl?: string
  content: string
  createdAt: number
  editedAt?: number
}

type Scope = { scopeType: 'channel' | 'dmThread'; scopeId: string }

interface ChatPaneProps {
  messages: ChatMessage[]
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'
  loadMore: (numItems: number) => void
  pageSize: number
  scope: Scope
  composerPlaceholder: string
  currentUserId: string | undefined
  onSend: (content: string) => Promise<unknown>
  onEdit: (messageId: string, content: string) => Promise<unknown>
  onDelete: (messageId: string) => Promise<unknown>
}

export default function ChatPane({
  messages,
  status,
  loadMore,
  pageSize,
  scope,
  composerPlaceholder,
  currentUserId,
  onSend,
  onEdit,
  onDelete,
}: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = scrollRef.current
    if (el === null) return
    // In a flex-col-reverse + overflow-y-auto pane, scrollTop reaches its
    // max when the user has scrolled up to the oldest loaded message.
    const distanceFromOldest = el.scrollHeight - el.clientHeight - el.scrollTop
    if (distanceFromOldest < LOAD_MORE_THRESHOLD_PX && status === 'CanLoadMore') {
      loadMore(pageSize)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 flex-col-reverse overflow-y-auto px-2 py-4"
      >
        {messages.map((message) => (
          <MessageItem
            key={message._id}
            authorDisplayName={message.authorDisplayName}
            authorAvatarUrl={message.authorAvatarUrl}
            content={message.content}
            createdAt={message.createdAt}
            editedAt={message.editedAt}
            isOwn={message.authorId === currentUserId}
            onEdit={(content) => onEdit(message._id, content)}
            onDelete={() => onDelete(message._id)}
          />
        ))}
      </div>
      <TypingIndicatorBar scope={scope} />
      <MessageComposer placeholder={composerPlaceholder} typingScope={scope} onSend={onSend} />
    </div>
  )
}
