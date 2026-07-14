import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import ServerRail from '../components/ServerRail'
import PresenceDot from '../components/PresenceDot'
import DmChatPane from '../components/DmChatPane'
import CallView from '../components/CallView'
import { useWebRTCCall } from '../hooks/useWebRTCCall'

interface ActiveCall {
  callId: Id<'calls'>
  existingParticipants: Id<'users'>[]
}

function ActiveDmCall({
  activeCall,
  localDisplayName,
  otherUserDisplayName,
  onLeft,
}: {
  activeCall: ActiveCall
  localDisplayName: string
  otherUserDisplayName: string
  onLeft: () => void
}) {
  const { localStream, micOn, cameraOn, toggleMic, toggleCamera, leave, participants } =
    useWebRTCCall(activeCall.callId, activeCall.existingParticipants)

  async function handleLeave() {
    await leave()
    onLeft()
  }

  return (
    <CallView
      localStream={localStream}
      localDisplayName={localDisplayName}
      micOn={micOn}
      cameraOn={cameraOn}
      toggleMic={toggleMic}
      toggleCamera={toggleCamera}
      onLeave={() => void handleLeave()}
      participants={participants}
      displayNameFor={() => otherUserDisplayName}
    />
  )
}

export default function DirectMessagePage() {
  const { threadId } = useParams<{ threadId: string }>()
  const info = useQuery(
    api.directMessages.getThreadInfo,
    threadId ? { threadId: threadId as Id<'directMessageThreads'> } : 'skip',
  )
  const currentUser = useQuery(api.users.getCurrentUser)
  const activeScopeCall = useQuery(
    api.calls.getActiveCallForScope,
    threadId ? { scopeType: 'dmThread', scopeId: threadId } : 'skip',
  )
  const joinCall = useMutation(api.calls.joinCall)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)

  if (!threadId) return null

  async function handleJoinCall() {
    const { callId, existingParticipants } = await joinCall({
      scopeType: 'dmThread',
      scopeId: threadId!,
    })
    setActiveCall({ callId, existingParticipants })
  }

  const callInProgress = (activeScopeCall?.participantUserIds.length ?? 0) > 0

  return (
    <div className="flex h-full">
      <ServerRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            {info && (
              <>
                <PresenceDot userId={info.otherUser._id} />
                <span className="font-semibold text-text-primary">{info.otherUser.displayName}</span>
              </>
            )}
          </div>
          {!activeCall && (
            <button
              onClick={() => void handleJoinCall()}
              className="rounded bg-accent px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {callInProgress ? '📞 Join Video Call' : '📞 Start Video Call'}
            </button>
          )}
        </div>
        <DmChatPane threadId={threadId as Id<'directMessageThreads'>} />
      </div>

      {activeCall && currentUser && info && (
        <ActiveDmCall
          activeCall={activeCall}
          localDisplayName={currentUser.displayName}
          otherUserDisplayName={info.otherUser.displayName}
          onLeft={() => setActiveCall(null)}
        />
      )}
    </div>
  )
}
