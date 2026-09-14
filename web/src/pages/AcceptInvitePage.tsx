import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MailOpen } from 'lucide-react'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { ShaderBackground } from '../components/ShaderBackground'
import { AccessSummary } from '../components/AccessSummary'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/access'
import { useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden py-10">
      <ShaderBackground />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-brand-navy/10 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90">
        {children}
      </div>
    </div>
  )
}

/**
 * What an invited person lands on. The whole point of this screen is that they
 * can see exactly what they're being granted — role and project scope — before
 * accepting, described by the same helper the admin saw when sending it.
 */
export function AcceptInvitePage() {
  const { inviteId = '' } = useParams()
  const navigate = useNavigate()
  const { org, getInvite, getMember, acceptInvite } = useOrg()
  const { startLocalSession } = useAuth()

  const [name, setName] = useState('')
  const [declined, setDeclined] = useState(false)

  const invite = getInvite(inviteId)

  if (!invite) {
    return (
      <Shell>
        <EmptyState
          title="Invite not found"
          description="This link doesn’t match an invite. It may have been sent for a different organization, or already cleaned up."
          actions={<Button label="Go to sign in" onClick={() => navigate('/login')} />}
        />
      </Shell>
    )
  }

  const isExpired = invite.status === 'expired' || new Date(invite.expiresAt).getTime() < Date.now()

  if (declined) {
    return (
      <Shell>
        <EmptyState
          title="Invite declined"
          description={`You’ve declined the invite to ${org.name}. Nothing was shared with you.`}
        />
      </Shell>
    )
  }

  if (invite.status === 'revoked') {
    return (
      <Shell>
        <EmptyState
          title="This invite was revoked"
          description={`An admin at ${org.name} cancelled this invite. Ask them to send a new one if you still need access.`}
        />
      </Shell>
    )
  }

  if (invite.status === 'accepted') {
    return (
      <Shell>
        <EmptyState
          title="Already accepted"
          description="This invite has been used. Sign in with the email it was sent to."
          actions={<Button label="Go to sign in" onClick={() => navigate('/login')} />}
        />
      </Shell>
    )
  }

  if (isExpired) {
    return (
      <Shell>
        <EmptyState
          title="This invite has expired"
          description={`Invites are valid for 7 days. Ask an admin at ${org.name} to send a new one.`}
        />
      </Shell>
    )
  }

  const inviter = getMember(invite.invitedBy)

  const accept = () => {
    acceptInvite(invite.id, name.trim() || invite.email)
    startLocalSession()
    navigate('/', { replace: true })
  }

  return (
    <Shell>
      <VStack gap={5}>
        <VStack gap={3} hAlign="center">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${org.color} text-lg font-bold text-white`}
          >
            <Icon icon={MailOpen} size="md" />
          </div>
          <Heading level={1} type="display-3">
            Join {org.name}
          </Heading>
          <Text type="body" color="secondary" size="sm">
            {inviter ? `${inviter.name} invited` : 'You were invited'} <strong>{invite.email}</strong> to
            the Apphatchery Brain workspace for {org.name}.
          </Text>
        </VStack>

        <Divider />

        <VStack gap={3}>
          <HStack gap={2} vAlign="center">
            <div className="w-28 shrink-0">
              <Text type="label" color="secondary">
                Your role
              </Text>
            </div>
            <VStack gap={0}>
              <Text type="body" size="sm" weight="medium">
                {ROLE_LABELS[invite.role]}
              </Text>
              <Text type="body" size="xsm" color="secondary">
                {ROLE_DESCRIPTIONS[invite.role]}
              </Text>
            </VStack>
          </HStack>

          <HStack gap={2} vAlign="center">
            <div className="w-28 shrink-0">
              <Text type="label" color="secondary">
                You’ll be able to search
              </Text>
            </div>
            <AccessSummary access={invite.access} />
          </HStack>

          <HStack gap={2} vAlign="center">
            <div className="w-28 shrink-0">
              <Text type="label" color="secondary">
                Expires
              </Text>
            </div>
            <Timestamp value={invite.expiresAt} format="relative" type="body" size="sm" />
          </HStack>
        </VStack>

        <Divider />

        <TextInput
          label="Your name"
          description="How you’ll appear to others in the organization."
          value={name}
          onChange={setName}
          placeholder="Sofia Alvarez"
          hasAutoFocus
        />

        <VStack gap={2}>
          <Button
            label="Accept invite"
            variant="primary"
            width="100%"
            isDisabled={name.trim().length === 0}
            tooltip="Add your name so teammates know who you are."
            onClick={accept}
          />
          <Button label="Decline" variant="ghost" width="100%" onClick={() => setDeclined(true)} />
        </VStack>

        <Text type="body" color="secondary" size="xsm">
          Not expecting this?{' '}
          <Link to="/login" className="text-brand-navy underline dark:text-brand-orange">
            Go to sign in
          </Link>
          .
        </Text>
      </VStack>
    </Shell>
  )
}
