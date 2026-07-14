import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import ChatPane from './ChatPane'

const PAGE_SIZE = 50

export default function ChannelChatPane({
  channelId,
  channelName,
}: {
  channelId: Id<'channels'>
  channelName: string
}) {
  const currentUser = useQuery(api.users.getCurrentUser)
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.listMessages,
    { channelId },
    { initialNumItems: PAGE_SIZE },
  )
  const sendMessage = useMutation(api.messages.sendMessage)
  const editMessage = useMutation(api.messages.editMessage)
  const deleteMessage = useMutation(api.messages.deleteMessage)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-12 flex-shrink-0 items-center border-b border-border px-4 font-semibold text-text-primary">
        <span className="text-text-faint">#</span>
        <span className="ml-1 truncate">{channelName}</span>
      </div>
      <ChatPane
        messages={results}
        status={status}
        loadMore={loadMore}
        pageSize={PAGE_SIZE}
        scope={{ scopeType: 'channel', scopeId: channelId }}
        composerPlaceholder={`Message #${channelName}`}
        currentUserId={currentUser?._id}
        onSend={(content) => sendMessage({ channelId, content })}
        onEdit={(messageId, content) =>
          editMessage({ messageId: messageId as Id<'messages'>, content })
        }
        onDelete={(messageId) => deleteMessage({ messageId: messageId as Id<'messages'> })}
      />
    </div>
  )
}
