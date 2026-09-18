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
  /** Expected format, validated on submit so a wrong-shaped paste fails fast. */
  pattern?: string
  patternHint?: string
}

/**
 * One instruction in a provider's setup guide.
 *
 * These are transcribed from DATA_SOURCES.md in the backend repo, which
 * documents what each sync script actually requires. The `warning` fields are
 * the highest-value part: they're the failure modes that otherwise present as
 * something unrelated (a Zulip bot with no subscriptions looks like a "can't
 * list topics" bug, not an access problem).
 */
export interface SetupStep {
  title: string
  detail?: string
  /** Deep link to the exact settings page this step refers to. */
  link?: { label: string; href: string }
  /** A gotcha that bites at precisely this step. */
  warning?: string
  /** Sub-points, for steps with several conditions. */
  bullets?: string[]
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
  /** What an admin must do in the provider before this connection can work. */
  setupSteps: SetupStep[]
  /** Roughly how long the setup takes, so nobody starts it between meetings. */
  setupMinutes?: number
  /** Caveats an admin should read before handing anything over. */
  safetyNotes: string[]
  /** The provider's own app-management page, for revoking outside this product. */
  manageUrl?: string
  /**
   * Whether a backend sync script exists for this source today. Zulip, GitHub
   * and Notion are documented in DATA_SOURCES.md; the others are not built yet,
   * and the UI says so rather than implying content will appear.
   */
  syncAvailable: boolean
  status: 'available' | 'coming_soon'
}

/**
 * How each source is presented in the connect flow.
 *
 * Auth kinds and setup steps mirror the real backend connectors documented in
 * DATA_SOURCES.md — GitHub authenticates with a personal access token, Notion
 * with an internal integration secret plus per-page sharing, Zulip with a bot's
 * zuliprc credentials. These are genuinely different models and the UI does not
 * flatten them into one uniform "Connect" button.
 *
 * Scope lists are read-only and minimal, shown verbatim *before* the handshake
 * with a `why` for each, so granting access is an informed decision.
 */
export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: GitBranch,
    authKind: 'api_key',
    authSummary:
      'Authenticates with a fine-grained personal access token, scoped read-only to the repositories you choose when you create it.',
    connectLabel: 'Connect GitHub',
    resourceNoun: 'repositories',
    resourceKinds: ['repo'],
    setupMinutes: 3,
    scopes: [
      { scope: 'Metadata: read', why: 'Required by GitHub for any repository access.' },
      { scope: 'Contents: read', why: 'Index code and docs in the repositories you select.' },
      { scope: 'Issues: read', why: 'Index issue threads and their comments.' },
      { scope: 'Pull requests: read', why: 'Index pull request discussions.' },
    ],
    credentialFields: [
      {
        key: 'token',
        label: 'Personal access token',
        type: 'password',
        placeholder: 'github_pat_… or ghp_…',
        help: 'Stored encrypted and never shown again. Revoke it on GitHub to cut access immediately.',
        isSecret: true,
        pattern: '^(github_pat_|ghp_|gho_)',
        patternHint: 'GitHub tokens start with github_pat_ (fine-grained) or ghp_ (classic).',
      },
    ],
    setupSteps: [
      {
        title: 'Create a fine-grained personal access token',
        detail:
          'On GitHub, go to Settings → Developer settings → Personal access tokens → Fine-grained tokens, then Generate new token.',
        link: {
          label: 'Open GitHub token settings',
          href: 'https://github.com/settings/personal-access-tokens/new',
        },
      },
      {
        title: 'Limit it to the repositories this project needs',
        detail:
          'Under Repository access choose “Only select repositories” and pick them explicitly. This is the real access boundary — repositories left out are unreachable even if the token leaks.',
      },
      {
        title: 'Grant read-only repository permissions',
        detail: 'Contents: Read-only, Issues: Read-only, Pull requests: Read-only. Nothing else is needed.',
        warning:
          'Do not grant any write permission. The sync only ever reads, and a write-capable token is a much worse thing to lose.',
      },
      {
        title: 'Copy the token',
        detail:
          'GitHub shows it exactly once — you’ll paste it into the connection form. If you already use the GitHub CLI locally, `gh auth token` prints an equivalent token.',
      },
    ],
    safetyNotes: [
      'Read-only. The token cannot push code, open issues, or change repository settings.',
      'Only issue-level comments are synced — pull request review threads live on a different API and are not indexed.',
      'A token limited to selected repositories cannot see anything else in the organization, even if it is compromised.',
    ],
    manageUrl: 'https://github.com/settings/tokens',
    syncAvailable: true,
    status: 'available',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: FileText,
    authKind: 'api_key',
    authSummary:
      'Uses an internal integration with read-only capability. A fresh integration can see nothing at all — you share pages with it one at a time, and that sharing is the access boundary.',
    connectLabel: 'Connect Notion',
    resourceNoun: 'pages & databases',
    resourceKinds: ['page', 'database'],
    setupMinutes: 5,
    scopes: [
      {
        scope: 'Read content',
        why: 'Read the pages and databases you explicitly share with the integration.',
      },
    ],
    credentialFields: [
      {
        key: 'token',
        label: 'Internal integration secret',
        type: 'password',
        placeholder: 'ntn_…',
        help: 'Stored encrypted and never displayed again. Rotate it in Notion to revoke access.',
        isSecret: true,
        pattern: '^(ntn_|secret_)',
        patternHint: 'Notion integration secrets start with ntn_ (or secret_ on older integrations).',
      },
    ],
    setupSteps: [
      {
        title: 'Create an internal integration',
        detail:
          'Go to Notion’s integrations page and choose New integration. Pick the workspace and set Type to Internal.',
        link: {
          label: 'Open Notion integrations',
          href: 'https://www.notion.so/profile/integrations',
        },
      },
      {
        title: 'Enable only “Read content”',
        detail:
          'Under Capabilities, turn on Read content and leave everything else off. This connection never writes to Notion.',
      },
      {
        title: 'Copy the Internal Integration Secret',
        detail: 'It starts with ntn_. You’ll paste it into the connection form.',
      },
      {
        title: 'Share each page or database with the integration',
        detail:
          'Open the page, click the ••• in the top-right of the window, scroll to Connections → Add connections, pick your integration, and Confirm. Child pages inherit access, so connecting the highest ancestor covers the whole subtree.',
        warning:
          'This is the step people miss. A valid secret on its own sees nothing — Notion has no “read my whole workspace” permission, so until you share a page here, the next step will come back empty.',
        bullets: [
          'That is the page menu in the window’s top-right corner — not a block’s ••• handle, and not the Share button.',
          'You need Full access on a page to add a connection to it.',
          'For a database, connect it on the database’s own full page — open a linked view with ⤢ Open as full page first.',
          'Teamspaces cannot be connected in one go; do it per top-level page.',
          'If the integration is missing from the list, a workspace admin has restricted installs and must approve it under Settings → Connections.',
        ],
      },
      {
        title: 'Pick top-level roots only, on the next step',
        detail:
          'Child pages are indexed automatically. Selecting a page that already sits under another selection would index it twice.',
      },
    ],
    safetyNotes: [
      'An internal integration is not tied to your personal account, so it does not inherit everything you can see.',
      'No write capability is requested — the integration cannot edit, move or delete your pages.',
      'Images uploaded into Notion come back as links that expire about an hour after each sync; externally hosted images keep working.',
    ],
    manageUrl: 'https://www.notion.so/profile/integrations',
    syncAvailable: true,
    status: 'available',
  },
  {
    id: 'zulip',
    name: 'Zulip',
    icon: MessageCircle,
    authKind: 'api_key',
    authSummary:
      'Zulip has no OAuth, so this uses a bot’s API credentials. The bot only reads streams it is subscribed to, which makes its subscription list the access boundary.',
    connectLabel: 'Connect Zulip bot',
    resourceNoun: 'streams',
    resourceKinds: ['stream'],
    setupMinutes: 4,
    scopes: [
      { scope: 'GET /users/me', why: 'Verify the credentials work and confirm which bot they belong to.' },
      { scope: 'GET /users/me/subscriptions', why: 'List the streams this bot can actually read.' },
      { scope: 'GET /messages', why: 'Read message history in the streams you select.' },
    ],
    credentialFields: [
      {
        key: 'realmUrl',
        label: 'Zulip site URL',
        type: 'text',
        placeholder: 'https://yourteam.zulipchat.com',
        help: 'The `site` value from the bot’s zuliprc — the base URL your team signs in at.',
        pattern: '^https?://',
        patternHint: 'Include the scheme, e.g. https://yourteam.zulipchat.com',
      },
      {
        key: 'botEmail',
        label: 'Bot email',
        type: 'email',
        placeholder: 'brain-sync-bot@yourteam.zulipchat.com',
        help: 'The `email` value from the zuliprc. Use a dedicated bot, not a person’s account.',
      },
      {
        key: 'apiKey',
        label: 'Bot API key',
        type: 'password',
        placeholder: 'Paste the bot’s API key',
        help: 'The `api_key` value from the zuliprc. Stored encrypted and never displayed again.',
        isSecret: true,
      },
    ],
    setupSteps: [
      {
        title: 'Create a dedicated bot',
        detail:
          'In Zulip go to Settings → Organization settings → Bots → Add a new bot, and choose type Generic. Name it something recognisable, like “Brain sync”.',
        warning:
          'Use a bot rather than your own API key. A bot can be revoked without touching anyone’s login, and it only ever sees the streams it has been subscribed to.',
      },
      {
        title: 'Download the bot’s zuliprc',
        detail:
          'Zulip offers a zuliprc file for the new bot. It is a short text file containing three values — site, email and api_key — which you paste below.',
      },
      {
        title: 'Subscribe the bot to every stream you want indexed',
        detail:
          'Open each stream, go to its Subscribers tab, and add the bot. Only subscribed streams can be read.',
        warning:
          'Skip this and the connection still looks valid, but the next step will list no streams at all — the failure shows up as “nothing to sync”, not as an access error.',
        bullets: [
          'Private streams need someone who is already a member to add the bot.',
          'Subscribing the bot later is fine — re-run a sync and the new stream is picked up.',
        ],
      },
    ],
    safetyNotes: [
      'Zulip API keys cannot be scoped, which is exactly why this should be a dedicated bot — a personal key would grant everything that person can read.',
      'The bot’s stream subscriptions are the real boundary. Subscribe it narrowly.',
      'To revoke, regenerate the bot’s API key in Zulip. That takes effect immediately, unlike removing the connection here.',
      'Message edits and deletions made after a sync are not picked up — Zulip content is treated as append-only.',
    ],
    syncAvailable: true,
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
    setupMinutes: 3,
    scopes: [
      { scope: 'channels:read', why: 'List the public channels available to invite the bot into.' },
      { scope: 'channels:history', why: 'Read message history in the channels you select.' },
      { scope: 'users:read', why: 'Resolve user IDs to display names on indexed messages.' },
    ],
    setupSteps: [
      {
        title: 'Approve the install for your workspace',
        detail:
          'Add to Slack sends you to Slack’s own consent screen, listing the read-only scopes above. A workspace admin may need to approve it.',
      },
      {
        title: 'Invite the bot to each channel you want indexed',
        detail: 'In the channel, type /invite @Brain. The bot appears in the member list, so anyone in the channel can see it is there.',
        warning:
          'Channels the bot has not been invited to are shown on the next step but cannot be selected. Invite it first, then come back.',
      },
    ],
    safetyNotes: [
      'The bot reads only channels it is a member of — removing it from a channel immediately ends access to it.',
      'No DM or private-channel scopes are requested. Indexing a private channel would need a deliberate, separate invite.',
    ],
    manageUrl: 'https://slack.com/apps/manage',
    syncAvailable: false,
    status: 'available',
  },
  {
    id: 'figma',
    name: 'Figma',
    icon: Frame,
    authKind: 'oauth',
    authSummary: 'OAuth against your Figma account. You pick which files to index after connecting.',
    connectLabel: 'Connect Figma',
    resourceNoun: 'files',
    resourceKinds: ['file'],
    setupMinutes: 2,
    scopes: [
      { scope: 'files:read', why: 'Read the files and projects you select.' },
      { scope: 'file_comments:read', why: 'Index design feedback left as comments on a file.' },
    ],
    setupSteps: [
      {
        title: 'Authorize with your Figma account',
        detail: 'Connect Figma opens Figma’s consent screen for the read-only scopes above.',
      },
      {
        title: 'Make sure you can open the files you want indexed',
        detail: 'The connection sees exactly what your Figma account can see. Files in teams you are not a member of will not appear.',
      },
    ],
    safetyNotes: [
      'Read-only. Nothing can be edited, renamed, or published back to Figma.',
      'Exported image URLs from Figma expire, so answers link back to the file rather than embedding stale previews.',
    ],
    manageUrl: 'https://www.figma.com/developers/apps',
    syncAvailable: false,
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
    setupSteps: [],
    safetyNotes: [],
    syncAvailable: false,
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
    setupSteps: [],
    safetyNotes: [],
    syncAvailable: false,
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
    setupSteps: [],
    safetyNotes: [],
    syncAvailable: false,
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
    setupSteps: [],
    safetyNotes: [],
    syncAvailable: false,
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
