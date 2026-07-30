import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { topicsForProject, getItem } from '../data/mockData'
import { ItemCard } from '../components/ItemCard'

export function TopicDetail() {
  const { id = '', projectId = '' } = useParams()
  const topic = topicsForProject(projectId).find((t) => t.id === id)

  if (!topic) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-500 dark:text-neutral-400">
        Topic not found. <Link to={`/p/${projectId}/memory?tab=topics`} className="text-brand-navy hover:underline dark:text-blue-400">Go back</Link>
      </div>
    )
  }

  const topicItems = topic.itemIds
    .map(getItem)
    .filter(Boolean)
    .sort((a, b) => +new Date(a!.createdAt) - +new Date(b!.createdAt))

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link to={`/p/${projectId}/memory?tab=topics`} className="mb-5 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300">
        <ArrowLeft size={13} /> All topics
      </Link>

      <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-neutral-100">{topic.title}</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-neutral-400">{topic.description}</p>

      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">
        Timeline ({topicItems.length} items)
      </div>
      <div className="relative flex flex-col gap-3 border-l border-slate-200 pl-5 dark:border-neutral-800">
        {topicItems.map((item) => (
          <div key={item!.id} className="relative">
            <span className="absolute -left-[26px] top-3 h-2 w-2 rounded-full bg-brand-orange" />
            <ItemCard item={item!} />
          </div>
        ))}
      </div>
    </div>
  )
}
