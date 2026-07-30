import { GitBranch, MessageCircle, FileText, HelpCircle, Code2 } from 'lucide-react'
import type { GatewayResourceType } from '../types'

export const GATEWAY_RESOURCE_META: Record<
  GatewayResourceType,
  { label: string; icon: typeof GitBranch; classes: string }
> = {
  code: {
    label: 'Code',
    icon: Code2,
    classes:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  },
  github: {
    label: 'GitHub',
    icon: GitBranch,
    classes: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600',
  },
  zulip: {
    label: 'Zulip',
    icon: MessageCircle,
    classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  },
  qa: {
    label: 'Q&A',
    icon: HelpCircle,
    classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  },
  doc: {
    label: 'Doc',
    icon: FileText,
    classes:
      'bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600',
  },
}

export function GatewayResourceBadge({ type, size = 'sm' }: { type: GatewayResourceType; size?: 'sm' | 'md' }) {
  const meta = GATEWAY_RESOURCE_META[type]
  const Icon = meta.icon
  const pad = size === 'sm' ? 'text-[11px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5'
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md border font-medium ${pad} ${meta.classes}`}>
      <Icon size={size === 'sm' ? 11 : 13} />
      {meta.label}
    </span>
  )
}
