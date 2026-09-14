import { Badge } from '@astryxdesign/core/Badge'
import { Token } from '@astryxdesign/core/Token'
import { HStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import type { ProjectAccess } from '../types'
import { useOrg } from '../context/OrgContext'
import { projectsForAccess } from '../lib/access'

/**
 * Renders a ProjectAccess grant. Used by the members table, the invite
 * preview and the accept-invite page so all three describe the same grant
 * identically — an admin should never see one number here and a different one
 * there.
 */
export function AccessSummary({ access, max = 3 }: { access: ProjectAccess; max?: number }) {
  const { projects } = useOrg()

  if (access.kind === 'all') {
    return <Badge variant="info" label="All projects" />
  }

  const named = projectsForAccess(access, projects)
  if (named.length === 0) {
    // A grant with nothing in it is a mistake worth surfacing rather than
    // rendering as an empty cell.
    return <Badge variant="warning" label="No projects" />
  }

  const shown = named.slice(0, max)
  const overflow = named.length - shown.length

  return (
    <HStack gap={1} vAlign="center" wrap="wrap">
      {shown.map((p) => (
        <Token key={p.id} label={p.name} size="sm" />
      ))}
      {overflow > 0 && (
        <Text type="body" size="xsm" color="secondary">
          +{overflow} more
        </Text>
      )}
    </HStack>
  )
}
