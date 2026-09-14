import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Layout } from './components/Layout'
import { OrgLayout } from './components/OrgLayout'
import { ProjectsPage } from './pages/ProjectsPage'
import { AskPage } from './pages/AskPage'
import { ItemDetail } from './pages/ItemDetail'
import { TopicDetail } from './pages/Topics'
import { SourcesAdmin } from './pages/SourcesAdmin'
import { MemoryPage } from './pages/MemoryPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginScreen } from './pages/LoginScreen'
import { SignUpPage } from './pages/SignUpPage'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { MembersPage } from './pages/org/MembersPage'
import { OrgConnectionsPage } from './pages/org/OrgConnectionsPage'
import { OrgSettingsPage } from './pages/org/OrgSettingsPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrgProvider, useOrg } from './context/OrgContext'
import { canAdminister } from './lib/access'

function RequireAuth() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * Hides org administration from members.
 *
 * Presentational only — it stops a member stumbling into a screen that isn't
 * theirs, but it is not a security boundary. Real enforcement has to happen
 * server-side, since anything the client decides can be bypassed.
 */
function RequireAdmin() {
  const { currentUser } = useOrg()
  if (!currentUser || !canAdminister(currentUser.role)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState
          title="Admins only"
          description="Managing members, connections and organization settings is limited to owners and admins. Ask an admin if you need access."
        />
      </div>
    )
  }
  return <Outlet />
}

function LoginRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <LoginScreen />
}

function App() {
  return (
    <AuthProvider>
      <OrgProvider>
        <HashRouter>
          <Routes>
            {/* Public — signup and invite acceptance have to work before there
                is any session to gate on. */}
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/invite/:inviteId" element={<AcceptInvitePage />} />

            <Route element={<RequireAuth />}>
              <Route path="/" element={<ProjectsPage />} />

              <Route path="/org" element={<OrgLayout />}>
                <Route element={<RequireAdmin />}>
                  <Route index element={<Navigate to="/org/members" replace />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="connections" element={<OrgConnectionsPage />} />
                  <Route path="settings" element={<OrgSettingsPage />} />
                </Route>
              </Route>

              <Route path="/p/:projectId" element={<Layout />}>
                <Route index element={<AskPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="item/:id" element={<ItemDetail />} />
                <Route path="topics/:id" element={<TopicDetail />} />
                <Route path="memory" element={<MemoryPage />} />
                <Route path="admin" element={<SourcesAdmin />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </OrgProvider>
    </AuthProvider>
  )
}

export default App
