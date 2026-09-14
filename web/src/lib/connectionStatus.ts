import type { Connection, ConnectionStatus } from '../types'
import type { ProviderSpec } from '../data/providers'

/**
 * Presentation for each connection status, in one place so the project cards,
 * the per-project connections page and the org-wide inventory agree.
 *
 * `error` and `reauth_required` are separate on purpose: a failed sync is
 * retryable with the credential we already hold, while a revoked or expired
 * credential can only be fixed by re-running the connect flow. Collapsing them
 * would send an admin to the wrong button.
 */
export const CONNECTION_STATUS_META: Record<
  ConnectionStatus,
  {
    label: string
    dotVariant: 'success' | 'warning' | 'error' | 'accent' | 'neutral'
    badgeVariant: 'success' | 'warning' | 'error' | 'neutral' | 'info'
    isPulsing?: boolean
    /** What the admin should do next, if anything. */
    remediation?: string
  }
> = {
  not_connected: {
    label: 'Not connected',
    dotVariant: 'neutral',
    badgeVariant: 'neutral',
  },
  connected: {
    label: 'Connected',
    dotVariant: 'success',
    badgeVariant: 'success',
  },
  syncing: {
    label: 'Syncing',
    dotVariant: 'accent',
    badgeVariant: 'info',
    isPulsing: true,
  },
  error: {
    label: 'Sync failed',
    dotVariant: 'warning',
    badgeVariant: 'warning',
    remediation: 'Retry the sync. The credential is still valid.',
  },
  reauth_required: {
    label: 'Reconnect required',
    dotVariant: 'error',
    badgeVariant: 'error',
    remediation: 'The credential was revoked or expired. Reconnect to restore access.',
  },
}

/** e.g. '2 of 7 repositories'. */
export function describeScope(connection: Connection, provider: ProviderSpec): string {
  const total = connection.discovered.length
  const selected = connection.selectedResourceIds.length
  if (total === 0) return `${selected} ${provider.resourceNoun}`
  return `${selected} of ${total} ${provider.resourceNoun}`
}

/** Names of the resources actually selected, for tooltips and detail rows. */
export function selectedResourceNames(connection: Connection): string[] {
  return connection.discovered
    .filter((r) => connection.selectedResourceIds.includes(r.id))
    .map((r) => r.name)
}
