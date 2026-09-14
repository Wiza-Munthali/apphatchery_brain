import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getItem, items } from '../data/mockData'
import { SOURCE_META, SourceBadge } from '../components/SourceBadge'
import { ItemCard } from '../components/ItemCard'
import { absoluteTime, relativeTime } from '../lib/time'

export function ItemDetail() {
  const { id = '', projectId = '' } = useParams()
  const item = getItem(id)

  if (!item || item.projectId !== projectId) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-500 dark:text-neutral-400">
        Item not found. <Link to={`/p/${projectId}`} className="text-brand-navy hover:underline dark:text-blue-400">Go back</Link>
      </div>
    )
  }

  const relatedIds = new Set(item.relatedIds ?? [])
  ;(item.topicIds ?? []).forEach((tid) => {
    items.forEach((i) => {
      if (i.id !== item.id && i.projectId === projectId && i.topicIds?.includes(tid)) relatedIds.add(i.id)
    })
  })
  const related = items.filter((i) => relatedIds.has(i.id))

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link to={`/p/${projectId}`} className="mb-5 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300">
        <ArrowLeft size={13} /> Back
      </Link>

      <div className="mb-4 flex items-center gap-2">
        <SourceBadge source={item.source} size="md" />
        <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-neutral-500">{item.type}</span>
      </div>

      <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-neutral-100">{item.title}</h1>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
        <span>{item.author}</span>
        <span>·</span>
        <span>{item.space}</span>
        <span>·</span>
        <span title={absoluteTime(item.createdAt)}>created {relativeTime(item.createdAt)}</span>
        <span>·</span>
        <span title={absoluteTime(item.updatedAt)}>updated {relativeTime(item.updatedAt)}</span>
      </div>

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        {item.body}
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mb-8 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
      >
        View on {SOURCE_META[item.source].label}
        <ExternalLink size={12} />
      </a>

      {related.length > 0 && (
        <div className="mb-8">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">
            Related items
          </div>
          <div className="flex flex-col gap-2">
            {related.map((r) => (
              <ItemCard key={r.id} item={r} />
            ))}
          </div>
        </div>
      )}

      <details className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
        <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200">
          Raw metadata
        </summary>
        <pre className="mt-3 overflow-x-auto text-[11px] leading-relaxed text-slate-500 dark:text-neutral-400">
{JSON.stringify(item, null, 2)}
        </pre>
      </details>
    </div>
  )
}
