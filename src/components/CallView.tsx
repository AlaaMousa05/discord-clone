import { useEffect, useRef } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import type { CallParticipantView } from '../hooks/useWebRTCCall'

function VideoTile({
  stream,
  displayName,
  micOn,
  cameraOn,
  isSpeaking,
  muted,
}: {
  stream: MediaStream | null
  displayName: string
  micOn: boolean
  cameraOn: boolean
  isSpeaking: boolean
  muted: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface-deep shadow-lg transition-shadow ${
        isSpeaking ? 'ring-2 ring-online' : ''
      }`}
    >
      {stream && cameraOn ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised text-xl text-text-primary">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
        {!micOn && <span title="Muted">🔇</span>}
        <span>{displayName}</span>
      </div>
    </div>
  )
}

interface CallViewProps {
  localStream: MediaStream | null
  localDisplayName: string
  micOn: boolean
  cameraOn: boolean
  toggleMic: () => void
  toggleCamera: () => void
  onLeave: () => void
  participants: CallParticipantView[]
  displayNameFor: (userId: Id<'users'>) => string
}

export default function CallView({
  localStream,
  localDisplayName,
  micOn,
  cameraOn,
  toggleMic,
  toggleCamera,
  onLeave,
  participants,
  displayNameFor,
}: CallViewProps) {
  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-surface-deep/95 p-4 backdrop-blur-sm">
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto lg:grid-cols-3">
        <VideoTile
          stream={localStream}
          displayName={`${localDisplayName} (you)`}
          micOn={micOn}
          cameraOn={cameraOn}
          isSpeaking={false}
          muted
        />
        {participants.map((p) => (
          <VideoTile
            key={p.userId}
            stream={p.stream}
            displayName={displayNameFor(p.userId)}
            micOn={p.micOn}
            cameraOn={p.cameraOn}
            isSpeaking={p.isSpeaking}
            muted={false}
          />
        ))}
      </div>

      <div className="flex flex-shrink-0 justify-center gap-3 pt-4">
        <button
          onClick={toggleMic}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            micOn
              ? 'bg-surface-raised text-text-primary hover:bg-surface-raised/70'
              : 'bg-danger text-white hover:opacity-90'
          }`}
        >
          {micOn ? '🎙️ Mute' : '🔇 Unmute'}
        </button>
        <button
          onClick={toggleCamera}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            cameraOn
              ? 'bg-surface-raised text-text-primary hover:bg-surface-raised/70'
              : 'bg-danger text-white hover:opacity-90'
          }`}
        >
          {cameraOn ? '📹 Stop Video' : '📷 Start Video'}
        </button>
        <button
          onClick={onLeave}
          className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Leave Call
        </button>
      </div>
    </div>
  )
}
