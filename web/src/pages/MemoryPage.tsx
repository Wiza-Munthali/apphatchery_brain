import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Network, BookOpen, Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { TextInput } from '@astryxdesign/core/TextInput'
import { itemsForProject, topicsForProject, getItem } from '../data/mockData'
import { buildGraph } from '../lib/graphLayout'
import { TAG_META, TAG_HEX, TagBadge } from '../components/TagBadge'
import { relativeTime } from '../lib/time'
import type { ItemTag } from '../types'

const ALL_TAGS: ItemTag[] = ['delivery', 'feature', 'issue', 'milestone', 'update']

const MIN_SCALE = 0.6
const MAX_SCALE = 2.5

type Tab = 'timeline' | 'topics'

interface HoverState {
  itemId: string
  x: number
  y: number
}

export function MemoryPage() {
  const navigate = useNavigate()
  const { projectId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'topics' ? 'topics' : 'timeline'

  const [activeTags, setActiveTags] = useState<Set<ItemTag>>(new Set(ALL_TAGS))
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const [hovered, setHovered] = useState<HoverState | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const graphAreaRef = useRef<HTMLDivElement>(null)

  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false })

  const toggleTag = (tag: ItemTag) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const projectItems = useMemo(() => itemsForProject(projectId), [projectId])
  const projectTopics = useMemo(() => topicsForProject(projectId), [projectId])

  const feed = projectItems
    .filter((i) => activeTags.has(i.tag))
    .filter((i) => !q || i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q) || i.snippet.toLowerCase().includes(q))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))

  const topics = projectTopics.filter(
    (t) => !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  )

  const stepOf = useMemo(() => {
    const chronological = [...projectItems].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    const m = new Map<string, number>()
    chronological.forEach((item, i) => m.set(item.id, i + 1))
    return m
  }, [projectItems])

  const graph = useMemo(() => buildGraph(projectItems, projectTopics, stepOf), [projectItems, projectTopics, stepOf])
  const visibleItemIds = useMemo(
    () => new Set(projectItems.filter((i) => activeTags.has(i.tag)).map((i) => i.id)),
    [projectItems, activeTags],
  )

  // Directly connected node ids (hub or item) for the selected node — used to
  // highlight its neighborhood and dim everything else on click.
  const relatedToSelected = useMemo(() => {
    if (!selected) return null
    const ids = new Set<string>([selected])
    for (const e of graph.edges) {
      if (e.fromId === selected && e.toId) ids.add(e.toId)
      if (e.toId === selected && e.fromId) ids.add(e.fromId)
    }
    return ids
  }, [selected, graph.edges])

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + 0.25).toFixed(2)))
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - 0.25).toFixed(2)))
  const resetView = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  // Native (non-passive) wheel listener so preventDefault reliably stops page
  // scroll while the cursor is over the graph.
  useEffect(() => {
    const el = graphAreaRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s - e.deltaY * 0.0015).toFixed(2))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handlePanStart = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y, moved: false }
  }
  const handlePanMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true
    setPan({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy })
  }
  const handlePanEnd = () => {
    dragRef.current.dragging = false
  }

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (dragRef.current.moved) return
    setSelected((prev) => (prev === nodeId ? null : nodeId))
  }

  const handleEnter = (e: React.MouseEvent<SVGCircleElement>, itemId: string) => {
    const container = graphAreaRef.current?.getBoundingClientRect()
    const circle = e.currentTarget.getBoundingClientRect()
    if (!container) return
    setHovered({
      itemId,
      x: circle.left + circle.width / 2 - container.left,
      y: circle.top - container.top,
    })
  }

  const hoveredItem = hovered ? getItem(hovered.itemId) : null
  const hoveredRelated = hoveredItem
    ? (hoveredItem.relatedIds ?? []).map(getItem).filter((r) => r && r.projectId === projectId)
    : []

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
      <div className="mb-1 flex items-center gap-1.5">
        <Network size={17} className="text-brand-orange" />
        <h1 className="text-lg font-semibold">Memory</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500 dark:text-neutral-400">
        A synthesized overview of the project's major milestones — how items connect, cluster into topics, and unfold over time.
      </p>

      <div className="mb-5 flex items-center gap-1 border-b border-slate-200 dark:border-neutral-800">
        <button
          onClick={() => setParams({ tab: 'timeline' })}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === 'timeline'
              ? 'border-brand-orange text-brand-navy dark:text-blue-300'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300'
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setParams({ tab: 'topics' })}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === 'topics'
              ? 'border-brand-orange text-brand-navy dark:text-blue-300'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300'
          }`}
        >
          Topics
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {ALL_TAGS.map((t) => {
          const on = activeTags.has(t)
          const meta = TAG_META[t]
          return (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition ${
                on ? meta.classes : 'border-slate-200 text-slate-400 opacity-60 dark:border-neutral-700 dark:text-neutral-500'
              }`}
            >
              {meta.label}
            </button>
          )
        })}
      </div>

      <div className="mb-5">
        <TextInput
          label={tab === 'timeline' ? 'Search timeline' : 'Search topics'}
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder={tab === 'timeline' ? 'Search timeline…' : 'Search topics…'}
          startIcon={Search}
          hasClear
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-6">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'timeline' && (
            <div className="flex flex-col gap-2">
              {feed.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/p/${projectId}/item/${item.id}`)}
                  className="block w-full rounded-lg border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <TagBadge tag={item.tag} />
                    <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">{item.type}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">{relativeTime(item.updatedAt)}</span>
                  </div>
                  <h3 className="mb-1 text-sm font-medium text-slate-800 dark:text-neutral-100">{item.title}</h3>
                  <p className="line-clamp-2 text-[13px] leading-snug text-slate-500 dark:text-neutral-400">{item.snippet}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-neutral-500">
                    <span>{item.author}</span>
                    <span>·</span>
                    <span>{item.space}</span>
                  </div>
                </button>
              ))}
              {feed.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
                  {q ? 'No items match your search.' : 'No tags selected.'}
                </p>
              )}
            </div>
          )}

          {tab === 'topics' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/p/${projectId}/topics/${topic.id}`}
                  className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-brand-orange" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{topic.title}</h2>
                  </div>
                  <p className="text-[13px] leading-snug text-slate-500 dark:text-neutral-400">{topic.description}</p>
                </Link>
              ))}
              {topics.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
                  {q ? 'No topics match your search.' : 'No topics detected yet for this project.'}
                </p>
              )}
            </div>
          )}
        </div>

        <div
          ref={graphAreaRef}
          className="relative w-[380px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            <button
              onClick={zoomIn}
              className="flex h-7 w-7 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={zoomOut}
              className="flex h-7 w-7 items-center justify-center border-t border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={resetView}
              className="flex h-7 w-7 items-center justify-center border-t border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              aria-label="Reset view"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          <div
            className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={handlePanStart}
            onPointerMove={handlePanMove}
            onPointerUp={handlePanEnd}
            onPointerLeave={handlePanEnd}
          >
            <svg
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              className="h-full w-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: dragRef.current.dragging ? 'none' : 'transform 150ms ease',
              }}
              onClick={() => {
                if (dragRef.current.moved) return
                setSelected(null)
              }}
            >
              {graph.edges.map((e) => {
                const endpointsVisible =
                  (!e.fromId || e.fromId.startsWith('hub-') || visibleItemIds.has(e.fromId)) &&
                  (!e.toId || e.toId.startsWith('hub-') || visibleItemIds.has(e.toId))
                const isRelatedToSelection =
                  selected !== null && (e.fromId === selected || e.toId === selected)
                const isRelatedToHover =
                  selected === null && hovered !== null && (e.fromId === hovered.itemId || e.toId === hovered.itemId)
                const dimmedBySelection = selected !== null && !isRelatedToSelection

                let opacity = e.kind === 'related' ? 0.5 : 0.2
                if (!endpointsVisible) opacity = 0.04
                else if (dimmedBySelection) opacity = 0.04
                else if (isRelatedToSelection || isRelatedToHover) opacity = 0.9

                return (
                  <line
                    key={e.id}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke={e.kind === 'related' ? '#f5921e' : '#1b4c82'}
                    strokeOpacity={opacity}
                    strokeDasharray={e.kind === 'related' ? '3 3' : undefined}
                    strokeWidth={isRelatedToSelection || isRelatedToHover ? 2 : 1}
                    style={{ transition: 'stroke-opacity 200ms, stroke-width 200ms' }}
                  />
                )
              })}

              {graph.nodes.map((n) => {
                const tagVisible = n.itemId ? visibleItemIds.has(n.itemId) : true
                const isSelected = selected === n.id
                const isRelatedToSelection = relatedToSelected?.has(n.id) ?? false
                const dimmedBySelection = selected !== null && !isRelatedToSelection
                const opacity = !tagVisible ? 0.15 : dimmedBySelection ? 0.12 : 1
                const isHovered = hovered?.itemId === n.itemId

                if (n.kind === 'hub') {
                  return (
                    <g
                      key={n.id}
                      style={{ opacity, transition: 'opacity 200ms' }}
                      className="cursor-pointer"
                      onClick={(e) => handleNodeClick(e, n.id)}
                    >
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={isSelected ? 10 : 8}
                        fill="#1b4c82"
                        stroke="#3b6ba6"
                        strokeWidth={isSelected ? 2 : 1}
                        style={{ transition: 'r 150ms' }}
                      />
                      <text x={n.x} y={n.y - 14} textAnchor="middle" fontSize={11} fontWeight={600} fill="#3b82c4">
                        {n.label}
                      </text>
                    </g>
                  )
                }
                return (
                  <g
                    key={n.id}
                    style={{ opacity, transition: 'opacity 200ms' }}
                    className="cursor-pointer"
                    onClick={(e) => n.itemId && handleNodeClick(e, n.itemId)}
                    onDoubleClick={() => n.itemId && navigate(`/p/${projectId}/item/${n.itemId}`)}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={isSelected ? 8 : isHovered ? 7 : 5}
                      fill={n.tag ? TAG_HEX[n.tag] : '#94a3b8'}
                      stroke={isSelected ? '#1b4c82' : '#ffffff'}
                      strokeWidth={isSelected ? 2 : 1.5}
                      style={{ transition: 'r 150ms' }}
                      onMouseEnter={(e) => n.itemId && handleEnter(e, n.itemId)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <title>{n.label}</title>
                    </circle>
                  </g>
                )
              })}
            </svg>
          </div>

          {hoveredItem && hovered && !selected && (
            <div
              className="pointer-events-none absolute z-20 w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
              style={{ left: hovered.x, top: hovered.y - 12 }}
            >
              <TagBadge tag={hoveredItem.tag} />
              <p className="mt-1.5 text-[13px] font-medium leading-snug text-slate-800 dark:text-neutral-100">{hoveredItem.title}</p>
              {hoveredRelated.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2 dark:border-neutral-700">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">Related</p>
                  <ul className="flex flex-col gap-0.5">
                    {hoveredRelated.map((r) => (
                      <li key={r!.id} className="truncate text-[11px] text-slate-500 dark:text-neutral-400">
                        {r!.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="absolute left-3 bottom-3 z-10 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm transition hover:text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
