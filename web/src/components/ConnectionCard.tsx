import { useState } from 'react'
import { ExternalLink, Plug, RefreshCw } from 'lucide-react'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Divider } from '@astryxdesign/core/Divider'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import type { Connection } from '../types'
import type { ProviderSpec } from '../data/providers'
import { CONNECTION_STATUS_META, describeScope } from '../lib/connectionStatus'
import { relativeTime, absoluteTime } from '../lib/time'
import { useOrg } from '../context/OrgContext'
import { ConnectSourceDialog } from './ConnectSourceDialog'

/**
 * One provider's state for one project.
 *
 * Renders only identity and scope — the account the sync runs as, and what it
 * was pointed at. There is deliberately nothing here that could display a
 * credential, because the client is never given one.
 */
export function ConnectionCard({
  provider,
  projectId,
  connection,
}: {
  provider: ProviderSpec
  projectId: string
  connection?: Connection
}) {
  const { resync, disconnect } = useOrg()
  const [connectOpen, setConnectOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const status = connection?.status ?? 'not_connected'
  const meta = CONNECTION_STATUS_META[status]
  const ProviderIcon = provider.icon

  return (
    <>
      {/* data-source gives each card a stable hook for tests and for support
          ("open devtools, find data-source=notion") without relying on DOM shape. */}
      <Card padding={4} data-source={provider.id}>
        <VStack gap={3}>
          <HStack gap={2} vAlign="center">
            <Icon icon={ProviderIcon} size="sm" />
            <Text type="body" weight="semibold">
              {provider.name}
            </Text>
            {/* StatusDot is an 8px dot with only an aria-label, so the status
                is spelled out beside it — colour alone shouldn't be what
                separates "retry this" from "the credential is gone". */}
            <HStack gap={1.5} vAlign="center" className="ml-auto">
              <StatusDot variant={meta.dotVariant} label={meta.label} isPulsing={meta.isPulsing} />
              <Text type="body" size="xsm" color="secondary">
                {meta.label}
              </Text>
            </HStack>
          </HStack>

          {connection ? (
            <VStack gap={1}>
              <Text type="body" size="xsm" color="secondary">
                {connection.accountLabel}
              </Text>
              <Text type="body" size="sm">
                {describeScope(connection, provider)}
              </Text>
              <HStack gap={1.5} vAlign="center" wrap="wrap">
                <span title={connection.lastSync ? absoluteTime(connection.lastSync) : undefined}>
                  <Text type="body" size="xsm" color="disabled">
                    {connection.lastSync ? `Last sync ${relativeTime(connection.lastSync)}` : 'Never synced'}
                  </Text>
                </span>
                <Text type="body" size="xsm" color="disabled">
                  · {connection.itemCount} items indexed
                </Text>
                <Badge variant="neutral" label={connection.cadence} />
              </HStack>
            </VStack>
          ) : (
            <Text type="body" size="sm" color="secondary">
              {provider.authSummary}
            </Text>
          )}

          {connection?.error && (
            <Text type="body" size="xsm" color={status === 'reauth_required' ? 'accent' : 'secondary'}>
              {connection.error}
            </Text>
          )}
          {meta.remediation && (
            <Text type="body" size="xsm" color="disabled">
              {meta.remediation}
            </Text>
          )}

          <Divider />

          {connection ? (
            <HStack gap={2} vAlign="center" wrap="wrap">
              {status === 'reauth_required' ? (
                <Button
                  label="Reconnect"
                  variant="primary"
                  size="sm"
                  icon={<Icon icon={Plug} size="xsm" />}
                  onClick={() => setConnectOpen(true)}
                />
              ) : (
                <Button
                  label={status === 'error' ? 'Retry sync' : 'Resync now'}
                  size="sm"
                  icon={<Icon icon={RefreshCw} size="xsm" />}
                  isDisabled={status === 'syncing'}
                  tooltip="A sync is already running."
                  onClick={() => resync(connection.id)}
                />
              )}
              <Button label="Edit scope" size="sm" onClick={() => setScopeOpen(true)} />
              <div className="ml-auto flex items-center gap-3">
                {provider.manageUrl && (
                  <a
                    href={provider.manageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                  >
                    Manage in {provider.name}
                    <ExternalLink size={11} />
                  </a>
                )}
                <Button
                  label="Disconnect"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDisconnect(true)}
                />
              </div>
            </HStack>
          ) : (
            <HStack gap={2}>
              <Button
                label={provider.connectLabel}
                variant="primary"
                size="sm"
                onClick={() => setConnectOpen(true)}
              />
            </HStack>
          )}
        </VStack>
      </Card>

      <ConnectSourceDialog
        isOpen={connectOpen}
        onOpenChange={setConnectOpen}
        provider={provider}
        projectId={projectId}
        connection={connection}
        mode="connect"
      />

      {connection && (
        <ConnectSourceDialog
          isOpen={scopeOpen}
          onOpenChange={setScopeOpen}
          provider={provider}
          projectId={projectId}
          connection={connection}
          mode="edit-scope"
        />
      )}

      {connection && (
        <AlertDialog
          isOpen={confirmDisconnect}
          onOpenChange={setConfirmDisconnect}
          title={`Disconnect ${provider.name}?`}
          // Spelled out because both halves surprise people: content actually
          // disappears from answers, and removing the connection here does not
          // revoke the grant on the provider's side.
          description={`Content synced from ${provider.name} will be removed from this project and will stop appearing in answers. This does not revoke access on ${provider.name} — do that separately if you want the grant gone.`}
          actionLabel="Disconnect"
          actionVariant="destructive"
          onAction={() => {
            disconnect(connection.id)
            setConfirmDisconnect(false)
          }}
        />
      )}
    </>
  )
}
