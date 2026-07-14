import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'

// Wrapped in AuthGate by App.tsx, so this only renders once authenticated —
// satisfies the "prompted to log in/signup first, then automatically added
// as a member" edge case from spec.md.
export default function InvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>()
  const joinServerByInvite = useMutation(api.servers.joinServerByInvite)
  const navigate = useNavigate()
  const hasJoinedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!inviteCode || hasJoinedRef.current) return
    hasJoinedRef.current = true
    joinServerByInvite({ inviteCode })
      .then(({ serverId }) => {
        navigate(`/servers/${serverId}`, { replace: true })
      })
      .catch(() => {
        setError('This invite link is invalid or has expired.')
      })
  }, [inviteCode, joinServerByInvite, navigate])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
        <p>{error}</p>
        <Link to="/" className="text-accent hover:underline">
          Go back home
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-text-muted">Joining server…</div>
  )
}
