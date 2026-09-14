import {
  GitBranch,
  MessageCircle,
  MessagesSquare,
  Frame,
  FileText,
  HardDrive,
  BookOpen,
  ListTodo,
  Mail,
} from 'lucide-react'
import type { AuthKind, ResourceKind, SourceId } from '../types'

export type ComingSoonId = 'drive' | 'confluence' | 'linear' | 'email'
export type ProviderId = SourceId | ComingSoonId

export interface ProviderScope {
  scope: string
  /** Plain-language reason, shown next to the scope before the admin consents. */
  why: string
}

export interface CredentialField {
  key: string
  label: string
  type: 'text' | 'email' | 'password'
  placeholder: string
  help: string
  /** Masked on entry, write-only, never echoed back once saved. */
  isSecret?: boolean
}

export interface ProviderSpec {
  id: ProviderId
  name: string
  icon: typeof GitBranch
  authKind: AuthKind
  /** One line explaining how this provider grants access, shown before consent. */
  authSummary: string
  /** Provider's own wording for the action, e.g. 'Add to Slack'. */
  connectLabel: string
  /** Plural noun for the things being selected, e.g. 'repositories'. */
  resourceNoun: string
  resourceKinds: ResourceKind[]
  scopes: ProviderScope[]
  /** Present only for `api_key` providers — there is no redirect to send the admin on. */
  credentialFields?: CredentialField[]
  /** Caveats an admin should read before handing anything over. */
  safetyNotes: string[]
  /** The provider's own app-management page, for revoking outside this product. */
  manageUrl?: string
  status: 'available' | 'coming_soon'
}

/**
 * How each source is presented in the connect flow.
 *
 * The scope lists here are deliberately read-only and minimal. They are shown
 * verbatim to an admin *before* the handshake, each with a `why`, so that
 * granting access is an informed decision rather than a single blind button.
 *
 * The `authKind` differences are real and load-bearing — GitHub enforces
 * repository selection on its own side, Notion and Slack scope access to what
 * the user shares during consent, and Zulip has no OAuth at all. The UI must
 * not flatten these into one uniform "Connect" affordance.
 */
export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: GitBranch,
    authKind: 'app_install',
    authSummary:
      'Installed as a GitHub App by an org owner. You choose the repositories during install, and GitHub itself enforces that choice.',
    connectLabel: 'Install GitHub App',
    resourceNoun: 'repositories',
    resourceKinds: ['repo'],
    scopes: [
      { scope: 'Metadata: read', why: 'Required by GitHub for any repository access.' },
      { scope: 'Contents: read', why: 'Index code and docs in the repositories you select.' },
      { scope: 'Issues: read', why: 'Index issue threads and their comments.' },
      { scope: 'Pull requests: read', why: 'Index PR discussions and review comments.' },
    ],
    safetyNotes: [
      'Repository access is enforced by GitHub, not by us — repositories you leave out of the install are unreachable even if this app is compromised.',
      'Read-only. The app cannot push code, open issues, or change repository settings.',
    ],
    manageUrl: 'https://github.com/settings/installations',
    status: 'available',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: FileText,
    authKind: 'oauth',
    authSummary:
      'A workspace OAuth integration. During consent you pick which pages and databases to share; everything else in the workspace stays invisible.',
    connectLabel: 'Connect Notion',
    resourceNoun: 'pages & databases',
    resourceKinds: ['page', 'database'],
    scopes: [
      { scope: 'read_content', why: 'Read the pages and databases you share during connect.' },
      { scope: 'read_user_information', why: 'Resolve author IDs so answers can attribute a page to a person.' },
    ],
    safetyNotes: [
      'This uses a workspace OAuth integration, not a personal access token — so it cannot inherit one person’s full workspace access.',
      'Share top-level roots only. A page that already sits beneath a selected root would be synced twice.',
      'No write scope is requested. The integration cannot edit or delete your pages.',
    ],
    manageUrl: 'https://www.notion.so/profile/integrations',
    status: 'available',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessagesSquare,
    authKind: 'oauth',
    authSummary:
      'A workspace-level bot install. The bot can only read channels it has been invited to, so its presence in a channel is a visible signal of what gets indexed.',
    connectLabel: 'Add to Slack',
    resourceNoun: 'channels',
    resourceKinds: ['channel'],
    scopes: [
      { scope: 'channels:read', why: 'List the public channels available to invite the bot into.' },
      { scope: 'channels:history', why: 'Read message history in the channels you select.' },
      { scope: 'users:read', why: 'Resolve user IDs to display names on indexed messages.' },
    ],
    safetyNotes: [
      'The bot reads only channels it is a member of — removing it from a channel immediately ends access to it.',
      'No DM or private-channel scopes are requested. Indexing a private channel would need a deliberate, separate invite.',
    ],
    manageUrl: 'https://slack.com/apps/manage',
    status: 'available',
  },
  {
    id: 'zulip',
    name: 'Zulip',
    icon: MessageCircle,
    authKind: 'api_key',
    authSummary:
      'Zulip has no OAuth, so this needs a bot API key. Create a dedicated bot in your Zulip realm, subscribe it only to the streams you want indexed, and paste its credentials.',
    connectLabel: 'Connect Zulip bot',
    resourceNoun: 'streams',
    resourceKinds: ['stream'],
    scopes: [
      { scope: 'GET /users/me', why: 'Verify the credential works and confirm which bot it belongs to.' },
      { scope: 'GET /users/me/subscriptions', why: 'List the streams this bot is subscribed to.' },
      { scope: 'GET /messages', why: 'Read message history in the streams you select.' },
    ],
    credentialFields: [
      {
        key: 'realmUrl',
        label: 'Zulip realm URL',
        type: 'text',
        placeholder: 'https://yourteam.zulipchat.com',
        help: 'The base URL your team signs in at.',
      },
      {
        key: 'botEmail',
        label: 'Bot email',
        type: 'email',
        placeholder: 'brain-sync-bot@yourteam.zulipchat.com',
        help: 'Use a dedicated bot user, not a person’s account.',
      },
      {
        key: 'apiKey',
        label: 'Bot API key',
        type: 'password',
        placeholder: 'Paste the bot’s API key',
        help: 'Stored encrypted and never displayed again. Rotate it in Zulip to revoke access.',
        isSecret: true,
      },
    ],
    safetyNotes: [
      'Zulip API keys cannot be scoped, so create a dedicated bot user — pasting a person’s own key would grant everything that person can read.',
      'A bot can only read streams it is subscribed to. Its subscription list is the real access boundary, so subscribe it narrowly in Zulip first.',
      'To revoke, regenerate the bot’s API key in Zulip. That takes effect immediately, unlike removing it here.',
    ],
    status: 'available',
  },
  {
    id: 'figma',
    name: 'Figma',
    icon: Frame,
    authKind: 'oauth',
    authSummary:
      'OAuth against your Figma account. You pick which projects and files to index after connecting.',
    connectLabel: 'Connect Figma',
    resourceNoun: 'files',
    resourceKinds: ['file'],
    scopes: [
      { scope: 'files:read', why: 'Read the files and projects you select.' },
      { scope: 'file_comments:read', why: 'Index design feedback left as comments on a file.' },
    ],
    safetyNotes: [
      'Read-only. Nothing can be edited, renamed, or published back to Figma.',
      'Exported image URLs from Figma expire, so answers link back to the file rather than embedding stale previews.',
    ],
    manageUrl: 'https://www.figma.com/developers/apps',
    status: 'available',
  },

  // --- Not built yet. Shown disabled so the surface reads as a real
  // integrations directory and sets expectations for what comes next. ---
  {
    id: 'drive',
    name: 'Google Drive',
    icon: HardDrive,
    authKind: 'oauth',
    authSummary: 'Will connect a shared drive or folder via Google OAuth.',
    connectLabel: 'Connect Google Drive',
    resourceNoun: 'folders',
    resourceKinds: ['file'],
    scopes: [],
    safetyNotes: [],
    status: 'coming_soon',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    icon: BookOpen,
    authKind: 'oauth',
    authSummary: 'Will connect selected spaces via an Atlassian OAuth app.',
    connectLabel: 'Connect Confluence',
    resourceNoun: 'spaces',
    resourceKinds: ['page'],
    scopes: [],
    safetyNotes: [],
    status: 'coming_soon',
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: ListTodo,
    authKind: 'oauth',
    authSummary: 'Will connect selected teams and index issues and projects.',
    connectLabel: 'Connect Linear',
    resourceNoun: 'teams',
    resourceKinds: ['repo'],
    scopes: [],
    safetyNotes: [],
    status: 'coming_soon',
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    authKind: 'oauth',
    authSummary:
      'Will connect one shared mailbox per organization via Gmail or Microsoft Graph — never individual inboxes.',
    connectLabel: 'Connect a shared mailbox',
    resourceNoun: 'mailboxes',
    resourceKinds: ['channel'],
    scopes: [],
    safetyNotes: [],
    status: 'coming_soon',
  },
]

export const AVAILABLE_PROVIDERS = PROVIDERS.filter((p) => p.status === 'available')
export const COMING_SOON_PROVIDERS = PROVIDERS.filter((p) => p.status === 'coming_soon')

/** Providers backed by a real `SourceId`, i.e. the ones a project can connect today. */
export const CONNECTABLE_SOURCES = AVAILABLE_PROVIDERS.map((p) => p.id as SourceId)

export function getProvider(id: ProviderId): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

/** Throwing lookup for the connect flow, where an unknown provider is a bug. */
export function requireProvider(id: ProviderId): ProviderSpec {
  const spec = getProvider(id)
  if (!spec) throw new Error(`Unknown provider: ${id}`)
  return spec
}
