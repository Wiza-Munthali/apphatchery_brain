import { useParams } from 'react-router-dom'
import { LayoutDashboard, FlaskConical, CheckCircle2, PlayCircle, Clock } from 'lucide-react'
import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { Text } from '@astryxdesign/core/Text'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Badge } from '@astryxdesign/core/Badge'
import { Icon, type IconType } from '@astryxdesign/core/Icon'
import { studiesForProject } from '../data/mockData'
import { useOrg } from '../context/OrgContext'
import { relativeTime } from '../lib/time'
import type { StudyStatus } from '../types'

const STUDY_STATUS_META: Record<StudyStatus, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  running: { label: 'In progress', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  planned: { label: 'To start', variant: 'neutral' },
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: IconType }) {
  return (
    <Card padding={4}>
      <VStack gap={1.5}>
        <HStack gap={1.5} vAlign="center">
          <Icon icon={icon} size="sm" />
          <Text type="label" color="secondary">
            {label}
          </Text>
        </HStack>
        <Text type="body" size="2xl" weight="semibold">
          {value}
        </Text>
      </VStack>
    </Card>
  )
}

export function DashboardPage() {
  const { projectId = '' } = useParams()
  const { getProject } = useOrg()
  const project = getProject(projectId)
  const studies = studiesForProject(projectId)

  const completedCount = studies.filter((s) => s.status === 'completed').length
  const runningCount = studies.filter((s) => s.status === 'running').length
  const plannedCount = studies.filter((s) => s.status === 'planned').length

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <VStack gap={1}>
        <HStack gap={1.5} vAlign="center">
          <Icon icon={LayoutDashboard} size="sm" />
          <Text type="body" size="lg" weight="semibold">
            Dashboard
          </Text>
        </HStack>
        <Text type="body" size="sm" color="secondary">
          EMA studies conducted using {project?.name ?? 'this project'}.
        </Text>
      </VStack>

      <div className="mt-6">
        <Grid columns={{ minWidth: 200, max: 3 }} gap={3}>
          <StatCard label="Completed" value={completedCount} icon={CheckCircle2} />
          <StatCard label="In progress" value={runningCount} icon={PlayCircle} />
          <StatCard label="To start" value={plannedCount} icon={Clock} />
        </Grid>
      </div>

      <div className="mt-8">
        <VStack gap={3}>
          <HStack gap={1.5} vAlign="center">
            <Icon icon={FlaskConical} size="sm" />
            <Text type="body" weight="semibold">
              EMA studies
            </Text>
          </HStack>
          {studies.length === 0 ? (
            <Text type="body" size="sm" color="disabled">
              No studies tracked for this project yet.
            </Text>
          ) : (
            <Grid columns={{ minWidth: 260, max: 3 }} gap={3}>
              {studies.map((s) => (
                <Card key={s.id} padding={4}>
                  <VStack gap={2}>
                    <HStack gap={2} vAlign="center" justify="between">
                      <Text type="body" size="sm" weight="semibold">
                        {s.name}
                      </Text>
                      <Badge variant={STUDY_STATUS_META[s.status].variant} label={STUDY_STATUS_META[s.status].label} />
                    </HStack>
                    <Text type="body" size="xsm" color="secondary">
                      {s.kind}
                    </Text>
                    <Text type="body" size="sm">
                      {s.summary}
                    </Text>
                    <Text type="body" size="xsm" color="disabled">
                      {s.owner} · started {relativeTime(s.startedAt)}
                    </Text>
                  </VStack>
                </Card>
              ))}
            </Grid>
          )}
        </VStack>
      </div>
    </div>
  )
}
