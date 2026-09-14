import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/Layout'
import type { SourceId } from '../types'
import { itemsForProject } from '../data/mockData'
import { AVAILABLE_PROVIDERS } from '../data/providers'
import { relativeTime } from '../lib/time'
import { CONNECTION_STATUS_META } from '../lib/connectionStatus'
import { canAdminister, memberCanAccessProject } from '../lib/access'
import { useOrg } from '../context/OrgContext'
import { ShaderBackground } from '../components/ShaderBackground'
import { OrgMenu } from '../components/OrgMenu'
import { NewProjectDialog } from '../components/NewProjectDialog'

const DOT_CLASSES: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  accent: 'bg-sky-500 animate-pulse',
  neutral: 'bg-slate-200 dark:bg-neutral-700',
}

/** One dot per available source, so a project's connection health reads at a glance. */
function ConnectionDots({ projectId }: { projectId: string }) {
  const { connectionFor } = useOrg()

  return (
    <HStack gap={1} vAlign="center">
      {AVAILABLE_PROVIDERS.map((p) => {
        const connection = connectionFor(projectId, p.id as SourceId)
        const meta = CONNECTION_STATUS_META[connection?.status ?? 'not_connected']
        return (
          <span
            key={p.id}
            title={`${p.name} — ${meta.label}`}
            className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[meta.dotVariant]}`}
          />
        )
      })}
    </HStack>
  )
}

export function ProjectsPage() {
  const { org, projects, currentUser, connectionsForProject } = useOrg()
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  const isAdmin = currentUser ? canAdminister(currentUser.role) : false
  // A member scoped to specific projects only sees those.
  const visibleProjects = currentUser
    ? projects.filter((p) => memberCanAccessProject(currentUser, p.id))
    : projects

  return (
    <div className="relative min-h-screen overflow-hidden">
      <ShaderBackground />

      <div className="relative z-10 flex justify-end px-6 py-4">
        <OrgMenu />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-20">
        <div className="mb-12 flex flex-col items-center gap-4 text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${org.color} text-xl font-bold text-white shadow-lg shadow-brand-navy/10`}
          >
            {org.initial}
          </div>
          <HStack gap={2} vAlign="center">
            <Icon icon={Sparkles} size="md" color="accent" />
            <Heading level={1} type="display-2">
              {org.name}
            </Heading>
          </HStack>
          <Text type="body" color="secondary">
            Pick a project to search and ask questions across its connected sources.
          </Text>
        </div>

        {visibleProjects.length === 0 && (
          <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-white/70 p-8 text-center backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/70">
            <Text type="body" weight="semibold">
              No projects yet
            </Text>
            <div className="mt-1">
              <Text type="body" size="sm" color="secondary">
                {isAdmin
                  ? 'Create your first project, then connect the tools it should index.'
                  : 'You haven’t been given access to any projects yet. Ask an admin to add you.'}
              </Text>
            </div>
            {isAdmin && (
              <div className="mt-4 flex justify-center">
                <Button
                  label="New project"
                  variant="primary"
                  icon={<Icon icon={Plus} size="sm" />}
                  onClick={() => setNewProjectOpen(true)}
                />
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleProjects.map((project) => {
            const projectItems = itemsForProject(project.id)
            // Seeded with null rather than '0' — a project with no indexed
            // content has never been synced, and `new Date('0')` would render
            // as a bogus date decades in the past.
            const latest = projectItems.reduce<string | null>(
              (max, i) => (!max || i.updatedAt > max ? i.updatedAt : max),
              null,
            )
            const connectedCount = connectionsForProject(project.id).length

            return (
              <Link
                key={project.id}
                to={`/p/${project.id}`}
                className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/90 dark:hover:border-neutral-600"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${project.color} text-base font-bold text-white`}
                  >
                    {project.initial}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-neutral-100">
                      {project.name}
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-neutral-500">
                      {latest ? `updated ${relativeTime(latest)}` : 'nothing indexed yet'}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="ml-auto shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-neutral-600 dark:group-hover:text-neutral-400"
                  />
                </div>

                <p className="text-[13px] leading-snug text-slate-500 dark:text-neutral-400">
                  {project.description}
                </p>

                <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-neutral-800">
                  <ConnectionDots projectId={project.id} />
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                    {connectedCount} of {AVAILABLE_PROVIDERS.length} sources connected
                  </span>
                </div>
              </Link>
            )
          })}

          {isAdmin && visibleProjects.length > 0 && (
            <button
              type="button"
              onClick={() => setNewProjectOpen(true)}
              className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 p-5 text-slate-500 backdrop-blur-sm transition hover:border-slate-400 hover:text-slate-700 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-200"
            >
              <Plus size={20} />
              <span className="text-sm font-medium">New project</span>
              <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                Name it, connect its sources, invite people
              </span>
            </button>
          )}
        </div>
      </div>

      <NewProjectDialog isOpen={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  )
}
