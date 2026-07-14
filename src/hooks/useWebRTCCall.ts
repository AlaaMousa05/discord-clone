import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { createPeerConnection } from '../lib/webrtc'

const SPEAKING_VOLUME_THRESHOLD = 0.02
const SPEAKING_POLL_MS = 200

interface PeerHandle {
  connection: RTCPeerConnection
  pendingCandidates: RTCIceCandidateInit[]
}

export interface CallParticipantView {
  userId: Id<'users'>
  stream: MediaStream | null
  micOn: boolean
  cameraOn: boolean
  isSpeaking: boolean
}

/**
 * Full-mesh WebRTC call manager. `existingParticipants` is the one-time
 * snapshot returned by `calls.joinCall` — per the fixed protocol rule, only
 * the joining client initiates offers to participants who were already in
 * the call; existing participants stay passive and just answer.
 */
export function useWebRTCCall(callId: Id<'calls'> | null, existingParticipants: Id<'users'>[]) {
  const currentUser = useQuery(api.users.getCurrentUser)
  const sendSignal = useMutation(api.signals.sendSignal)
  const leaveCallMutation = useMutation(api.calls.leaveCall)
  const setMediaStateMutation = useMutation(api.calls.setMediaState)
  const incomingSignals = useQuery(api.signals.listIncomingSignals, callId ? { callId } : 'skip')
  const allActiveParticipants = useQuery(
    api.calls.listCallParticipants,
    callId ? { callId } : 'skip',
  )
  // listCallParticipants returns every active participant, including the
  // caller — this hook only manages peers for *other* people (the caller
  // already has its own dedicated local tile in CallView).
  const remoteParticipants = allActiveParticipants?.filter((p) => p.userId !== currentUser?._id)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({})

  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, PeerHandle>>(new Map())
  const appliedSignalIdsRef = useRef<Set<string>>(new Set())
  const hasInitiatedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const speakingCleanupRef = useRef<Map<string, () => void>>(new Map())

  const attachTracksToConnection = useCallback((connection: RTCPeerConnection) => {
    if (localStreamRef.current === null) return
    for (const track of localStreamRef.current.getTracks()) {
      connection.addTrack(track, localStreamRef.current)
    }
  }, [])

  const attachSpeakingDetector = useCallback((userId: string, stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) return
    audioContextRef.current ??= new AudioContext()
    const audioContext = audioContextRef.current
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)

    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sumSquares = 0
      for (const sample of data) {
        const normalized = (sample - 128) / 128
        sumSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumSquares / data.length)
      setSpeaking((prev) =>
        prev[userId] === rms > SPEAKING_VOLUME_THRESHOLD
          ? prev
          : { ...prev, [userId]: rms > SPEAKING_VOLUME_THRESHOLD },
      )
    }, SPEAKING_POLL_MS)

    speakingCleanupRef.current.set(userId, () => {
      clearInterval(interval)
      source.disconnect()
      analyser.disconnect()
    })
  }, [])

  const closePeer = useCallback((userId: string) => {
    const handle = peersRef.current.get(userId)
    if (handle) {
      handle.connection.close()
      peersRef.current.delete(userId)
    }
    speakingCleanupRef.current.get(userId)?.()
    speakingCleanupRef.current.delete(userId)
    setRemoteStreams((prev) => {
      if (!(userId in prev)) return prev
      const next = { ...prev }
      delete next[userId]
      return next
    })
    setSpeaking((prev) => {
      if (!(userId in prev)) return prev
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }, [])

  const getOrCreatePeer = useCallback(
    (otherUserId: string): PeerHandle => {
      let handle = peersRef.current.get(otherUserId)
      if (handle) return handle

      const connection = createPeerConnection()
      handle = { connection, pendingCandidates: [] }
      peersRef.current.set(otherUserId, handle)
      attachTracksToConnection(connection)

      connection.onicecandidate = (event) => {
        if (event.candidate && callId) {
          void sendSignal({
            callId,
            toUserId: otherUserId as Id<'users'>,
            kind: 'ice-candidate',
            payload: JSON.stringify(event.candidate.toJSON()),
          })
        }
      }

      connection.ontrack = (event) => {
        const [stream] = event.streams
        setRemoteStreams((prev) => ({ ...prev, [otherUserId]: stream }))
        attachSpeakingDetector(otherUserId, stream)
      }

      return handle
    },
    [attachTracksToConnection, attachSpeakingDetector, callId, sendSignal],
  )

  // Acquire local mic/camera once a call is joined.
  useEffect(() => {
    if (!callId) return
    let cancelled = false

    async function acquireMedia() {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          setCameraOn(false)
        } catch (err) {
          console.error('Could not access the microphone', err)
          return
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      localStreamRef.current = stream
      setLocalStream(stream)
    }

    void acquireMedia()
    return () => {
      cancelled = true
    }
  }, [callId])

  // Once local media is ready, initiate offers to whoever was already in
  // the call when we joined (joiner-initiates protocol rule).
  useEffect(() => {
    if (!callId || !localStream || hasInitiatedRef.current) return
    hasInitiatedRef.current = true

    for (const otherUserId of existingParticipants) {
      const handle = getOrCreatePeer(otherUserId)
      void (async () => {
        const offer = await handle.connection.createOffer()
        await handle.connection.setLocalDescription(offer)
        await sendSignal({
          callId,
          toUserId: otherUserId,
          kind: 'offer',
          payload: JSON.stringify(offer),
        })
      })()
    }
    // existingParticipants is a one-time snapshot from joinCall; intentionally
    // not re-run when it changes identity across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, localStream, getOrCreatePeer, sendSignal])

  // Apply incoming signals (offers/answers/ICE candidates), idempotently.
  useEffect(() => {
    if (!callId || !incomingSignals) return

    for (const signal of incomingSignals) {
      if (appliedSignalIdsRef.current.has(signal._id)) continue
      appliedSignalIdsRef.current.add(signal._id)

      const handle = getOrCreatePeer(signal.fromUserId)
      const { connection } = handle

      if (signal.kind === 'offer') {
        void (async () => {
          await connection.setRemoteDescription(JSON.parse(signal.payload))
          for (const candidate of handle.pendingCandidates.splice(0)) {
            await connection.addIceCandidate(candidate)
          }
          const answer = await connection.createAnswer()
          await connection.setLocalDescription(answer)
          await sendSignal({
            callId,
            toUserId: signal.fromUserId,
            kind: 'answer',
            payload: JSON.stringify(answer),
          })
        })()
      } else if (signal.kind === 'answer') {
        void (async () => {
          await connection.setRemoteDescription(JSON.parse(signal.payload))
          for (const candidate of handle.pendingCandidates.splice(0)) {
            await connection.addIceCandidate(candidate)
          }
        })()
      } else {
        const candidate: RTCIceCandidateInit = JSON.parse(signal.payload)
        if (connection.remoteDescription) {
          void connection.addIceCandidate(candidate)
        } else {
          handle.pendingCandidates.push(candidate)
        }
      }
    }
  }, [callId, incomingSignals, getOrCreatePeer, sendSignal])

  // Tear down peer connections for participants who are no longer active.
  useEffect(() => {
    if (!remoteParticipants) return
    const activeUserIds = new Set(remoteParticipants.map((p) => p.userId as string))
    for (const userId of Array.from(peersRef.current.keys())) {
      if (!activeUserIds.has(userId)) closePeer(userId)
    }
  }, [remoteParticipants, closePeer])

  // Local cleanup (peer connections, media tracks, audio analysers) when
  // this client's component unmounts. Deliberately does NOT call the
  // `leaveCall` mutation here — leaving a call is an explicit user action
  // (the "Leave Call" button, see `leave` below), not a side effect of this
  // hook's owning component unmounting. Tying it to unmount previously
  // caused calls to end immediately in dev under React 18 StrictMode's
  // mount→cleanup→remount cycle, and would equally misfire on any other
  // unrelated remount in production. The known tradeoff: a user who closes
  // the tab/navigates away without clicking "Leave Call" remains a
  // server-side participant until they rejoin or another teardown path
  // (e.g. `removeMember`) clears them — the same class of limitation as
  // presence's heartbeat staleness, not a correctness bug for the active
  // session.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      for (const userId of Array.from(peersRef.current.keys())) closePeer(userId)
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [closePeer])

  const toggleMic = useCallback(() => {
    const next = !micOn
    setMicOn(next)
    localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = next))
    if (callId) void setMediaStateMutation({ callId, micOn: next })
  }, [micOn, callId, setMediaStateMutation])

  const toggleCamera = useCallback(() => {
    const next = !cameraOn
    setCameraOn(next)
    localStreamRef.current?.getVideoTracks().forEach((track) => (track.enabled = next))
    if (callId) void setMediaStateMutation({ callId, cameraOn: next })
  }, [cameraOn, callId, setMediaStateMutation])

  const leave = useCallback(async () => {
    if (callId) await leaveCallMutation({ callId })
  }, [callId, leaveCallMutation])

  const participants: CallParticipantView[] = (remoteParticipants ?? []).map((p) => ({
    userId: p.userId,
    stream: remoteStreams[p.userId] ?? null,
    micOn: p.micOn,
    cameraOn: p.cameraOn,
    isSpeaking: speaking[p.userId] ?? false,
  }))

  return { localStream, micOn, cameraOn, toggleMic, toggleCamera, leave, participants }
}
