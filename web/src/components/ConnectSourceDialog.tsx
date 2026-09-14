import { useMemo, useState } from 'react'
import { Check, Search, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList'
import { Divider } from '@astryxdesign/core/Divider'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import type { Connection, DiscoveredResource, SourceId, SyncCadence } from '../types'
import type { ProviderSpec } from '../data/providers'
import { discoveredFor, beginConnect, verifyCredential, MOCK_MIN_KEY_LENGTH } from '../lib/mockConnect'
import { useOrg } from '../context/OrgContext'

type Step = 'review' | 'credentials' | 'handshake' | 'select' | 'cadence'

const CADENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly — recommended' },
  { value: 'daily', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
]

interface FlowProps {
  provider: ProviderSpec
  projectId: string
  /** Present when reconnecting or editing an existing connection. */
  connection?: Connection
  mode?: 'connect' | 'edit-scope'
  onDone: () => void
  onCancel: () => void
}

/**
 * The connect flow body, usable inside a Dialog or embedded inline (the
 * project-creation wizard embeds it, since nesting native <dialog> elements is
 * best avoided).
 *
 * The shape of this flow is the security design, not decoration:
 *
 *  1. Review    — scopes and caveats are shown BEFORE anything is handed over,
 *                 each with a plain-language reason, so consent is informed.
 *  2. Handshake — either a provider redirect, or (Zulip only, which has no
 *                 OAuth) a credential form. Credentials live in local state for
 *                 the life of this component and are never persisted or echoed.
 *  3. Select    — default-deny. Nothing is pre-selected on a first connect, and
 *                 continuing with an empty selection is blocked. Resources the
 *                 credential cannot reach are listed but disabled, with the
 *                 reason, so the real boundary is visible rather than hidden.
 *  4. Cadence   — confirm exactly what will sync, and how often.
 */
export function ConnectSourceFlow({
  provider,
  projectId,
  connection,
  mode = 'connect',
  onDone,
  onCancel,
}: FlowProps) {
  const { org, saveConnection, updateConnectionScope, updateConnectionCadence } = useOrg()

  const isEditScope = mode === 'edit-scope'
  const needsFreshCredential = connection?.status === 'reauth_required'

  const stepOrder: Step[] = isEditScope
    ? ['select', 'cadence']
    : provider.authKind === 'api_key'
      ? ['review', 'credentials', 'select', 'cadence']
      : ['review', 'handshake', 'select', 'cadence']

  const [step, setStep] = useState<Step>(stepOrder[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [discovered, setDiscovered] = useState<DiscoveredResource[]>(
    isEditScope ? (connection?.discovered ?? []) : [],
  )
  const [accountLabel, setAccountLabel] = useState(connection?.accountLabel ?? '')
  const [grantedScopes, setGrantedScopes] = useState<string[]>(connection?.grantedScopes ?? [])
  const [selected, setSelected] = useState<string[]>(isEditScope ? (connection?.selectedResourceIds ?? []) : [])
  const [cadence, setCadence] = useState<SyncCadence>(connection?.cadence ?? org.defaultCadence)

  // Credential form state (api_key providers). Deliberately local: these values
  // never leave this component, are not persisted, and are dropped on unmount.
  const [credFields, setCredFields] = useState<Record<string, string>>({})
  const [replacingSecret, setReplacingSecret] = useState(!connection || Boolean(needsFreshCredential))

  const hasStoredCredential = Boolean(connection) && !needsFreshCredential

  /**
   * A first-time connect starts empty (default-deny). Reconnecting or editing
   * carries the admin's own prior choice forward for re-confirmation — that's a
   * previous explicit decision, not a permissive default — but drops anything
   * that has since disappeared or become unreachable.
   */
  const initialSelection = (resources: DiscoveredResource[]): string[] => {
    if (!connection) return []
    const prior = connection.selectedResourceIds
    return resources.filter((r) => r.selectable && prior.includes(r.id)).map((r) => r.id)
  }

  const applyHandshake = (result: { accountLabel: string; grantedScopes: string[]; discovered: DiscoveredResource[] }) => {
    setAccountLabel(result.accountLabel)
    setGrantedScopes(result.grantedScopes)
    setDiscovered(result.discovered)
    setSelected(initialSelection(result.discovered))
    setStep('select')
  }

  const startRedirect = async () => {
    setStep('handshake')
    setError(null)
    try {
      applyHandshake(await beginConnect(provider.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed.')
      setStep('review')
    }
  }

  const testCredential = async () => {
    setBusy(true)
    setError(null)
    try {
      applyHandshake(await verifyCredential(provider.id, credFields))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed.')
    } finally {
      setBusy(false)
    }
  }

  const continueWithStored = () => {
    applyHandshake({
      accountLabel: connection?.accountLabel ?? '',
      grantedScopes: connection?.grantedScopes ?? provider.scopes.map((s) => s.scope),
      discovered: discoveredFor(provider.id),
    })
  }

  const finish = () => {
    if (isEditScope && connection) {
      updateConnectionScope(connection.id, selected)
      updateConnectionCadence(connection.id, cadence)
    } else {
      saveConnection({
        projectId,
        source: provider.id as SourceId,
        accountLabel,
        authKind: provider.authKind,
        grantedScopes,
        selectedResourceIds: selected,
        discovered,
        cadence,
      })
    }
    onDone()
  }

  const selectable = discovered.filter((r) => r.selectable)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return discovered
    return discovered.filter((r) => r.name.toLowerCase().includes(q))
  }, [discovered, query])

  const selectedNames = discovered.filter((r) => selected.includes(r.id)).map((r) => r.name)
  const stepNumber = stepOrder.indexOf(step) + 1

  // --- Steps ---------------------------------------------------------------

  const reviewStep = (
    <VStack gap={4}>
      <Text type="body" size="sm" color="secondary">
        {provider.authSummary}
      </Text>

      <VStack gap={2}>
        <HStack gap={1.5} vAlign="center">
          <Icon icon={ShieldCheck} size="sm" color="success" />
          <Text type="label" weight="semibold">
            What this grants
          </Text>
        </HStack>
        <Card padding={0} variant="muted">
          <VStack>
            {provider.scopes.map((s, i) => (
              <div key={s.scope}>
                {i > 0 && <Divider />}
                <div className="px-3 py-2">
                  <VStack gap={0.5}>
                    <Text type="code" size="xsm">
                      {s.scope}
                    </Text>
                    <Text type="body" size="xsm" color="secondary">
                      {s.why}
                    </Text>
                  </VStack>
                </div>
              </div>
            ))}
          </VStack>
        </Card>
      </VStack>

      {provider.safetyNotes.length > 0 && (
        <VStack gap={1.5}>
          {provider.safetyNotes.map((note) => (
            <HStack key={note} gap={1.5} vAlign="start">
              <div className="mt-0.5 shrink-0">
                <Icon icon={Check} size="xsm" color="secondary" />
              </div>
              <Text type="body" size="xsm" color="secondary">
                {note}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}

      {needsFreshCredential && (
        <Banner
          status="warning"
          title="This connection needs re-authorizing"
          description={connection?.error ?? 'The stored credential is no longer valid.'}
        />
      )}
      {error && <Banner status="error" title="Couldn’t connect" description={error} />}
    </VStack>
  )

  const credentialsStep = (
    <VStack gap={4}>
      <Text type="body" size="sm" color="secondary">
        {provider.authSummary}
      </Text>

      {hasStoredCredential && !replacingSecret ? (
        <Card padding={3} variant="muted">
          <VStack gap={2}>
            <Text type="label" weight="semibold">
              Stored credentials
            </Text>
            <VStack gap={1}>
              <Text type="body" size="sm">
                {connection?.accountLabel}
              </Text>
              {/* The secret is write-only: it is never returned to the browser,
                  so there is nothing to reveal here — only replace. */}
              <Text type="body" size="xsm" color="secondary">
                API key ···· stored · never displayed again
              </Text>
            </VStack>
            <HStack gap={2}>
              <Button label="Replace API key" size="sm" onClick={() => setReplacingSecret(true)} />
              <Button
                label="Continue with stored credentials"
                size="sm"
                variant="primary"
                onClick={continueWithStored}
              />
            </HStack>
          </VStack>
        </Card>
      ) : (
        <>
          <VStack gap={3}>
            {(provider.credentialFields ?? []).map((field) => (
              <TextInput
                key={field.key}
                label={field.label}
                type={field.type}
                value={credFields[field.key] ?? ''}
                onChange={(v) => {
                  setCredFields((prev) => ({ ...prev, [field.key]: v }))
                  setError(null)
                }}
                placeholder={field.placeholder}
                description={field.help}
                isRequired
              />
            ))}
          </VStack>

          {provider.safetyNotes.map((note) => (
            <HStack key={note} gap={1.5} vAlign="start">
              <div className="mt-0.5 shrink-0">
                <Icon icon={TriangleAlert} size="xsm" color="warning" />
              </div>
              <Text type="body" size="xsm" color="secondary">
                {note}
              </Text>
            </HStack>
          ))}

          <Banner
            status="info"
            title="Prototype"
            description={`Nothing is sent to ${provider.name}. Any key of ${MOCK_MIN_KEY_LENGTH}+ characters is accepted so you can walk the flow.`}
          />

          {error && <Banner status="error" title="Couldn’t verify credentials" description={error} />}
        </>
      )}
    </VStack>
  )

  const handshakeStep = (
    <VStack gap={3} hAlign="center" padding={6}>
      <Spinner size="lg" />
      <Text type="body" weight="semibold">
        Waiting for {provider.name}…
      </Text>
      <Text type="body" size="sm" color="secondary">
        Approve the request in the {provider.name} window, then you’ll come back here to choose what
        gets indexed.
      </Text>
    </VStack>
  )

  const selectStep = (
    <VStack gap={3}>
      <VStack gap={1}>
        <Text type="body" size="sm" color="secondary">
          Connected as <strong>{accountLabel}</strong>
        </Text>
        <Text type="body" size="sm">
          Choose which {provider.resourceNoun} this project should index. Nothing is selected by
          default — only what you pick here is ever read.
        </Text>
      </VStack>

      {provider.id === 'notion' && (
        <Banner
          status="info"
          title="Pick top-level roots only"
          description="A page that already sits beneath another selection would be indexed twice. Children of a selected root are covered automatically."
        />
      )}

      <TextInput
        label={`Search ${provider.resourceNoun}`}
        isLabelHidden
        value={query}
        onChange={setQuery}
        placeholder={`Search ${provider.resourceNoun}…`}
        startIcon={Search}
        hasClear
      />

      <HStack gap={2} vAlign="center">
        <Text type="body" size="xsm" color="secondary">
          {selected.length} of {selectable.length} selected
        </Text>
        <div className="ml-auto flex gap-2">
          <Button
            label="Select all"
            size="sm"
            variant="ghost"
            onClick={() => setSelected(selectable.map((r) => r.id))}
          />
          <Button label="Clear" size="sm" variant="ghost" onClick={() => setSelected([])} />
        </div>
      </HStack>

      <div className="max-h-72 overflow-y-auto">
        <CheckboxList
          label={`Available ${provider.resourceNoun}`}
          isLabelHidden
          value={selected}
          onChange={setSelected}
          hasDividers
        >
          {visible.map((r) => (
            <CheckboxListItem
              key={r.id}
              value={r.id}
              label={r.name}
              description={r.hint}
              isDisabled={!r.selectable}
            />
          ))}
        </CheckboxList>
      </div>

      {visible.length === 0 && (
        <Text type="body" size="sm" color="disabled">
          Nothing matches “{query}”.
        </Text>
      )}

      {selected.length === 0 && (
        <Banner
          status="warning"
          title="Nothing selected"
          description={`Pick at least one of the ${provider.resourceNoun} above. A connection that indexes nothing isn’t saved.`}
        />
      )}
    </VStack>
  )

  const cadenceStep = (
    <VStack gap={4}>
      <VStack gap={2}>
        <Text type="label" weight="semibold">
          This connection will index
        </Text>
        <HStack gap={1} wrap="wrap">
          {selectedNames.map((name) => (
            <Token key={name} label={name} size="sm" />
          ))}
        </HStack>
        <Text type="body" size="xsm" color="secondary">
          from {accountLabel} · nothing else in {provider.name} is reachable by this connection.
        </Text>
      </VStack>

      <Selector
        label="Sync frequency"
        description="You can always trigger a manual resync from the project’s Sources page."
        options={CADENCE_OPTIONS}
        value={cadence}
        onChange={(v) => setCadence(v as SyncCadence)}
      />

      <VStack gap={1.5}>
        <Text type="label" weight="semibold">
          Granted scopes
        </Text>
        {grantedScopes.map((s) => (
          <Text key={s} type="code" size="xsm" color="secondary">
            {s}
          </Text>
        ))}
      </VStack>
    </VStack>
  )

  const body =
    step === 'review'
      ? reviewStep
      : step === 'credentials'
        ? credentialsStep
        : step === 'handshake'
          ? handshakeStep
          : step === 'select'
            ? selectStep
            : cadenceStep

  // --- Actions -------------------------------------------------------------

  const actions = () => {
    if (step === 'review') {
      return (
        <>
          <Button label="Cancel" variant="ghost" onClick={onCancel} />
          <Button
            label={provider.connectLabel}
            variant="primary"
            onClick={() => (provider.authKind === 'api_key' ? setStep('credentials') : startRedirect())}
          />
        </>
      )
    }
    if (step === 'credentials') {
      return (
        <>
          <Button label="Back" variant="ghost" onClick={() => setStep('review')} />
          {(!hasStoredCredential || replacingSecret) && (
            <Button label="Test connection" variant="primary" isLoading={busy} onClick={testCredential} />
          )}
        </>
      )
    }
    if (step === 'handshake') {
      return <Button label="Cancel" variant="ghost" onClick={onCancel} />
    }
    if (step === 'select') {
      return (
        <>
          <Button
            label={isEditScope ? 'Cancel' : 'Back'}
            variant="ghost"
            onClick={() => (isEditScope ? onCancel() : setStep(provider.authKind === 'api_key' ? 'credentials' : 'review'))}
          />
          <Button
            label="Continue"
            variant="primary"
            isDisabled={selected.length === 0}
            tooltip={`Select at least one of the ${provider.resourceNoun} to continue.`}
            onClick={() => setStep('cadence')}
          />
        </>
      )
    }
    return (
      <>
        <Button label="Back" variant="ghost" onClick={() => setStep('select')} />
        <Button
          label={isEditScope ? 'Save changes' : `Finish connecting ${provider.name}`}
          variant="primary"
          onClick={finish}
        />
      </>
    )
  }

  return (
    <VStack gap={4}>
      <Text type="body" size="xsm" color="disabled">
        Step {stepNumber} of {stepOrder.length}
      </Text>
      {body}
      <Divider />
      <HStack gap={2} hAlign="end">
        {actions()}
      </HStack>
    </VStack>
  )
}

interface DialogProps extends Omit<FlowProps, 'onDone' | 'onCancel'> {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onDone?: () => void
}

/** Dialog wrapper around {@link ConnectSourceFlow}. */
export function ConnectSourceDialog({ isOpen, onOpenChange, onDone, ...flow }: DialogProps) {
  const close = () => onOpenChange(false)

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={560}>
      {/* DialogHeader belongs in Layout's header slot: it positions its title
          and close button with negative margins that need the slot's padding
          to sit in, and clip against the dialog edge without it. */}
      <Layout
        header={
          <DialogHeader
            title={
              flow.mode === 'edit-scope'
                ? `Edit ${flow.provider.name} scope`
                : `Connect ${flow.provider.name}`
            }
            subtitle={
              flow.mode === 'edit-scope'
                ? 'Change what this connection indexes.'
                : 'Review what you’re granting, then pick what gets indexed.'
            }
            onOpenChange={onOpenChange}
            hasDivider
          />
        }
        content={
          <LayoutContent>
            {/* Remounted per provider so switching sources never carries state
                (least of all a half-typed credential) into the next flow. */}
            <ConnectSourceFlow
              key={`${flow.provider.id}:${flow.mode ?? 'connect'}`}
              {...flow}
              onDone={() => {
                onDone?.()
                close()
              }}
              onCancel={close}
            />
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
