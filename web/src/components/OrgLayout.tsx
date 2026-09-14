import { Outlet, useLocation } from 'react-router-dom'
import { FolderKanban, LogOut, Plug, Settings, Users } from 'lucide-react'
import { AppShell } from '@astryxdesign/core/AppShell'
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav'
import { Avatar } from '@astryxdesign/core/Avatar'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../lib/access'

const NAV_ITEMS = [
  { to: '/', label: 'Projects', icon: FolderKanban },
  { to: '/org/members', label: 'Members', icon: Users },
  { to: '/org/connections', label: 'Connections', icon: Plug },
  { to: '/org/settings', label: 'Settings', icon: Settings },
]

/**
 * Shell for organization administration. Project-scoped work keeps its own
 * shell in Layout.tsx — these are different jobs and mixing them would nest
 * org-wide concerns under an arbitrary project.
 */
export function OrgLayout() {
  const { org, currentUser } = useOrg()
  const { logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <AppShell
      variant="section"
      height="fill"
      sideNav={
        <SideNav
          header={
            <SideNavHeading
              heading={org.name}
              superheading="Apphatchery Brain"
              headingHref="/"
              superheadingHref="/"
              icon={
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${org.color} text-sm font-bold text-white`}
                >
                  {org.initial}
                </div>
              }
            />
          }
          footer={
            <VStack gap={2}>
              <HStack gap={2} vAlign="center">
                <Avatar name={currentUser?.name} size="sm" />
                <div className="min-w-0">
                  <Text type="body" size="sm" maxLines={1}>
                    {currentUser?.name ?? 'Signed in'}
                  </Text>
                  <Text type="body" size="xsm" color="secondary">
                    {currentUser ? ROLE_LABELS[currentUser.role] : ''}
                  </Text>
                </div>
              </HStack>
              {/* First place in the app that actually calls logout() — the
                  AuthContext has always exposed it with no way to reach it. */}
              <SideNavItem label="Sign out" icon={LogOut} onClick={logout} />
            </VStack>
          }
        >
          <SideNavSection title="Organization">
            {NAV_ITEMS.map(({ to, label, icon }) => (
              <SideNavItem
                key={to}
                label={label}
                icon={icon}
                href={to}
                isSelected={to === '/' ? pathname === '/' : pathname.startsWith(to)}
              />
            ))}
          </SideNavSection>
        </SideNav>
      }
    >
      <Outlet />
    </AppShell>
  )
}
