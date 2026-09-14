import { useParams } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { Banner } from '@astryxdesign/core/Banner'
import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import type { SourceId } from '../types'
import { AVAILABLE_PROVIDERS, COMING_SOON_PROVIDERS } from '../data/providers'
import { useOrg } from '../context/OrgContext'
import { ConnectionCard } from '../components/ConnectionCard'

export function SourcesAdmin() {
  const { projectId = '' } = useParams()
  const { getProject, connectionFor, connectionsForProject } = useOrg()

  const project = getProject(projectId)
  const connections = connectionsForProject(projectId)
  const needsAttention = connections.filter(
    (c) => c.status === 'reauth_required' || c.status === 'error',
  )

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <VStack gap={5}>
        <VStack gap={1}>
          <HStack gap={1.5} vAlign="center">
            <Icon icon={Settings2} size="sm" />
            <Text type="body" size="lg" weight="semibold">
              Sources &amp; Sync
            </Text>
          </HStack>
          <Text type="body" size="sm" color="secondary">
            What {project?.name ?? 'this project'} indexes, and the account each connection runs as.
            Only the resources selected here are ever read.
          </Text>
        </VStack>

        {needsAttention.length > 0 && (
          <Banner
            status={needsAttention.some((c) => c.status === 'reauth_required') ? 'error' : 'warning'}
            title={`${needsAttention.length} connection${needsAttention.length === 1 ? '' : 's'} need attention`}
            description={needsAttention
              .map((c) => `${c.source}: ${c.error ?? 'see below'}`)
              .join(' · ')}
          />
        )}

        <Grid columns={{ minWidth: 320, max: 2 }} gap={4}>
          {AVAILABLE_PROVIDERS.map((provider) => (
            <ConnectionCard
              key={provider.id}
              provider={provider}
              projectId={projectId}
              connection={connectionFor(projectId, provider.id as SourceId)}
            />
          ))}
        </Grid>

        <VStack gap={3}>
          <VStack gap={0.5}>
            <Text type="label" weight="semibold" color="secondary">
              Coming soon
            </Text>
            <Text type="body" size="xsm" color="disabled">
              Not available yet. Each needs the same treatment as the connectors above — least
              privilege scopes, explicit resource selection, and a revocation path.
            </Text>
          </VStack>
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
