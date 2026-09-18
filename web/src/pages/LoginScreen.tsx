import { useState } from 'react'
import { LogIn, KeyRound, Sparkles } from 'lucide-react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Divider } from '@astryxdesign/core/Divider'
import { VStack } from '@astryxdesign/core/Layout'
import { ShaderBackground } from '../components/ShaderBackground'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { AuthSwitchLink } from '../components/AuthSwitchLink'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginScreen() {
  const { login, loginWithToken, startLocalSession } = useAuth()
  const { org, signInAs } = useOrg()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  const [tokenOpen, setTokenOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)

  const canSubmit = EMAIL_RE.test(email) && password.length > 0

  /**
   * Prototype sign-in. The password is deliberately not checked — there is no
   * account store to check it against — but it is still required, so the form
   * exercises the real shape of the flow.
   *
   * The email is used: when it matches a member of the organization, the
   * session becomes that person, so roles and project access behave the way
   * they would for them. An unrecognised email still gets in, as the owner.
   */
  const submit = () => {
    if (!EMAIL_RE.test(email)) {
      setEmailError('Enter a valid email address.')
      return
    }
    if (!password) return
    signInAs(email)
    startLocalSession()
  }

  const submitToken = () => {
    if (!tokenInput.trim()) return
    const ok = loginWithToken(tokenInput)
    if (!ok) setTokenError('That token looks invalid or expired.')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden py-10">
      <ShaderBackground />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-brand-navy/10 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90">
        <VStack gap={3} hAlign="center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-navy text-xl font-bold text-white">
            A
          </div>
          <div className="flex items-center gap-2">
            <Icon icon={Sparkles} size="md" color="accent" />
            <Heading level={1} type="display-3">
              Sign in
            </Heading>
          </div>
          <Text type="body" color="secondary" size="sm">
            Ask questions and search across your team’s connected project sources.
          </Text>
        </VStack>

        <VStack gap={3}>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v)
              setEmailError(null)
            }}
            placeholder="you@yourorg.edu"
            isRequired
            hasAutoFocus
            onEnter={submit}
            status={emailError ? { type: 'error', message: emailError } : undefined}
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            isRequired
            onEnter={submit}
          />
          <Button
            label="Sign in"
            variant="primary"
            width="100%"
            isDisabled={!canSubmit}
            tooltip="Enter your email and a password to continue."
            onClick={submit}
          />
        </VStack>

        <Banner
          status="info"
          title="Prototype sign-in"
          description={`Any password is accepted. Sign in with a member’s email to use ${org.name} as that person — anything else signs in as the owner.`}
        />

        <Divider label="or" />

        <Button
          label="Continue with GitHub"
          variant="secondary"
          width="100%"
          icon={<Icon icon={LogIn} size="sm" />}
          onClick={login}
        />
        <Text type="body" color="disabled" size="xsm">
          The only option that returns a real gateway session, for asking questions against live
          synced content. Requires membership in the AppHatchery GitHub org.
        </Text>

        {tokenOpen ? (
          <VStack gap={2}>
            <TextInput
              label="Access token"
              type="password"
              value={tokenInput}
              onChange={(v) => {
                setTokenInput(v)
                setTokenError(null)
              }}
              placeholder="Paste a token"
              startIcon={KeyRound}
              status={tokenError ? { type: 'error', message: tokenError } : undefined}
              onEnter={submitToken}
              hasClear
              hasAutoFocus
            />
            <Button label="Use token" variant="secondary" width="100%" onClick={submitToken} />
          </VStack>
        ) : (
          <button
            type="button"
            onClick={() => setTokenOpen(true)}
            className="text-center text-base text-slate-500 underline-offset-2 transition-colors hover:text-slate-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Have an access token?
          </button>
        )}

        <Divider />

        <AuthSwitchLink prompt="New here?" to="/signup" label="Create an organization" />
      </div>
    </div>
  )
}
