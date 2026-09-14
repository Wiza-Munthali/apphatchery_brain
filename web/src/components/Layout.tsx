import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sparkles, Settings2, Network, Plus, MessageSquare, Trash2, Search, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { AppShell } from '@astryxdesign/core/AppShell'
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav'
import { IconButton } from '@astryxdesign/core/IconButton'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Icon } from '@astryxdesign/core/Icon'
import { Text } from '@astryxdesign/core/Text'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { useOrg } from '../context/OrgContext'
import { EntityAvatar } from './EntityAvatar'
import { loadConversations, saveConversations } from '../lib/chatStore'
import { uid } from '../lib/id'
import type { Conversation, Persona } from '../types'

const PERSONA_STORAGE_KEY = 'apphatchery.persona'
const SIDEBAR_COLLAPSED_KEY = 'apphatchery.sidebarCollapsed'

export interface ChatHistoryContext {
  conversations: Conversation[]
  activeId: string
  persist: (next: Conversation[]) => void
  persona: Persona
  setPersona: (persona: Persona) => void
}

export function Layout() {
  const navigate = useNavigate()
  const { projectId = '' } = useParams()

  // From OrgContext rather than the fixtures, so a project created in this
  // session gets its real name and colour in the shell.
  const { getProject } = useOrg()
  const project = getProject(projectId)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>(() => uid())
  const [historyQuery, setHistoryQuery] = useState('')
  const [persona, setPersona] = useState<Persona>(
    () => (localStorage.getItem(PERSONA_STORAGE_KEY) as Persona) || 'developer',
  )
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(PERSONA_STORAGE_KEY, persona)
  }, [persona])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
    if (collapsed) setSearchOpen(false)
  }, [collapsed])

  useEffect(() => {
    setConversations(loadConversations(projectId))
    setActiveId(uid())
    setHistoryQuery('')
  }, [projectId])

  const persist = (next: Conversation[]) => {
    setConversations(next)
    saveConversations(projectId, next)
  }

  const newChat = () => {
    setActiveId(uid())
    navigate(`/p/${projectId}`)
  }

  const selectConversation = (id: string) => {
    setActiveId(id)
    navigate(`/p/${projectId}`)
  }

  const deleteConversation = (id: string) => {
    persist(conversations.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(uid())
  }

  const navItems = [
    { to: `/p/${projectId}`, label: 'Ask', icon: Sparkles },
    { to: `/p/${projectId}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { to: `/p/${projectId}/memory`, label: 'Memory', icon: Network },
    { to: `/p/${projectId}/admin`, label: 'Sources & Sync', icon: Settings2 },
  ]

  const sortedConversations = [...conversations].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
  )
  const filteredConversations = (() => {
    const q = historyQuery.trim().toLowerCase()
    if (!q) return sortedConversations
    return sortedConversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q)),
    )
  })()

  const ctx: ChatHistoryContext = { conversations, activeId, persist, persona, setPersona }
  const currentPath = `/p/${projectId}${location.hash.replace(/^#\/p\/[^/]+/, '')}`

  return (
    <AppShell
      variant="section"
      height="fill"
      sideNav={
        <SideNav
          collapsible={{ isCollapsed: collapsed, onCollapsedChange: setCollapsed, hasButton: false }}
          header={
            <SideNavHeading
              heading={project?.name ?? 'Apphatchery Brain'}
              superheading="Apphatchery Brain"
              headingHref="/"
              superheadingHref="/"
              icon={
                <EntityAvatar
                  imageUrl={project?.avatarUrl}
                  initial={project?.initial ?? 'A'}
                  color={project?.color ?? 'from-brand-orange to-brand-navy'}
                  size={28}
                  radius="md"
                />
              }
              headerEndContent={
                <HStack gap={0.5} vAlign="center">
                  <IconButton
                    label="Search chat history"
                    icon={<Icon icon={Search} size="sm" />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchOpen((v) => !v)}
                  />
                  <IconButton
                    label="Collapse sidebar"
                    icon={<Icon icon={PanelLeftClose} size="sm" />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(true)}
                  />
                </HStack>
              }
            />
          }
          topContent={
            <VStack gap={2}>
              {collapsed && (
                <IconButton
                  label="Expand sidebar"
                  icon={<Icon icon={PanelLeftOpen} size="sm" />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setCollapsed(false)}
                />
              )}
              <SideNavItem label="New chat" icon={Plus} onClick={newChat} />
              {searchOpen && !collapsed && (
                <TextInput
                  label="Search chat history"
                  isLabelHidden
                  value={historyQuery}
                  onChange={setHistoryQuery}
                  placeholder="Search chat history…"
                  startIcon={Search}
                  hasClear
                  hasAutoFocus
                />
              )}
            </VStack>
          }
        >
          <SideNavSection title="Navigate" isHeaderHidden={collapsed}>
            {navItems.map(({ to, label, icon }) => (
              <SideNavItem key={to} label={label} icon={icon} href={to} isSelected={currentPath === to} />
            ))}
          </SideNavSection>

          {!collapsed && (
            <SideNavSection title="History">
              {filteredConversations.length === 0 && (
                <Text type="body" size="sm" color="disabled">
                  {historyQuery ? 'No matching conversations.' : 'No conversations yet.'}
                </Text>
              )}
              {filteredConversations.map((c) => (
                <ClickableCard
                  key={c.id}
                  label={c.title}
                  onClick={() => selectConversation(c.id)}
                  padding={1.5}
                  variant="transparent"
                  className={`group ${c.id === activeId ? 'bg-accent-muted' : ''}`}
                >
                  <HStack gap={2} vAlign="center">
                    <Icon icon={MessageSquare} size="sm" color="secondary" />
                    <div className="min-w-0 flex-1">
                      <Text type="body" size="sm" maxLines={1}>
                        {c.title}
                      </Text>
                    </div>
                    <IconButton
                      label="Delete conversation"
                      icon={<Icon icon={Trash2} size="sm" />}
                      variant="ghost"
                      size="sm"
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConversation(c.id)
                      }}
                    />
                  </HStack>
                </ClickableCard>
              ))}
            </SideNavSection>
          )}
        </SideNav>
      }
    >
      <Outlet context={ctx} />
    </AppShell>
  )
}
