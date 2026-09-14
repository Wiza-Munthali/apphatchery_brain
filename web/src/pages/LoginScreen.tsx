import { useState } from 'react'
import { LogIn, KeyRound, Sparkles } from 'lucide-react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Divider } from '@astryxdesign/core/Divider'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { ShaderBackground } from '../components/ShaderBackground'
import { useAuth } from '../context/AuthContext'
import { AuthSwitchLink } from '../components/AuthSwitchLink'

export function LoginScreen() {
  const { login, loginWithToken } = useAuth()
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)

  const submitToken = () => {
    if (!tokenInput.trim()) return
    const ok = loginWithToken(tokenInput)
    if (!ok) setTokenError('That token looks invalid or expired.')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <ShaderBackground />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-lg shadow-brand-navy/10 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-navy text-xl font-bold text-white">
          A
        </div>
        <HStack gap={2} vAlign="center">
          <Icon icon={Sparkles} size="md" color="accent" />
          <Heading level={1} type="display-3">
            Apphatchery Brain
          </Heading>
        </HStack>
        <Text type="body" color="secondary" size="sm">
          Sign in with your AppHatchery GitHub account to ask questions and search across connected
          project sources.
        </Text>
        <Button
          label="Continue with GitHub"
          variant="primary"
          width="100%"
          icon={<Icon icon={LogIn} size="sm" />}
          onClick={login}
        />
        <Text type="body" color="disabled" size="xsm">
          Requires membership in the AppHatchery GitHub org.
        </Text>

        <Divider label="or" />

        <VStack gap={2} className="w-full">
          <TextInput
            label="Paste an access token"
            isLabelHidden
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
          />
          <Button label="Use token" variant="secondary" width="100%" onClick={submitToken} />
        </VStack>
        <Text type="body" color="disabled" size="xsm">
          For people without a GitHub account — paste a token issued to you directly.
        </Text>

        <Divider />

        <AuthSwitchLink prompt="New here?" to="/signup" label="Create an organization" />
      </div>
    </div>
  )
}
