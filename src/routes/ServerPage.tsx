import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import ServerRail from '../components/ServerRail'
import ChannelSidebar from '../components/ChannelSidebar'
import ChannelChatPane from '../components/ChannelChatPane'
import MemberList from '../components/MemberList'
import ServerSettingsPanel from '../components/ServerSettingsPanel'

export default function ServerPage() {
  const { serverId, channelId } = useParams<{ serverId?: string; channelId?: string }>()
  const navigate = useNavigate()
  const channels = useQuery(
    api.channels.listChannels,
    serverId ? { serverId: serverId as Id<'servers'> } : 'skip',
  )
  const [showSettings, setShowSettings] = useState(false)

  // Land on the first text channel (typically "general") when no channel is
  // selected, or when the active channel no longer exists — e.g. it was just
  // deleted by the owner while this member was viewing it (Edge Cases).
  useEffect(() => {
    if (!serverId || !channels) return
    const activeChannelStillExists = channelId && channels.some((c) => c._id === channelId)
    if (!activeChannelStillExists) {
      const firstText = channels.find((c) => c.kind === 'text')
      if (firstText) {
        navigate(`/servers/${serverId}/${firstText._id}`, { replace: true })
      }
    }
  }, [serverId, channelId, channels, navigate])

  return (
    <div className="flex h-full">
      <ServerRail />
      {serverId ? (
        <>
          <ChannelSidebar onOpenSettings={() => setShowSettings(true)} />
          {channelId && channels?.find((c) => c._id === channelId) ? (
            <ChannelChatPane
              channelId={channelId as Id<'channels'>}
              channelName={channels.find((c) => c._id === channelId)!.name}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-text-muted">
              Loading channel…
            </div>
          )}
          <MemberList serverId={serverId as Id<'servers'>} />
          {showSettings && (
            <ServerSettingsPanel
              serverId={serverId as Id<'servers'>}
              onClose={() => setShowSettings(false)}
            />
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-text-muted">
          Select or create a server to get started.
        </div>
      )}
    </div>
  )
}
