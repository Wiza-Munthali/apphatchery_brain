import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack } from '@astryxdesign/core/Layout'
import { projects, itemsForProject } from '../data/mockData'
import { relativeTime } from '../lib/time'
import { ShaderBackground } from '../components/ShaderBackground'

export function ProjectsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <ShaderBackground />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-20">
        <div className="mb-12 flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-navy text-xl font-bold text-white shadow-lg shadow-brand-navy/10">
            A
          </div>
          <HStack gap={2} vAlign="center">
            <Icon icon={Sparkles} size="md" color="accent" />
            <Heading level={1} type="display-2">
              Apphatchery Brain
            </Heading>
          </HStack>
          <Text type="body" color="secondary">
            Pick a project to search and ask questions across its connected sources.
          </Text>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const projectItems = itemsForProject(project.id)
            const latest = projectItems.reduce((max, i) => (i.updatedAt > max ? i.updatedAt : max), '0')

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
                    <h2 className="text-base font-semibold text-slate-900 dark:text-neutral-100">{project.name}</h2>
                    <p className="text-xs text-slate-400 dark:text-neutral-500">updated {relativeTime(latest)}</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="ml-auto shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-neutral-600 dark:group-hover:text-neutral-400"
                  />
                </div>

                <p className="text-[13px] leading-snug text-slate-500 dark:text-neutral-400">{project.description}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
