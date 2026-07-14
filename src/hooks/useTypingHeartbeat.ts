import { useMemo, useRef } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

const TYPING_THROTTLE_MS = 2_000

type Scope = { scopeType: 'channel' | 'dmThread'; scopeId: string }

/** Returns a function to call on each keystroke; throttles the actual writes. */
export function useTypingHeartbeat(scope: Scope) {
  const setTyping = useMutation(api.typingIndicators.setTyping)
  const lastSentAtRef = useRef(0)

  return useMemo(() => {
    return () => {
      const now = Date.now()
      if (now - lastSentAtRef.current < TYPING_THROTTLE_MS) return
      lastSentAtRef.current = now
      void setTyping(scope)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.scopeType, scope.scopeId, setTyping])
}
