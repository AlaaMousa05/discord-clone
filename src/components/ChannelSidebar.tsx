import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import InviteButton from './InviteButton'
import VoiceChannelPanel from './VoiceChannelPanel'
import CallView from './CallView'
import { useWebRTCCall } from '../hooks/useWebRTCCall'

function ChannelRow({
  channel,
  isActive,
  href,
  onVoiceClick,
  isOwner,
  onRename,
  onDelete,
}: {
  channel: { _id: Id<'channels'>; name: string; kind: 'text' | 'voice' }
  isActive: boolean
  href?: string
  onVoiceClick?: () => void
  isOwner: boolean
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draft, setDraft] = useState(channel.name)

  if (isRenaming) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = draft.trim()
          if (trimmed !== '') onRename(trimmed)
          setIsRenaming(false)
        }}
        className="flex gap-1 px-2 py-1"
      >
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 flex-1 rounded bg-surface-deep px-1 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        <button type="submit" className="text-xs text-accent transition-colors hover:underline">
          Save
        </button>
      </form>
    )
  }

  return (
    <div
      className={`group flex items-center justify-between rounded px-2 py-1 text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary ${
        isActive ? 'bg-surface-raised text-text-primary' : ''
      }`}
    >
      {channel.kind === 'text' ? (
        <Link
          to={href ?? '#'}
          className="min-w-0 flex-1 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          # {channel.name}
        </Link>
      ) : (
        <button
          onClick={onVoiceClick}
          className="min-w-0 flex-1 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          🔊 {channel.name}
        </button>
      )}
      {isOwner && (
        <span className="hidden flex-shrink-0 gap-1 text-xs group-hover:flex">
          <button
            onClick={() => setIsRenaming(true)}
            className="transition-colors hover:text-text-primary"
          >
            Rename
          </button>
          <button onClick={onDelete} className="transition-colors hover:text-danger">
            Delete
          </button>
        </span>
      )}
    </div>
  )
}

function CreateChannelForm({
  kind,
  onCreate,
}: {
  kind: 'text' | 'voice'
  onCreate: (name: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full rounded px-2 py-0.5 text-left text-xs text-text-faint transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        + Add channel
      </button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = name.trim()
        if (trimmed === '') return
        onCreate(trimmed)
        setName('')
        setShowForm(false)
      }}
      className="flex gap-1 px-2 py-0.5"
    >
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={kind === 'text' ? 'new-channel' : 'New voice channel'}
        className="min-w-0 flex-1 rounded bg-surface-deep px-1 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />
      <button type="submit" className="text-xs text-accent transition-colors hover:underline">
        Add
      </button>
    </form>
  )
}

interface ActiveCall {
  channelId: Id<'channels'>
  callId: Id<'calls'>
  existingParticipants: Id<'users'>[]
}

function ActiveVoiceCall({
  activeCall,
  members,
  localDisplayName,
  onLeft,
}: {
  activeCall: ActiveCall
  members: { userId: Id<'users'>; displayName: string; avatarUrl?: string }[]
  localDisplayName: string
  onLeft: () => void
}) {
  const { localStream, micOn, cameraOn, toggleMic, toggleCamera, leave, participants } =
    useWebRTCCall(activeCall.callId, activeCall.existingParticipants)

  const displayNameFor = (userId: Id<'users'>) =>
    members.find((m) => m.userId === userId)?.displayName ?? 'Unknown'

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
      displayNameFor={displayNameFor}
    />
  )
}

export default function ChannelSidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { serverId, channelId } = useParams<{ serverId: string; channelId?: string }>()
  const server = useQuery(api.servers.getServer, serverId ? { serverId: serverId as Id<'servers'> } : 'skip')
  const currentUser = useQuery(api.users.getCurrentUser)
  const members = useQuery(
    api.serverMembers.listMembers,
    serverId ? { serverId: serverId as Id<'servers'> } : 'skip',
  )
  const channels = useQuery(
    api.channels.listChannels,
    serverId ? { serverId: serverId as Id<'servers'> } : 'skip',
  )
  const createChannel = useMutation(api.channels.createChannel)
  const renameChannel = useMutation(api.channels.renameChannel)
  const deleteChannel = useMutation(api.channels.deleteChannel)
  const joinCall = useMutation(api.calls.joinCall)
  const navigate = useNavigate()

  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)

  const isOwner = Boolean(server && currentUser && server.ownerId === currentUser._id)
  const textChannels = channels?.filter((c) => c.kind === 'text') ?? []
  const voiceChannels = channels?.filter((c) => c.kind === 'voice') ?? []

  async function handleDelete(deletedChannelId: Id<'channels'>) {
    if (!window.confirm('Delete this channel and all of its messages?')) return
    await deleteChannel({ channelId: deletedChannelId })
    if (deletedChannelId === channelId) {
      const fallback = textChannels.find((c) => c._id !== deletedChannelId)
      if (fallback) navigate(`/servers/${serverId}/${fallback._id}`, { replace: true })
    }
    if (activeCall?.channelId === deletedChannelId) setActiveCall(null)
  }

  async function handleJoinVoice(voiceChannelId: Id<'channels'>) {
    if (activeCall?.channelId === voiceChannelId) return
    try {
      const { callId, existingParticipants } = await joinCall({
        scopeType: 'voiceChannel',
        scopeId: voiceChannelId,
      })
      setActiveCall({ channelId: voiceChannelId, callId, existingParticipants })
    } catch (err) {
      if (err instanceof Error && err.message.includes('CALL_FULL')) {
        window.alert('This voice channel is full (max 4 participants).')
      } else {
        throw err
      }
    }
  }

  return (
    <aside className="flex w-60 flex-shrink-0 flex-col bg-surface">
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {server?.name ?? 'Server'}
        <span aria-hidden>⚙️</span>
      </button>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-1 px-2 text-xs font-semibold uppercase text-text-muted">Text Channels</div>
        {textChannels.map((channel) => (
          <ChannelRow
            key={channel._id}
            channel={channel}
            isActive={channelId === channel._id}
            href={`/servers/${serverId}/${channel._id}`}
            isOwner={isOwner}
            onRename={(name) => void renameChannel({ channelId: channel._id, name })}
            onDelete={() => void handleDelete(channel._id)}
          />
        ))}
        {isOwner && (
          <CreateChannelForm
            kind="text"
            onCreate={(name) => serverId && void createChannel({ serverId: serverId as Id<'servers'>, name, kind: 'text' })}
          />
        )}

        <div className="mb-1 mt-4 px-2 text-xs font-semibold uppercase text-text-muted">
          Voice Channels
        </div>
        {voiceChannels.map((channel) => (
          <div key={channel._id}>
            <ChannelRow
              channel={channel}
              isActive={activeCall?.channelId === channel._id}
              onVoiceClick={() => void handleJoinVoice(channel._id)}
              isOwner={isOwner}
              onRename={(name) => void renameChannel({ channelId: channel._id, name })}
              onDelete={() => void handleDelete(channel._id)}
            />
            <VoiceChannelPanel
              connectedUserIds={channel.connectedVoiceUserIds}
              members={members ?? []}
            />
          </div>
        ))}
        {isOwner && (
          <CreateChannelForm
            kind="voice"
            onCreate={(name) => serverId && void createChannel({ serverId: serverId as Id<'servers'>, name, kind: 'voice' })}
          />
        )}
      </div>

      {serverId && <InviteButton serverId={serverId as Id<'servers'>} />}

      {activeCall && currentUser && (
        <ActiveVoiceCall
          activeCall={activeCall}
          members={members ?? []}
          localDisplayName={currentUser.displayName}
          onLeft={() => setActiveCall(null)}
        />
      )}
    </aside>
  )
}
