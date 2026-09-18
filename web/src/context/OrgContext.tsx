import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  Connection,
  DiscoveredResource,
  Invite,
  Org,
  OrgMember,
  OrgRole,
  Project,
  ProjectAccess,
  SourceId,
  SyncCadence,
} from '../types'
import {
  connections as seedConnections,
  invites as seedInvites,
  members as seedMembers,
  org as seedOrg,
  projects as seedProjects,
} from '../data/mockData'
import {
  loadCurrentOrgId,
  loadOrgState,
  saveCurrentOrgId,
  saveOrgState,
  type OrgState,
} from '../lib/orgStore'
import { uid } from '../lib/id'

/**
 * All multi-tenant state for the prototype: the organization, its people,
 * pending invites, projects, and source connections.
 *
 * This is deliberately the only place that mutates any of it, so the screens
 * stay presentational and a real API client can later be swapped in behind the
 * same method surface. Nothing here holds a credential — see lib/orgStore.ts.
 */

export interface CreateProjectInput {
  name: string
  description: string
  color: string
  initial: string
  avatarUrl?: string
}

export interface SaveConnectionInput {
  projectId: string
  source: SourceId
  accountLabel: string
  authKind: Connection['authKind']
  grantedScopes: string[]
  selectedResourceIds: string[]
  discovered: DiscoveredResource[]
  cadence: SyncCadence
}

export interface SignUpInput {
  orgName: string
  slug: string
  adminName: string
  adminEmail: string
  /** Uploaded logo, if the admin picked one during signup. */
  avatarUrl?: string
  /** Falls back to the first palette colour when no logo is set. */
  color?: string
  /** Falls back to the first letter of the organization name. */
  initial?: string
}

interface OrgContextValue extends OrgState {
  /** The signed-in person. Mocked as the org owner until there's real identity. */
  currentUser: OrgMember
  connectionsForProject: (projectId: string) => Connection[]
  connectionFor: (projectId: string, source: SourceId) => Connection | undefined
  getProject: (projectId: string) => Project | undefined
  getMember: (memberId: string) => OrgMember | undefined
  getInvite: (inviteId: string) => Invite | undefined

  signUpOrg: (input: SignUpInput) => void
  /**
   * Point the session at the member with this email, so the app shows the
   * person who actually signed in. Unknown emails leave the current user
   * alone — the prototype still lets them in, as the owner.
   */
  signInAs: (email: string) => void
  updateOrg: (patch: Partial<Pick<Org, 'name' | 'slug' | 'color' | 'initial' | 'avatarUrl' | 'defaultCadence'>>) => void
  /** Wipes the org back to a clean slate. Prototype stand-in for deletion. */
  resetOrg: () => void

  createProject: (input: CreateProjectInput) => Project
  deleteProject: (projectId: string) => void

  inviteMembers: (emails: string[], role: OrgRole, access: ProjectAccess) => Invite[]
  resendInvite: (inviteId: string) => void
  revokeInvite: (inviteId: string) => void
  acceptInvite: (inviteId: string, name: string) => void

  updateMemberRole: (memberId: string, role: OrgRole) => void
  updateMemberAccess: (memberId: string, access: ProjectAccess) => void
  removeMember: (memberId: string) => void

  saveConnection: (input: SaveConnectionInput) => void
  updateConnectionScope: (connectionId: string, selectedResourceIds: string[]) => void
  updateConnectionCadence: (connectionId: string, cadence: SyncCadence) => void
  resync: (connectionId: string) => void
  disconnect: (connectionId: string) => void
}

const OrgContext = createContext<OrgContextValue | null>(null)

/** Gradient pairs offered when creating a project, matching the seeded ones. */
export const PROJECT_COLORS = [
  'from-brand-orange to-brand-orange-dark',
  'from-brand-navy to-brand-navy-dark',
  'from-emerald-500 to-teal-700',
  'from-violet-500 to-purple-800',
  'from-rose-500 to-red-700',
  'from-sky-500 to-blue-800',
]

const INVITE_TTL_DAYS = 7

export function inviteExpiry(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + INVITE_TTL_DAYS)
  return d.toISOString()
}

const seedState = (): OrgState => ({
  org: seedOrg,
  members: seedMembers,
  invites: seedInvites,
  projects: seedProjects,
  connections: seedConnections,
})

/** Slugify a project or org name into a URL-safe id. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function OrgProvider({ children }: { children: ReactNode }) {
  // Rehydrate whichever org this browser was last in, not just the seeded one,
  // so an org created via signup survives a refresh.
  const [state, setState] = useState<OrgState>(
    () => loadOrgState(loadCurrentOrgId() ?? seedOrg.id) ?? seedState(),
  )

  useEffect(() => {
    saveOrgState(state)
    saveCurrentOrgId(state.org.id)
  }, [state])

  // Simulated sync timers, cleared on unmount so a resync in flight can't
  // fire setState after the provider is gone.
  const timers = useRef<number[]>([])
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  const patch = useCallback((fn: (prev: OrgState) => OrgState) => setState(fn), [])

  const signUpOrg = useCallback(
    ({ orgName, slug, adminName, adminEmail, avatarUrl, color, initial }: SignUpInput) => {
      const orgId = `org-${slug || uid()}`
      const owner: OrgMember = {
        id: uid(),
        orgId,
        name: adminName,
        email: adminEmail,
        role: 'owner',
        status: 'active',
        access: { kind: 'all' },
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      }
      // A brand-new organization starts genuinely empty — no projects, no
      // connections. The seeded fixtures belong to the demo org only.
      setState({
        org: {
          id: orgId,
          name: orgName,
          slug,
          initial: (initial || orgName.trim()[0] || 'O').toUpperCase(),
          color: color ?? PROJECT_COLORS[0],
          avatarUrl,
          defaultCadence: 'weekly',
          createdAt: new Date().toISOString(),
        },
        members: [owner],
        invites: [],
        projects: [],
        connections: [],
      })
    },
    [],
  )

  const signInAs: OrgContextValue['signInAs'] = useCallback(
    (email) =>
      patch((prev) => {
        const match = prev.members.find(
          (m) => m.email.toLowerCase() === email.trim().toLowerCase(),
        )
        return match ? { ...prev, currentUserId: match.id } : prev
      }),
    [patch],
  )

  const updateOrg: OrgContextValue['updateOrg'] = useCallback(
    (next) => patch((prev) => ({ ...prev, org: { ...prev.org, ...next } })),
    [patch],
  )

  const resetOrg: OrgContextValue['resetOrg'] = useCallback(
    () =>
      patch((prev) => ({
        ...prev,
        // The owner is kept so the app still has a signed-in identity to render.
        members: prev.members.filter((m) => m.role === 'owner'),
        invites: [],
        projects: [],
        connections: [],
      })),
    [patch],
  )

  const createProject: OrgContextValue['createProject'] = useCallback(
    ({ name, description, color, initial, avatarUrl }) => {
      const base = slugify(name) || 'project'
      const project: Project = {
        // Ids are user-visible in the URL, so prefer the slug and only
        // disambiguate when it collides with an existing project.
        id: base,
        orgId: state.org.id,
        name: name.trim(),
        description: description.trim(),
        color,
        initial,
        avatarUrl,
      }
      setState((prev) => {
        const taken = prev.projects.some((p) => p.id === base)
        const finalProject = taken ? { ...project, id: `${base}-${uid().slice(0, 4)}` } : project
        return { ...prev, projects: [...prev.projects, finalProject] }
      })
      return project
    },
    [state.org.id],
  )

  const deleteProject: OrgContextValue['deleteProject'] = useCallback(
    (projectId) =>
      patch((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== projectId),
        connections: prev.connections.filter((c) => c.projectId !== projectId),
        // Anyone scoped to only this project keeps their membership but loses
        // the grant, rather than being silently removed from the org.
        members: prev.members.map((m) =>
          m.access.kind === 'projects' && m.access.projectIds.includes(projectId)
            ? { ...m, access: { kind: 'projects', projectIds: m.access.projectIds.filter((id) => id !== projectId) } }
            : m,
        ),
      })),
    [patch],
  )

  const inviteMembers: OrgContextValue['inviteMembers'] = useCallback(
    (emails, role, access) => {
      const now = new Date().toISOString()
      const created: Invite[] = emails.map((email) => ({
        id: uid(),
        orgId: state.org.id,
        email: email.trim().toLowerCase(),
        role,
        access,
        invitedBy: state.members[0]?.id ?? 'unknown',
        invitedAt: now,
        expiresAt: inviteExpiry(),
        status: 'pending',
      }))
      patch((prev) => ({ ...prev, invites: [...created, ...prev.invites] }))
      return created
    },
    [patch, state.org.id, state.members],
  )

  const resendInvite: OrgContextValue['resendInvite'] = useCallback(
    (inviteId) =>
      patch((prev) => ({
        ...prev,
        invites: prev.invites.map((i) =>
          i.id === inviteId
            ? { ...i, status: 'pending', invitedAt: new Date().toISOString(), expiresAt: inviteExpiry() }
            : i,
        ),
      })),
    [patch],
  )

  const revokeInvite: OrgContextValue['revokeInvite'] = useCallback(
    (inviteId) =>
      patch((prev) => ({
        ...prev,
        invites: prev.invites.map((i) => (i.id === inviteId ? { ...i, status: 'revoked' } : i)),
      })),
    [patch],
  )

  const acceptInvite: OrgContextValue['acceptInvite'] = useCallback(
    (inviteId, name) =>
      patch((prev) => {
        const invite = prev.invites.find((i) => i.id === inviteId)
        if (!invite || invite.status !== 'pending') return prev
        const now = new Date().toISOString()
        const member: OrgMember = {
          id: uid(),
          orgId: invite.orgId,
          name,
          email: invite.email,
          role: invite.role,
          status: 'active',
          access: invite.access,
          joinedAt: now,
          lastActiveAt: now,
        }
        return {
          ...prev,
          members: [...prev.members, member],
          invites: prev.invites.map((i) => (i.id === inviteId ? { ...i, status: 'accepted' } : i)),
          // The person who just accepted is the one now using the app.
          currentUserId: member.id,
        }
      }),
    [patch],
  )

  const updateMemberRole: OrgContextValue['updateMemberRole'] = useCallback(
    (memberId, role) =>
      patch((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
      })),
    [patch],
  )

  const updateMemberAccess: OrgContextValue['updateMemberAccess'] = useCallback(
    (memberId, access) =>
      patch((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === memberId ? { ...m, access } : m)),
      })),
    [patch],
  )

  const removeMember: OrgContextValue['removeMember'] = useCallback(
    (memberId) =>
      patch((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== memberId) })),
    [patch],
  )

  const saveConnection: OrgContextValue['saveConnection'] = useCallback(
    (input) =>
      patch((prev) => {
        const now = new Date().toISOString()
        const existing = prev.connections.find(
          (c) => c.projectId === input.projectId && c.source === input.source,
        )
        const next: Connection = {
          id: existing?.id ?? uid(),
          orgId: prev.org.id,
          projectId: input.projectId,
          source: input.source,
          status: 'connected',
          accountLabel: input.accountLabel,
          authKind: input.authKind,
          grantedScopes: input.grantedScopes,
          selectedResourceIds: input.selectedResourceIds,
          discovered: input.discovered,
          connectedBy: prev.members[0]?.id ?? 'unknown',
          connectedAt: existing?.connectedAt ?? now,
          // A fresh connection has genuinely never synced. Showing `null` lets
          // the card say "never synced" instead of implying a sync happened.
          lastSync: existing?.lastSync ?? null,
          itemCount: existing?.itemCount ?? 0,
          cadence: input.cadence,
          error: undefined,
        }
        return {
          ...prev,
          connections: existing
            ? prev.connections.map((c) => (c.id === existing.id ? next : c))
            : [...prev.connections, next],
        }
      }),
    [patch],
  )

  const updateConnectionScope: OrgContextValue['updateConnectionScope'] = useCallback(
    (connectionId, selectedResourceIds) =>
      patch((prev) => ({
        ...prev,
        connections: prev.connections.map((c) => (c.id === connectionId ? { ...c, selectedResourceIds } : c)),
      })),
    [patch],
  )

  const updateConnectionCadence: OrgContextValue['updateConnectionCadence'] = useCallback(
    (connectionId, cadence) =>
      patch((prev) => ({
        ...prev,
        connections: prev.connections.map((c) => (c.id === connectionId ? { ...c, cadence } : c)),
      })),
    [patch],
  )

  const resync: OrgContextValue['resync'] = useCallback(
    (connectionId) => {
      patch((prev) => ({
        ...prev,
        connections: prev.connections.map((c) =>
          c.id === connectionId ? { ...c, status: 'syncing', error: undefined } : c,
        ),
      }))
      const timer = window.setTimeout(() => {
        patch((prev) => ({
          ...prev,
          connections: prev.connections.map((c) =>
            c.id === connectionId
              ? { ...c, status: 'connected', lastSync: new Date().toISOString(), error: undefined }
              : c,
          ),
        }))
      }, 1600)
      timers.current.push(timer)
    },
    [patch],
  )

  const disconnect: OrgContextValue['disconnect'] = useCallback(
    (connectionId) =>
      patch((prev) => ({ ...prev, connections: prev.connections.filter((c) => c.id !== connectionId) })),
    [patch],
  )

  const value = useMemo<OrgContextValue>(
    () => ({
      ...state,
      // Falls back to the owner when nothing has been selected yet, or when the
      // selected member has since been removed.
      currentUser: state.members.find((m) => m.id === state.currentUserId) ?? state.members[0],
      connectionsForProject: (projectId) => state.connections.filter((c) => c.projectId === projectId),
      connectionFor: (projectId, source) =>
        state.connections.find((c) => c.projectId === projectId && c.source === source),
      getProject: (projectId) => state.projects.find((p) => p.id === projectId),
      getMember: (memberId) => state.members.find((m) => m.id === memberId),
      getInvite: (inviteId) => state.invites.find((i) => i.id === inviteId),
      signUpOrg,
      signInAs,
      updateOrg,
      resetOrg,
      createProject,
      deleteProject,
      inviteMembers,
      resendInvite,
      revokeInvite,
      acceptInvite,
      updateMemberRole,
      updateMemberAccess,
      removeMember,
      saveConnection,
      updateConnectionScope,
      updateConnectionCadence,
      resync,
      disconnect,
    }),
    [
      state,
      signUpOrg,
      signInAs,
      updateOrg,
      resetOrg,
      createProject,
      deleteProject,
      inviteMembers,
      resendInvite,
      revokeInvite,
      acceptInvite,
      updateMemberRole,
      updateMemberAccess,
      removeMember,
      saveConnection,
      updateConnectionScope,
      updateConnectionCadence,
      resync,
      disconnect,
    ],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within an OrgProvider')
  return ctx
}
