import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'
import type { Value } from 'convex/values'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Captures the display name and avatar chosen at sign-up (FR-001) into
      // Convex Auth's built-in `users.name`/`users.image` fields, which this
      // app treats as displayName/avatarUrl (see convex/users.ts).
      profile(params: Record<string, Value | undefined>) {
        const image = params.image as string | undefined
        return {
          email: params.email as string,
          name: (params.name as string | undefined) ?? (params.email as string),
          ...(image !== undefined ? { image } : {}),
        }
      },
    }),
  ],
})
