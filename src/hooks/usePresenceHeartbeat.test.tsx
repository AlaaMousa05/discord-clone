// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const heartbeatMock = vi.fn()
const endSessionMock = vi.fn()
let isAuthenticated = true

vi.mock('@convex-dev/auth/react', () => ({
  useConvexAuth: () => ({ isAuthenticated }),
}))

vi.mock('convex/react', () => ({
  useMutation: (fn: unknown) => {
    const key = String(fn)
    return key.includes('endSession') ? endSessionMock : heartbeatMock
  },
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    presence: {
      heartbeat: 'presence.heartbeat',
      endSession: 'presence.endSession',
    },
  },
}))

// Import after mocks so the hook picks up the mocked modules.
const { usePresenceHeartbeat } = await import('./usePresenceHeartbeat')

describe('usePresenceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    isAuthenticated = true
    heartbeatMock.mockClear()
    endSessionMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('heartbeats immediately and then on an interval while authenticated', () => {
    renderHook(() => usePresenceHeartbeat())
    expect(heartbeatMock).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(heartbeatMock).toHaveBeenCalledTimes(2)

    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(heartbeatMock).toHaveBeenCalledTimes(4)
  })

  test('does not heartbeat when unauthenticated', () => {
    isAuthenticated = false
    renderHook(() => usePresenceHeartbeat())
    expect(heartbeatMock).not.toHaveBeenCalled()
  })

  test('stops heartbeating and clears the interval on unmount', () => {
    const { unmount } = renderHook(() => usePresenceHeartbeat())
    expect(heartbeatMock).toHaveBeenCalledTimes(1)

    unmount()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(heartbeatMock).toHaveBeenCalledTimes(1)
  })
})
