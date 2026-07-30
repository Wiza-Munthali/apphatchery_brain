import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CircleCheck, CircleAlert, Loader2, RefreshCw, Plus } from 'lucide-react'
import { connectorsForProject } from '../data/mockData'
import { SourceBadge } from '../components/SourceBadge'
import { relativeTime, absoluteTime } from '../lib/time'
import type { ConnectorStatus } from '../types'

const STATUS_META: Record<ConnectorStatus, { label: string; icon: typeof CircleCheck; classes: string }> = {
  connected: { label: 'Connected', icon: CircleCheck, classes: 'text-emerald-600 dark:text-emerald-400' },
  syncing: { label: 'Syncing', icon: Loader2, classes: 'text-amber-600 dark:text-amber-400' },
  error: { label: 'Needs attention', icon: CircleAlert, classes: 'text-red-600 dark:text-red-400' },
}

export function SourcesAdmin() {
  const { projectId = '' } = useParams()
  const [connectors, setConnectors] = useState(() => connectorsForProject(projectId))
  const [resyncing, setResyncing] = useState<string | null>(null)

  useEffect(() => {
    setConnectors(connectorsForProject(projectId))
  }, [projectId])

  const resync = (id: string) => {
    setResyncing(id)
    setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'syncing' } : c)))
    setTimeout(() => {
      setConnectors((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'connected', lastSync: new Date().toISOString(), error: undefined } : c,
        ),
      )
      setResyncing(null)
    }, 1400)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sources & Sync</h1>
          <p className="text-sm text-slate-400 dark:text-neutral-500">Manage connected platforms and ingestion scope.</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-dark">
          <Plus size={13} />
          Add source
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {connectors.map((c) => {
          const status = STATUS_META[c.status]
          const StatusIcon = status.icon
          return (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <SourceBadge source={c.id} size="md" />
                    <span className={`flex items-center gap-1 text-xs font-medium ${status.classes}`}>
                      <StatusIcon size={12} className={c.status === 'syncing' ? 'animate-spin' : ''} />
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Scope: {c.scope}</p>
                  {c.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{c.error}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 dark:text-neutral-500" title={absoluteTime(c.lastSync)}>
                    Last sync {relativeTime(c.lastSync)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">{c.itemCount} items indexed</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-neutral-800">
                <button
                  onClick={() => resync(c.id)}
                  disabled={resyncing === c.id}
                  className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
                >
                  <RefreshCw size={12} className={resyncing === c.id ? 'animate-spin' : ''} />
                  Resync now
                </button>
                <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-100">
                  Edit scope
                </button>
                <button className="ml-auto rounded-md px-2.5 py-1 text-xs text-red-500/80 hover:text-red-600 dark:text-red-400/80 dark:hover:text-red-400">
                  Revoke access
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
