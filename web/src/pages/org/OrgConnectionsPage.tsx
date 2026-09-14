import { ExternalLink, Plug } from 'lucide-react'
import { Badge } from '@astryxdesign/core/Badge'
import { Card } from '@astryxdesign/core/Card'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Divider } from '@astryxdesign/core/Divider'
import { Grid } from '@astryxdesign/core/Grid'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { Link } from 'react-router-dom'
import { AVAILABLE_PROVIDERS, COMING_SOON_PROVIDERS } from '../../data/providers'
import { CONNECTION_STATUS_META, describeScope, selectedResourceNames } from '../../lib/connectionStatus'
import { relativeTime } from '../../lib/time'
import { useOrg } from '../../context/OrgContext'

/**
 * Org-wide connection inventory: what this organization has handed over, to
 * which account, scoped to what, and on whose behalf.
 *
 * Deliberately read-only. Changing a connection happens on the project that
 * owns it, so there's exactly one place to reason about "what does this project
 * index" — this page answers the different question of "what have we granted".
 */
export function OrgConnectionsPage() {
  const { connections, getProject, getMember } = useOrg()

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <VStack gap={5}>
        <VStack gap={1}>
          <HStack gap={1.5} vAlign="center">
            <Icon icon={Plug} size="sm" />
            <Text type="body" size="lg" weight="semibold">
              Connections
            </Text>
          </HStack>
          <Text type="body" size="sm" color="secondary">
            Every external grant across your projects. Manage a connection from the project that
            owns it.
          </Text>
        </VStack>

        {AVAILABLE_PROVIDERS.map((provider) => {
          const rows = connections.filter((c) => c.source === provider.id)
          const ProviderIcon = provider.icon

          return (
            <Card key={provider.id} padding={4}>
              <VStack gap={3}>
                <HStack gap={2} vAlign="center">
                  <Icon icon={ProviderIcon} size="sm" />
                  <Text type="body" weight="semibold">
                    {provider.name}
                  </Text>
                  <Badge
                    variant="neutral"
                    label={
                      provider.authKind === 'api_key'
                        ? 'Bot API key'
                        : provider.authKind === 'app_install'
                          ? 'App install'
                          : 'OAuth'
                    }
                  />
                  <div className="ml-auto flex items-center gap-3">
                    <Text type="body" size="xsm" color="secondary">
                      {rows.length} {rows.length === 1 ? 'connection' : 'connections'}
                    </Text>
                    {provider.manageUrl && (
                      <a
                        href={provider.manageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                      >
                        Revoke in {provider.name}
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </HStack>

                {rows.length === 0 ? (
                  <Text type="body" size="sm" color="disabled">
                    Not connected on any project.
                  </Text>
                ) : (
                  <VStack gap={0}>
                    {rows.map((c, index) => {
                      const meta = CONNECTION_STATUS_META[c.status]
                      const project = getProject(c.projectId)
                      const connectedBy = getMember(c.connectedBy)
                      const resources = selectedResourceNames(c)

                      return (
                        <div key={c.id}>
                          {index > 0 && <Divider />}
                          <div className="py-3">
                            <VStack gap={2}>
                              <HStack gap={2} vAlign="center" wrap="wrap">
                                {project ? (
                                  <Link
                                    to={`/p/${project.id}/admin`}
                                    className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline dark:text-neutral-100"
                                  >
                                    {project.name}
                                  </Link>
                                ) : (
                                  <Text type="body" size="sm" color="disabled">
                                    Deleted project
                                  </Text>
                                )}
                                <Badge variant={meta.badgeVariant} label={meta.label} />
                                <div className="ml-auto">
                                  <Text type="body" size="xsm" color="disabled">
                                    {c.lastSync ? `synced ${relativeTime(c.lastSync)}` : 'never synced'}
                                  </Text>
                                </div>
                              </HStack>

                              <Text type="body" size="xsm" color="secondary">
                                {c.accountLabel} · {describeScope(c, provider)} · connected by{' '}
                                {connectedBy?.name ?? 'a former member'} {relativeTime(c.connectedAt)}
                              </Text>

                              {c.error && (
                                <Text type="body" size="xsm" color="secondary">
                                  {c.error}
                                </Text>
                              )}

                              <Collapsible
                                defaultIsOpen={false}
                                trigger={
                                  <Text type="body" size="xsm" color="accent">
                                    Scopes &amp; indexed resources
                                  </Text>
                                }
                              >
                                <VStack gap={2} padding={2}>
                                  <VStack gap={1}>
                                    <Text type="label" size="xsm" color="secondary">
                                      Granted scopes
                                    </Text>
                                    {c.grantedScopes.map((s) => (
                                      <Text key={s} type="code" size="xsm" color="secondary">
                                        {s}
                                      </Text>
                                    ))}
                                  </VStack>
                                  <VStack gap={1}>
                                    <Text type="label" size="xsm" color="secondary">
                                      Indexing
                                    </Text>
                                    <HStack gap={1} wrap="wrap">
                                      {resources.length === 0 ? (
                                        <Text type="body" size="xsm" color="disabled">
                                          Nothing selected
                                        </Text>
                                      ) : (
                                        resources.map((name) => <Token key={name} label={name} size="sm" />)
                                      )}
                                    </HStack>
                                  </VStack>
                                </VStack>
                              </Collapsible>
                            </VStack>
                          </div>
                        </div>
                      )
                    })}
                  </VStack>
                )}
              </VStack>
            </Card>
          )
        })}

        <VStack gap={3}>
          <Text type="label" weight="semibold" color="secondary">
            Coming soon
          </Text>
          <Grid columns={{ minWidth: 200, max: 4 }} gap={3}>
            {COMING_SOON_PROVIDERS.map((provider) => {
              const ProviderIcon = provider.icon
              return (
                <Card key={provider.id} padding={3} variant="muted">
                  <VStack gap={1.5}>
                    <HStack gap={2} vAlign="center">
                      <Icon icon={ProviderIcon} size="sm" color="disabled" />
                      <Text type="body" size="sm" weight="semibold" color="disabled">
                        {provider.name}
                      </Text>
                    </HStack>
                    <Text type="body" size="xsm" color="disabled" maxLines={3}>
                      {provider.authSummary}
                    </Text>
                  </VStack>
                </Card>
              )
            })}
          </Grid>
        </VStack>
      </VStack>
    </div>
  )
}
