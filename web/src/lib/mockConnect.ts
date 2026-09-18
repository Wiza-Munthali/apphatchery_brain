import type { DiscoveredResource } from '../types'
import { requireProvider, type ProviderId } from '../data/providers'

/**
 * Stand-in for the provider handshakes, so the connect UI can be built and
 * demoed against real async states — pending, failure, and a discovered
 * resource list — without a backend.
 *
 * In production none of this runs in the browser: the OAuth redirect goes
 * browser → provider → gateway, the gateway holds the credential, and the
 * client only ever receives the account label, granted scopes, and the
 * discovered resource list returned below. Keeping that same return shape here
 * means swapping in the real calls later touches this file only.
 */

export interface HandshakeResult {
  accountLabel: string
  grantedScopes: string[]
  discovered: DiscoveredResource[]
}

export class CredentialError extends Error {}

/** Mock-only: any key at least this long is treated as valid. */
export const MOCK_MIN_KEY_LENGTH = 16

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const repo = (name: string, hint?: string, selectable = true): DiscoveredResource => ({
  id: `repo:${name}`,
  name,
  kind: 'repo',
  hint,
  selectable,
})

const DISCOVERED: Record<string, DiscoveredResource[]> = {
  github: [
    repo('AppHatchery/Fabla-Front-end'),
    repo('AppHatchery/Fabla-Backend'),
    repo('AppHatchery/apphatchery-brain'),
    repo('AppHatchery/TypeU-App'),
    repo('AppHatchery/website'),
    repo('AppHatchery/infra', 'Private'),
    repo('AppHatchery/legacy-dashboard', 'Archived — no recent activity', false),
  ],

  // Mirrors the shape of a real `--list` against the Fabla workspace, which the
  // backend's notion_sync_config.yaml documents: ~183 objects, heavy title
  // duplication, and no parent information to tell roots from children apart.
  // The picker has to make that mess navigable rather than pretend it's clean.
  notion: [
    { id: 'page:audio-diaries', name: 'Fabla - Audio Diaries', kind: 'page', hint: '~130 pages', selectable: true },
    { id: 'db:feature-design', name: 'Fabla Feature and Design Decisions List', kind: 'database', selectable: true },
    { id: 'db:releases', name: 'Fabla Releases & Features', kind: 'database', selectable: true },
    { id: 'db:design-research', name: 'Fabla Design / Research', kind: 'database', selectable: true },
    { id: 'db:design-tasks', name: 'Fabla Design Tasks', kind: 'database', selectable: true },
    { id: 'db:roadmap', name: 'Fabla Roadmap Jan - April 2026', kind: 'database', selectable: true },
    { id: 'page:architecture', name: 'Fabla Architecture Documentation', kind: 'page', selectable: true },
    { id: 'page:question-types', name: 'Fabla Question Types', kind: 'page', selectable: true },
    {
      id: 'page:fabla-dup',
      name: 'Fabla',
      kind: 'page',
      hint: '22 pages share this title — select the parent database instead',
      selectable: false,
    },
    {
      id: 'page:fabla-m7',
      name: 'Fabla M7 - DEV',
      kind: 'page',
      hint: 'Child of “Fabla - Audio Diaries” — already covered by that root',
      selectable: false,
    },
  ],

  // Slack's access boundary is channel membership, so channels the bot has not
  // been invited to are shown but not selectable. That makes the boundary
  // legible instead of silently omitting them.
  slack: [
    { id: 'chan:fabla-pod', name: '#fabla-pod', kind: 'channel', selectable: true },
    { id: 'chan:eng', name: '#eng', kind: 'channel', selectable: true },
    { id: 'chan:releases', name: '#releases', kind: 'channel', selectable: true },
    {
      id: 'chan:general',
      name: '#general',
      kind: 'channel',
      hint: 'Invite the bot to this channel first',
      selectable: false,
    },
    {
      id: 'chan:design',
      name: '#design',
      kind: 'channel',
      hint: 'Invite the bot to this channel first',
      selectable: false,
    },
    {
      id: 'chan:incidents',
      name: '#incidents',
      kind: 'channel',
      hint: 'Private — the bot cannot request access on its own',
      selectable: false,
    },
  ],

  zulip: [
    { id: 'stream:fabla-pod', name: 'fabla pod', kind: 'stream', selectable: true },
    { id: 'stream:engineering', name: 'engineering', kind: 'stream', selectable: true },
    {
      id: 'stream:general',
      name: 'general',
      kind: 'stream',
      hint: 'Bot is not subscribed — subscribe it in Zulip first',
      selectable: false,
    },
    {
      id: 'stream:design',
      name: 'design',
      kind: 'stream',
      hint: 'Bot is not subscribed — subscribe it in Zulip first',
      selectable: false,
    },
  ],

  figma: [
    { id: 'file:fabla-app', name: 'Fabla App', kind: 'file', selectable: true },
    { id: 'file:fabla-ds', name: 'Fabla Design System', kind: 'file', selectable: true },
    { id: 'file:typeu-onboarding', name: 'TypeU Onboarding', kind: 'file', selectable: true },
    { id: 'file:brand', name: 'Brand', kind: 'file', hint: 'Read-only for this account', selectable: true },
  ],
}

const ACCOUNT_LABELS: Record<string, string> = {
  github: 'AppHatchery · fine-grained token',
  notion: 'AppHatchery workspace · Brain integration',
  slack: 'AppHatchery · Brain bot',
  figma: 'AppHatchery · Brain (OAuth)',
}

export function discoveredFor(providerId: ProviderId): DiscoveredResource[] {
  return DISCOVERED[providerId] ?? []
}

/**
 * Simulates the redirect-based handshake for `oauth` and `app_install`
 * providers. Resolves with the identity and resource list the gateway would
 * hand back — never a credential.
 */
export async function beginConnect(providerId: ProviderId): Promise<HandshakeResult> {
  const spec = requireProvider(providerId)
  await delay(1100)
  return {
    accountLabel: ACCOUNT_LABELS[providerId] ?? `${spec.name} account`,
    grantedScopes: spec.scopes.map((s) => s.scope),
    discovered: discoveredFor(providerId),
  }
}

/** How a verified connection identifies itself, per provider. */
function accountLabelFor(providerId: ProviderId, fields: Record<string, string>): string {
  if (providerId === 'zulip') return fields.botEmail?.trim() || 'Zulip bot'
  return ACCOUNT_LABELS[providerId] ?? `${requireProvider(providerId).name} account`
}

/**
 * Simulates verifying pasted credentials (the `api_key` path — GitHub, Notion
 * and Zulip). Rejects with a `CredentialError` so the dialog can show an
 * inline error rather than a crash.
 *
 * Validation is driven by each provider's own `credentialFields`, so the
 * expected token shapes stay described in one place (providers.ts) instead of
 * being duplicated as conditionals here.
 *
 * The submitted `fields` are used and discarded. They are never returned,
 * stored, or logged — see the note in lib/orgStore.ts.
 */
export async function verifyCredential(
  providerId: ProviderId,
  fields: Record<string, string>,
): Promise<HandshakeResult> {
  const spec = requireProvider(providerId)
  await delay(900)

  for (const field of spec.credentialFields ?? []) {
    const value = (fields[field.key] ?? '').trim()

    if (!value) {
      throw new CredentialError(`${field.label} is required.`)
    }
    if (field.type === 'email' && !value.includes('@')) {
      throw new CredentialError(`${field.label} should be a full email address.`)
    }
    if (field.pattern && !new RegExp(field.pattern).test(value)) {
      throw new CredentialError(field.patternHint ?? `${field.label} doesn’t look right.`)
    }
    if (field.isSecret && value.length < MOCK_MIN_KEY_LENGTH) {
      throw new CredentialError(
        `${spec.name} rejected these credentials (401). Check the value and regenerate it if needed.`,
      )
    }
  }

  return {
    accountLabel: accountLabelFor(providerId, fields),
    grantedScopes: spec.scopes.map((s) => s.scope),
    discovered: discoveredFor(providerId),
  }
}
