# Contract: `convex/users.ts`

All functions require an authenticated caller unless noted.

## `query getCurrentUser()`
- Returns: `{ _id, displayName, avatarUrl } | null` (null if not authenticated)

## `mutation updateProfile({ displayName?: string, avatarUrl?: string })`
- Auth: caller must be authenticated.
- Effect: updates the caller's own `displayName`/`avatarUrl`. Cannot target another user.
- Errors: `UNAUTHENTICATED` if no caller.

## `query getUserPresence({ userId: Id<"users"> })`
- Returns: `{ userId, isOnline: boolean }`
- Auth: caller must share at least one server with `userId`, or `userId === caller`.
- Errors: `UNAUTHENTICATED`, `FORBIDDEN` (no shared server).
- Implements FR-002 (online if any `presence` row for the user is within the staleness window).
