import { Link } from 'react-router-dom'
import type { KBItem } from '../types'
import { SourceBadge } from './SourceBadge'
import { relativeTime } from '../lib/time'

export function ItemCard({ item, highlight }: { item: KBItem; highlight?: string }) {
  return (
    <Link
      to={`/p/${item.projectId}/item/${item.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <SourceBadge source={item.source} />
        <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">{item.type}</span>
        <span className="ml-auto shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">{relativeTime(item.updatedAt)}</span>
      </div>
      <h3 className="mb-1 text-sm font-medium text-slate-800 dark:text-neutral-100">{item.title}</h3>
      <p className="line-clamp-2 text-[13px] leading-snug text-slate-500 dark:text-neutral-400">{highlight ?? item.snippet}</p>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-neutral-500">
        <span>{item.author}</span>
        <span>·</span>
        <span>{item.space}</span>
      </div>
    </Link>
  )
}
