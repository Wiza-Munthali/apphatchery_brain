import { useNavigate } from 'react-router-dom'
import { LogOut, Plug, Settings, Users } from 'lucide-react'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'
import { canAdminister } from '../lib/access'

/**
 * Org context and admin entry points for the project picker, which has no
 * sidebar of its own.
 */
export function OrgMenu() {
  const navigate = useNavigate()
  const { org, currentUser } = useOrg()
  const { logout } = useAuth()

  const isAdmin = currentUser ? canAdminister(currentUser.role) : false

  return (
    <DropdownMenu
      button={{ label: org.name, variant: 'ghost', size: 'sm' }}
      hasChevron
      placement="below"
      items={[
        {
          type: 'section',
          title: org.name,
          items: [
            {
              label: 'Members',
              icon: Users,
              onClick: () => navigate('/org/members'),
              isDisabled: !isAdmin,
            },
            {
              label: 'Connections',
              icon: Plug,
              onClick: () => navigate('/org/connections'),
              isDisabled: !isAdmin,
            },
            {
              label: 'Organization settings',
              icon: Settings,
              onClick: () => navigate('/org/settings'),
              isDisabled: !isAdmin,
            },
          ],
        },
        { type: 'divider' },
        { label: 'Sign out', icon: LogOut, onClick: logout },
      ]}
    />
  )
}
