# Contract: `convex/messages.ts` and `convex/directMessages.ts`

All functions require an authenticated caller who is a member of the
channel's server (for channel messages) or a participant of the thread (for
DMs), unless noted.

## `query listMessages({ channelId: Id<"channels">, before?: number, limit?: number })`
- Returns: `Array<{ _id, authorId, content, createdAt, editedAt }>`, newest
  first, page of size `limit` (default e.g. 50) with `createdAt < before`
  when paging older history (FR-018).

## `mutation sendMessage({ channelId: Id<"channels">, content: string })`
- Effect: inserts a message with `authorId = caller`. (FR-013, FR-014, FR-015)

## `mutation editMessage({ messageId: Id<"messages">, content: string })`
- Auth: `messages.authorId === caller`. (FR-016, FR-030)
- Effect: updates `content`, sets `editedAt = now` (FR-017).
- Errors: `FORBIDDEN` if not the author.

## `mutation deleteMessage({ messageId: Id<"messages"> })`
- Auth: `messages.authorId === caller`. (FR-016, FR-030)
- Errors: `FORBIDDEN` if not the author.

## `query getOrCreateDmThread({ otherUserId: Id<"users"> })`
- Auth: caller and `otherUserId` must share at least one server
  (`serverMembers` overlap). (FR-020)
- Effect: returns the existing thread for the (caller, otherUserId) pair, or
  creates one.
- Errors: `FORBIDDEN` if no shared server.

## `query listDirectMessages({ threadId, before?, limit? })`
## `mutation sendDirectMessage({ threadId, content })`
## `mutation editDirectMessage({ messageId, content })`
## `mutation deleteDirectMessage({ messageId })`
- Same shape and rules as the channel-message equivalents above, scoped to
  `directMessageThreads`/`directMessages` (FR-021).

## `mutation setTyping({ scopeType: "channel" | "dmThread", scopeId: string })`
- Effect: upserts the caller's `typingIndicators` row with `lastTypedAt = now` (FR-019).

## `query listTypingUsers({ scopeType, scopeId })`
- Returns: `Id<"users">[]` of users whose `lastTypedAt` is within the typing
  staleness window, excluding the caller.
