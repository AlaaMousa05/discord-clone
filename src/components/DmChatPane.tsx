import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import ChatPane from './ChatPane'

const PAGE_SIZE = 50

export default function DmChatPane({ threadId }: { threadId: Id<'directMessageThreads'> }) {
  const currentUser = useQuery(api.users.getCurrentUser)
  const { results, status, loadMore } = usePaginatedQuery(
    api.directMessages.listDirectMessages,
    { threadId },
    { initialNumItems: PAGE_SIZE },
  )
  const sendDirectMessage = useMutation(api.directMessages.sendDirectMessage)
  const editDirectMessage = useMutation(api.directMessages.editDirectMessage)
  const deleteDirectMessage = useMutation(api.directMessages.deleteDirectMessage)

  return (
    <ChatPane
      messages={results}
      status={status}
      loadMore={loadMore}
      pageSize={PAGE_SIZE}
      scope={{ scopeType: 'dmThread', scopeId: threadId }}
      composerPlaceholder="Message"
      currentUserId={currentUser?._id}
      onSend={(content) => sendDirectMessage({ threadId, content })}
      onEdit={(messageId, content) =>
        editDirectMessage({ messageId: messageId as Id<'directMessages'>, content })
      }
      onDelete={(messageId) =>
        deleteDirectMessage({ messageId: messageId as Id<'directMessages'> })
      }
    />
  )
}
