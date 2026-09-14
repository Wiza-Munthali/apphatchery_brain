export type SourceId = 'github' | 'zulip' | 'figma' | 'notion' | 'slack'

export type ItemTag = 'delivery' | 'feature' | 'issue' | 'milestone' | 'update'

export interface Project {
  id: string
  orgId: string
  name: string
  description: string
  color: string
  initial: string
  /** Uploaded logo as a data URL. When set, it replaces the colour+initial tile. */
  avatarUrl?: string
}

export interface KBItem {
  id: string
  projectId: string
  source: SourceId
  type: string
  title: string
  body: string
  snippet: string
  author: string
  createdAt: string
  updatedAt: string
  url: string
  space: string
  tag: ItemTag
  parentId?: string
  relatedIds?: string[]
  topicIds?: string[]
}

export interface Topic {
  id: string
  projectId: string
  title: string
  description: string
  itemIds: string[]
}

// ---------------------------------------------------------------------------
// Multi-tenant: organizations, membership, invites
// ---------------------------------------------------------------------------

/** 'owner' is the super admin who signed the organization up. */
export type OrgRole = 'owner' | 'admin' | 'member'

export interface Org {
  id: string
  name: string
  slug: string
  initial: string
  /** Tailwind gradient class fragment, matching Project.color. */
  color: string
  /** Uploaded logo as a data URL. When set, it replaces the colour+initial tile. */
  avatarUrl?: string
  /** Pre-selected sync frequency when a new connection is set up. */
  defaultCadence: SyncCadence
  createdAt: string
}

/**
 * Which projects a person can see. Deliberately one discriminated shape rather
 * than a loose `allProjects: boolean` + `projectIds: string[]` pair, so no
 * screen can render a contradictory combination. Always describe it through
 * `describeAccess()` in lib/access.ts — never inline.
 */
export type ProjectAccess = { kind: 'all' } | { kind: 'projects'; projectIds: string[] }

export type MemberStatus = 'active' | 'invited' | 'suspended'

export interface OrgMember {
  id: string
  orgId: string
  name: string
  email: string
  role: OrgRole
  status: MemberStatus
  access: ProjectAccess
  joinedAt: string
  lastActiveAt?: string
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface Invite {
  id: string
  orgId: string
  email: string
  role: OrgRole
  access: ProjectAccess
  /** OrgMember id of the admin who sent it. */
  invitedBy: string
  invitedAt: string
  expiresAt: string
  status: InviteStatus
}

// ---------------------------------------------------------------------------
// Source connections
// ---------------------------------------------------------------------------

/**
 * `reauth_required` is deliberately distinct from `error`: a sync failure is
 * retryable, but a revoked or expired credential can only be fixed by an admin
 * re-running the connect flow. The remediation button differs, so the state does.
 */
export type ConnectionStatus = 'not_connected' | 'connected' | 'syncing' | 'error' | 'reauth_required'

/**
 * How a provider hands over access. These are genuinely different security
 * models and the UI presents them differently rather than showing four
 * identical "Connect" buttons:
 *   app_install — provider-side resource selection (GitHub App)
 *   oauth       — user consents to scopes, provider issues a token
 *   api_key     — no OAuth exists; an admin pastes a bot credential (Zulip)
 */
export type AuthKind = 'app_install' | 'oauth' | 'api_key'

export type ResourceKind = 'repo' | 'channel' | 'page' | 'database' | 'stream' | 'file'

/** Something a connected credential can see, offered for explicit selection. */
export interface DiscoveredResource {
  id: string
  name: string
  kind: ResourceKind
  /** Extra context, e.g. 'private', '~130 pages'. Explains `selectable: false`. */
  hint?: string
  selectable: boolean
}

export type SyncCadence = 'manual' | 'daily' | 'weekly'

export interface Connection {
  id: string
  orgId: string
  projectId: string
  source: SourceId
  status: ConnectionStatus
  /**
   * Which account the sync runs as — an identity label only, e.g.
   * 'AppHatchery · GitHub App #4821'. NEVER a credential, and never derived
   * from one. Nothing in this object may hold a token, key, or password.
   */
  accountLabel: string
  authKind: AuthKind
  /** Shown verbatim so an admin can audit what was actually granted. */
  grantedScopes: string[]
  /** Default-deny: empty until an admin explicitly picks resources. */
  selectedResourceIds: string[]
  discovered: DiscoveredResource[]
  /** OrgMember id. */
  connectedBy: string
  connectedAt: string
  lastSync: string | null
  itemCount: number
  cadence: SyncCadence
  error?: string
}

export type GatewayResourceType = 'code' | 'zulip' | 'github' | 'qa' | 'doc'

export interface GatewayResource {
  type: GatewayResourceType
  path: string
  title: string
  url: string | null
}

export interface GatewaySearchResult extends GatewayResource {
  reason: string
}

export type ChatMode = 'ask' | 'search'

export type Persona = 'developer' | 'designer'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  mode: ChatMode
  text: string
  citationIds?: string[]
  searchResultIds?: string[]
  thinking?: string[]
  createdAt: string
  // Present on assistant messages answered by the real Brain gateway (Fabla only),
  // as opposed to the local mock engine (citationIds/searchResultIds above).
  gatewaySources?: GatewayResource[]
  gatewayResults?: GatewaySearchResult[]
  pending?: boolean
  error?: string
}

export interface Conversation {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  // Gateway /ask session id, so follow-up questions keep conversation context.
  gatewaySessionId?: string
}

export type AppStatus = 'operational' | 'degraded' | 'outage'

export interface ProjectMetrics {
  projectId: string
  activeUsers: number
  activeUsersDeltaPct: number
  weeklyActiveUsers: number
  appStatus: AppStatus
  uptime30d: number
}

export type StudyStatus = 'planned' | 'running' | 'completed'

export interface Study {
  id: string
  projectId: string
  name: string
  kind: string
  status: StudyStatus
  summary: string
  owner: string
  startedAt: string
  topicId?: string
}
