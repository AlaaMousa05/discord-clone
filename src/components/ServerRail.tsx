import { useState } from 'react'
import { useQuery } from 'convex/react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import CreateServerModal from './CreateServerModal'

export default function ServerRail() {
  const servers = useQuery(api.servers.listMyServers)
  const { serverId } = useParams<{ serverId: string }>()
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <nav className="flex w-[72px] flex-shrink-0 flex-col items-center gap-2 bg-surface-deep py-3">
      {servers?.map((server) => (
        <Link
          key={server._id}
          to={`/servers/${server._id}`}
          title={server.name}
          className={`flex h-12 w-12 items-center justify-center overflow-hidden text-sm font-semibold text-text-primary transition-all ${
            serverId === server._id
              ? 'rounded-2xl bg-accent'
              : 'rounded-3xl bg-surface-raised hover:rounded-2xl hover:bg-accent'
          }`}
        >
          {server.imageUrl ? (
            <img src={server.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            server.name.slice(0, 2).toUpperCase()
          )}
        </Link>
      ))}

      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        title="Create a server"
        className="flex h-12 w-12 items-center justify-center rounded-3xl bg-surface-raised text-2xl leading-none text-online transition-all hover:rounded-2xl hover:bg-online hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        +
      </button>

      {showCreateModal && <CreateServerModal onClose={() => setShowCreateModal(false)} />}
    </nav>
  )
}
