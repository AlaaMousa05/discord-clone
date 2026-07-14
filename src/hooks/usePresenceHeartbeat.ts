import { useEffect } from 'react'
import { useMutation } from 'convex/react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'

const HEARTBEAT_INTERVAL_MS = 10_000

// Generated once per page load and held in memory only (not persisted) —
// a refresh simply starts a new session, which is fine since presence is
// heartbeat/staleness-based rather than identity-based.
const tabSessionId = crypto.randomUUID()

/** Heartbeats presence for this tab while the user is authenticated. */
export function usePresenceHeartbeat() {
  const { isAuthenticated } = useConvexAuth()
  const heartbeat = useMutation(api.presence.heartbeat)
  const endSession = useMutation(api.presence.endSession)

  useEffect(() => {
    if (!isAuthenticated) return

    void heartbeat({ sessionId: tabSessionId })
    const interval = setInterval(() => {
      void heartbeat({ sessionId: tabSessionId })
    }, HEARTBEAT_INTERVAL_MS)

    const handleUnload = () => {
      void endSession({ sessionId: tabSessionId })
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [isAuthenticated, heartbeat, endSession])
}
