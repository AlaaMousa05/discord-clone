import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useConvexAuth } from '@convex-dev/auth/react'
import SignupPage from './routes/SignupPage'
import LoginPage from './routes/LoginPage'
import ServerPage from './routes/ServerPage'
import DirectMessagePage from './routes/DirectMessagePage'
import InvitePage from './routes/InvitePage'
import { usePresenceHeartbeat } from './hooks/usePresenceHeartbeat'

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const location = useLocation()
  // No-ops until isAuthenticated is true; mounted here so every
  // authenticated route heartbeats automatically.
  usePresenceHeartbeat()

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-text-muted">Loading…</div>
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/invite/:inviteCode"
          element={
            <AuthGate>
              <InvitePage />
            </AuthGate>
          }
        />
        <Route
          path="/servers/:serverId/:channelId?"
          element={
            <AuthGate>
              <ServerPage />
            </AuthGate>
          }
        />
        <Route
          path="/dm/:threadId"
          element={
            <AuthGate>
              <DirectMessagePage />
            </AuthGate>
          }
        />
        <Route
          path="/"
          element={
            <AuthGate>
              <ServerPage />
            </AuthGate>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
