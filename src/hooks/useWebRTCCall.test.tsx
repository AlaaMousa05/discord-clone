// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const sendSignalMock = vi.fn()
const leaveCallMock = vi.fn()
const setMediaStateMock = vi.fn()

let incomingSignals: Array<{ _id: string; fromUserId: string; kind: string; payload: string }> =
  []
let currentUser: { _id: string } | undefined = { _id: 'me' }
let activeParticipants: Array<{ userId: string; micOn: boolean; cameraOn: boolean }> = []

vi.mock('convex/react', () => ({
  useQuery: (queryRef: string, args: unknown) => {
    if (args === 'skip') return undefined
    if (queryRef === 'users.getCurrentUser') return currentUser
    if (queryRef === 'signals.listIncomingSignals') return incomingSignals
    if (queryRef === 'calls.listCallParticipants') return activeParticipants
    throw new Error(`unexpected query: ${queryRef}`)
  },
  useMutation: (mutationRef: string) => {
    if (mutationRef === 'signals.sendSignal') return sendSignalMock
    if (mutationRef === 'calls.leaveCall') return leaveCallMock
    if (mutationRef === 'calls.setMediaState') return setMediaStateMock
    throw new Error(`unexpected mutation: ${mutationRef}`)
  },
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: { getCurrentUser: 'users.getCurrentUser' },
    signals: { sendSignal: 'signals.sendSignal', listIncomingSignals: 'signals.listIncomingSignals' },
    calls: {
      leaveCall: 'calls.leaveCall',
      setMediaState: 'calls.setMediaState',
      listCallParticipants: 'calls.listCallParticipants',
    },
  },
}))

function createFakeConnection() {
  const conn = {
    onicecandidate: null as unknown,
    ontrack: null as unknown,
    remoteDescription: null as unknown,
    setRemoteDescriptionCalls: 0,
    createAnswerCalls: 0,
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'fake' }),
    createAnswer: vi.fn().mockImplementation(function (this: { createAnswerCalls: number }) {
      this.createAnswerCalls++
      return Promise.resolve({ type: 'answer', sdp: 'fake' })
    }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockImplementation(function (this: {
      setRemoteDescriptionCalls: number
      remoteDescription: unknown
    }) {
      this.setRemoteDescriptionCalls++
      this.remoteDescription = { type: 'offer', sdp: 'fake' }
      return Promise.resolve(undefined)
    }),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    addTrack: vi.fn(),
    close: vi.fn(),
  }
  return conn
}

const fakeConnections: ReturnType<typeof createFakeConnection>[] = []

vi.mock('../lib/webrtc', () => ({
  createPeerConnection: () => {
    const conn = createFakeConnection()
    fakeConnections.push(conn)
    return conn
  },
}))

const { useWebRTCCall } = await import('./useWebRTCCall')

describe('useWebRTCCall signal handling', () => {
  beforeEach(() => {
    sendSignalMock.mockClear()
    leaveCallMock.mockClear()
    setMediaStateMock.mockClear()
    incomingSignals = []
    activeParticipants = []
    currentUser = { _id: 'me' }
    fakeConnections.length = 0

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
          getAudioTracks: () => [],
          getVideoTracks: () => [],
        }),
      },
    })
  })

  test('applies an incoming offer signal exactly once, even if re-delivered', async () => {
    activeParticipants = [{ userId: 'peer1', micOn: true, cameraOn: true }]
    incomingSignals = [{ _id: 'sig1', fromUserId: 'peer1', kind: 'offer', payload: '{"sdp":"x"}' }]

    const { rerender } = renderHook(
      ({ callId }: { callId: string | null }) => useWebRTCCall(callId as never, []),
      { initialProps: { callId: 'call1' } },
    )

    await waitFor(() => expect(fakeConnections).toHaveLength(1))
    await waitFor(() => expect(fakeConnections[0].setRemoteDescriptionCalls).toBe(1))
    await waitFor(() => expect(sendSignalMock).toHaveBeenCalledTimes(1))

    // Simulate the subscription re-delivering the same row (new array
    // reference, identical `_id`) — this must be a no-op per T046's
    // idempotency guarantee.
    incomingSignals = [
      { _id: 'sig1', fromUserId: 'peer1', kind: 'offer', payload: '{"sdp":"x"}' },
    ]
    act(() => {
      rerender({ callId: 'call1' })
    })

    expect(fakeConnections).toHaveLength(1)
    expect(fakeConnections[0].setRemoteDescriptionCalls).toBe(1)
    expect(fakeConnections[0].createAnswerCalls).toBe(1)
    expect(sendSignalMock).toHaveBeenCalledTimes(1)
  })

  test('applies a second, genuinely new signal from the same peer', async () => {
    activeParticipants = [{ userId: 'peer1', micOn: true, cameraOn: true }]
    incomingSignals = [{ _id: 'sig1', fromUserId: 'peer1', kind: 'offer', payload: '{"sdp":"x"}' }]

    const { rerender } = renderHook(
      ({ callId }: { callId: string | null }) => useWebRTCCall(callId as never, []),
      { initialProps: { callId: 'call1' } },
    )

    await waitFor(() => expect(sendSignalMock).toHaveBeenCalledTimes(1))
    // Ensure the offer's remote description is fully applied before the
    // ice-candidate arrives, so it takes the immediate-apply path rather
    // than the pending-candidates buffer.
    await waitFor(() => expect(fakeConnections[0].remoteDescription).not.toBeNull())

    incomingSignals = [
      { _id: 'sig1', fromUserId: 'peer1', kind: 'offer', payload: '{"sdp":"x"}' },
      { _id: 'sig2', fromUserId: 'peer1', kind: 'ice-candidate', payload: '{"candidate":"y"}' },
    ]
    act(() => {
      rerender({ callId: 'call1' })
    })

    await waitFor(() => expect(fakeConnections[0].addIceCandidate).toHaveBeenCalledTimes(1))
    expect(fakeConnections[0].setRemoteDescriptionCalls).toBe(1)
  })
})
