import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Divider } from '@astryxdesign/core/Divider'
import { Grid } from '@astryxdesign/core/Grid'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import type { Project } from '../types'
import { AVAILABLE_PROVIDERS, type ProviderSpec } from '../data/providers'
import { PROJECT_COLORS, useOrg } from '../context/OrgContext'
import { ConnectSourceFlow } from './ConnectSourceDialog'
import { InviteForm, buildInviteAccess, canSendInvite, emptyInviteDraft, parseEmails } from './InviteDialog'

type Step = 'details' | 'connect' | 'invite'

const STEPS: Step[] = ['details', 'connect', 'invite']

const STEP_TITLES: Record<Step, { title: string; subtitle: string }> = {
  details: { title: 'New project', subtitle: 'Name it and give it a short description.' },
  connect: { title: 'Connect sources', subtitle: 'Point the project at the tools it should index. You can do this later.' },
  invite: { title: 'Invite people', subtitle: 'Give teammates access to this project. You can do this later.' },
}

export function NewProjectDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}) {
  const navigate = useNavigate()
  const { createProject, inviteMembers, connectionsForProject } = useOrg()

  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [initial, setInitial] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])

  /** Set once step 1 completes — the project exists from then on. */
  const [project, setProject] = useState<Project | null>(null)
  const [activeProvider, setActiveProvider] = useState<ProviderSpec | null>(null)
  const [inviteDraft, setInviteDraft] = useState(() => emptyInviteDraft('single'))

  const reset = () => {
    setStep('details')
    setName('')
    setDescription('')
    setInitial('')
    setColor(PROJECT_COLORS[0])
    setProject(null)
    setActiveProvider(null)
    setInviteDraft(emptyInviteDraft('single'))
  }

  const close = () => {
    onOpenChange(false)
    reset()
  }

  const finish = () => {
    const target = project
    close()
    if (target) navigate(`/p/${target.id}`)
  }

  const derivedInitial = (initial || name.trim()[0] || 'P').toUpperCase()

  const createAndAdvance = () => {
    const created = createProject({ name, description, color, initial: derivedInitial })
    setProject(created)
    setStep('connect')
  }

  const sendInvitesAndFinish = () => {
    if (project && canSendInvite(inviteDraft)) {
      const { valid } = parseEmails(inviteDraft.emailsRaw)
      inviteMembers(valid, inviteDraft.role, buildInviteAccess(inviteDraft, project.id))
    }
    finish()
  }

  const connected = project ? connectionsForProject(project.id) : []

  // --- Step bodies ---------------------------------------------------------

  const detailsStep = (
    <VStack gap={4}>
      <TextInput
        label="Project name"
        value={name}
        onChange={setName}
        placeholder="e.g. Fabla"
        isRequired
        hasAutoFocus
      />
      <TextArea
        label="Description"
        description="What this project is, in a sentence. Shown on the project picker."
        value={description}
        onChange={setDescription}
        placeholder="Flutter research diary app — daily diary & EMA studies."
        rows={3}
        isOptional
      />
      <HStack gap={3} vAlign="end">
        <TextInput
          label="Avatar letter"
          value={initial || derivedInitial}
          onChange={(v) => setInitial(v.slice(0, 1))}
          width={120}
        />
        <VStack gap={1.5}>
          <Text type="label" color="secondary">
            Colour
          </Text>
          <HStack gap={1.5}>
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use colour ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-lg bg-gradient-to-br ${c} ${
                  c === color
                    ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-neutral-400 dark:ring-offset-neutral-900'
                    : ''
                }`}
              />
            ))}
          </HStack>
        </VStack>
      </HStack>

      <HStack gap={3} vAlign="center">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-base font-bold text-white`}
        >
          {derivedInitial}
        </div>
        <Text type="body" size="sm" color="secondary">
          {name.trim() || 'Your project'} — this is how it appears on the picker.
        </Text>
      </HStack>
    </VStack>
  )

  const connectStep = activeProvider ? (
    <VStack gap={3}>
      <Text type="body" size="sm" weight="semibold">
        Connect {activeProvider.name}
      </Text>
      {/* Rendered inline rather than as a nested Dialog — stacking native
          <dialog> elements is fragile, and the wizard already owns a surface. */}
      <ConnectSourceFlow
        key={activeProvider.id}
        provider={activeProvider}
        projectId={project?.id ?? ''}
        onDone={() => setActiveProvider(null)}
        onCancel={() => setActiveProvider(null)}
      />
    </VStack>
  ) : (
    <VStack gap={4}>
      <Banner
        status="success"
        title={`${project?.name} created`}
        description="Connect its sources now, or skip and do it from the project’s Sources page later."
      />
      <Grid columns={{ minWidth: 210, max: 2 }} gap={3}>
        {AVAILABLE_PROVIDERS.map((p) => {
          const existing = connected.find((c) => c.source === p.id)
          const ProviderIcon = p.icon
          return (
            <Card key={p.id} padding={3}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Icon icon={ProviderIcon} size="sm" />
                  <Text type="body" size="sm" weight="semibold">
                    {p.name}
                  </Text>
                  {existing && (
                    <div className="ml-auto">
                      <Icon icon={Check} size="sm" color="success" label="Connected" />
                    </div>
                  )}
                </HStack>
                <Text type="body" size="xsm" color="secondary" maxLines={2}>
                  {existing
                    ? `${existing.selectedResourceIds.length} ${p.resourceNoun} selected`
                    : p.authSummary}
                </Text>
                <Button
                  label={existing ? 'Reconfigure' : p.connectLabel}
                  size="sm"
                  variant={existing ? 'secondary' : 'primary'}
                  onClick={() => setActiveProvider(p)}
                />
              </VStack>
            </Card>
          )
        })}
      </Grid>
    </VStack>
  )

  const inviteStep = (
    <InviteForm draft={inviteDraft} onChange={setInviteDraft} currentProjectName={project?.name} />
  )

  const body = step === 'details' ? detailsStep : step === 'connect' ? connectStep : inviteStep

  // --- Footer --------------------------------------------------------------

  const footer = () => {
    if (step === 'details') {
      return (
        <>
          <Button label="Cancel" variant="ghost" onClick={close} />
          <Button
            label="Create project"
            variant="primary"
            isDisabled={name.trim().length === 0}
            tooltip="Give the project a name first."
            onClick={createAndAdvance}
          />
        </>
      )
    }
    if (step === 'connect') {
      // While a provider flow is open it owns its own actions.
      if (activeProvider) return null
      return (
        <>
          <Button label="Skip for now" variant="ghost" onClick={() => setStep('invite')} />
          <Button label="Continue" variant="primary" onClick={() => setStep('invite')} />
        </>
      )
    }
    return (
      <>
        <Button label="Skip for now" variant="ghost" onClick={finish} />
        <Button
          label={canSendInvite(inviteDraft) ? 'Send invites & finish' : 'Finish'}
          variant="primary"
          onClick={sendInvitesAndFinish}
        />
      </>
    )
  }

  const footerContent = footer()
  const stepNumber = STEPS.indexOf(step) + 1

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => (open ? onOpenChange(true) : close())} purpose="form" width={600} padding={0}>
      <VStack>
        <DialogHeader
          title={STEP_TITLES[step].title}
          subtitle={STEP_TITLES[step].subtitle}
          onOpenChange={(open) => (open ? onOpenChange(true) : close())}
          hasDivider
        />
        <div className="px-5 pt-4">
          <ProgressBar
            label="Progress"
            isLabelHidden
            value={stepNumber}
            max={STEPS.length}
            hasValueLabel
            formatValueLabel={(v, m) => `Step ${v} of ${m}`}
          />
        </div>
        <div className="max-h-[62vh] overflow-y-auto px-5 py-4">{body}</div>
        {footerContent && (
          <>
            <Divider />
            <div className="px-5 py-3">
              <HStack gap={2} hAlign="end">
                {footerContent}
              </HStack>
            </div>
          </>
        )}
      </VStack>
    </Dialog>
  )
}
