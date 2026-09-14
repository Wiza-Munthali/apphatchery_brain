import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Sparkles } from 'lucide-react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { ShaderBackground } from '../components/ShaderBackground'
import { slugify, useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'

/**
 * Organization signup — the entry point for a super admin bringing a new
 * organization onto the product. The person who completes this becomes the
 * org's `owner`.
 */
export function SignUpPage() {
  const navigate = useNavigate()
  const { signUpOrg } = useOrg()
  const { startLocalSession } = useAuth()

  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [slugOverride, setSlugOverride] = useState<string | null>(null)

  const slug = slugOverride ?? slugify(orgName)

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)
  const passwordLongEnough = password.length >= 12
  const canSubmit =
    adminName.trim().length > 0 && emailLooksValid && passwordLongEnough && orgName.trim().length > 0 && slug.length > 0

  const submit = () => {
    if (!canSubmit) return
    signUpOrg({ orgName: orgName.trim(), slug, adminName: adminName.trim(), adminEmail: adminEmail.trim() })
    startLocalSession()
    navigate('/', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden py-10">
      <ShaderBackground />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-brand-navy/10 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90">
        <VStack gap={3} hAlign="center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-navy text-lg font-bold text-white">
            <Icon icon={Building2} size="md" />
          </div>
          <HStack gap={2} vAlign="center">
            <Icon icon={Sparkles} size="sm" color="accent" />
            <Heading level={1} type="display-3">
              Create your organization
            </Heading>
          </HStack>
          <Text type="body" color="secondary" size="sm">
            You’ll be the owner — able to create projects, connect sources and invite your team.
          </Text>
        </VStack>

        <VStack gap={3}>
          <TextInput label="Your name" value={adminName} onChange={setAdminName} isRequired hasAutoFocus />
          <TextInput
            label="Work email"
            type="email"
            value={adminEmail}
            onChange={setAdminEmail}
            placeholder="you@yourorg.edu"
            isRequired
            status={
              adminEmail.length > 0 && !emailLooksValid
                ? { type: 'warning', message: 'That doesn’t look like an email address.' }
                : undefined
            }
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            description="At least 12 characters."
            isRequired
            status={
              password.length > 0 && !passwordLongEnough
                ? { type: 'warning', message: `${12 - password.length} more characters needed.` }
                : undefined
            }
          />

          <Divider />

          <TextInput
            label="Organization name"
            value={orgName}
            onChange={(v) => setOrgName(v)}
            placeholder="Emory AppHatchery"
            isRequired
          />
          <TextInput
            label="URL slug"
            description="Where your organization lives. Derived from the name — edit if you’d rather."
            value={slug}
            onChange={(v) => setSlugOverride(slugify(v))}
            isRequired
          />
        </VStack>

        <Banner
          status="info"
          title="Prototype"
          description="No account is created and the password isn’t stored or sent anywhere. This walks the signup flow locally."
        />

        <Button
          label="Create organization"
          variant="primary"
          width="100%"
          isDisabled={!canSubmit}
          tooltip="Fill in your name, a valid email, a 12+ character password, and an organization name."
          onClick={submit}
        />

        <Text type="body" color="secondary" size="xsm">
          Already have an organization?{' '}
          <Link to="/login" className="text-brand-navy underline dark:text-brand-orange">
            Sign in instead
          </Link>
          .
        </Text>
      </div>
    </div>
  )
}
