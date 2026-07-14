import { useEffect, useRef } from 'react'
import { useMutation } from 'convex/react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'

// Wrapped in AuthGate by App.tsx, so this only renders once authenticated —
// satisfies the "prompted to log in/signup first, then automatically added
// as a member" edge case from spec.md.
export default function InvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>()
  const joinServerByInvite = useMutation(api.servers.joinServerByInvite)
  const navigate = useNavigate()
  const hasJoinedRef = useRef(false)

  useEffect(() => {
    if (!inviteCode || hasJoinedRef.current) return
    hasJoinedRef.current = true
    void joinServerByInvite({ inviteCode }).then(({ serverId }) => {
      navigate(`/servers/${serverId}`, { replace: true })
    })
  }, [inviteCode, joinServerByInvite, navigate])

  return (
    <div className="flex h-full items-center justify-center text-text-muted">Joining server…</div>
  )
}
