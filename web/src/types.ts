export type SourceId = 'github' | 'zulip' | 'figma' | 'notion'

export type ItemTag = 'delivery' | 'feature' | 'issue' | 'milestone' | 'update'

export interface Project {
  id: string
  name: string
  description: string
  color: string
  initial: string
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

export type ConnectorStatus = 'connected' | 'syncing' | 'error'

export interface SourceConnector {
  id: SourceId
  projectId: string
  name: string
  status: ConnectorStatus
  scope: string
  lastSync: string
  itemCount: number
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
