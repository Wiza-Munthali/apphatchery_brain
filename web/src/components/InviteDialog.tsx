import { useMemo } from 'react'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { MultiSelector } from '@astryxdesign/core/MultiSelector'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import type { OrgRole, ProjectAccess } from '../types'
import { useOrg } from '../context/OrgContext'
import { buildAccess, describeAccess, isAccessEmpty, ROLE_DESCRIPTIONS, ROLE_LABELS, type AccessChoice } from '../lib/access'

export interface InviteDraft {
  emailsRaw: string
  role: OrgRole
  choice: AccessChoice
  selectedProjectIds: string[]
}

export const emptyInviteDraft = (choice: AccessChoice = 'all'): InviteDraft => ({
  emailsRaw: '',
  role: 'member',
  choice,
  selectedProjectIds: [],
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    if (EMAIL_RE.test(p)) {
      // De-duplicate so pasting a list twice doesn't send two invites.
      if (!valid.includes(p.toLowerCase())) valid.push(p.toLowerCase())
    } else {
      invalid.push(p)
    }
  }
  return { valid, invalid }
}

/**
 * Only 'admin' and 'member' are offered. Ownership is not something to hand
 * out through an email invite — transferring it is a deliberate, separate act.
 */
const ROLE_OPTIONS = (['admin', 'member'] as OrgRole[]).map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
}))

interface FormProps {
  draft: InviteDraft
  onChange: (draft: InviteDraft) => void
  /** Enables the "this project only" shortcut. */
  currentProjectName?: string
}

/**
 * Controlled invite form, shared by the standalone dialog and the
 * project-creation wizard (where the project doesn't exist yet, so the draft
 * has to be collected and applied afterwards).
 */
export function InviteForm({ draft, onChange, currentProjectName }: FormProps) {
  const { projects } = useOrg()
  const { valid, invalid } = useMemo(() => parseEmails(draft.emailsRaw), [draft.emailsRaw])

  const set = (patch: Partial<InviteDraft>) => onChange({ ...draft, ...patch })

  const access = buildAccess(draft.choice, draft.selectedProjectIds, undefined)

  return (
    <VStack gap={4}>
      <TextArea
        label="Email addresses"
        description="One per line, or separated by commas."
        placeholder={'sofia@emory.edu\ntomas@emory.edu'}
        value={draft.emailsRaw}
        onChange={(v) => set({ emailsRaw: v })}
        rows={3}
        status={
          invalid.length > 0
            ? { type: 'warning', message: `Not a valid email: ${invalid.slice(0, 3).join(', ')}` }
            : undefined
        }
      />

      <Selector
        label="Role"
        description={ROLE_DESCRIPTIONS[draft.role]}
        options={ROLE_OPTIONS}
        value={draft.role}
        onChange={(v) => set({ role: v as OrgRole })}
      />

      <RadioList
        label="Project access"
        description="What these people will be able to search and ask about."
        value={draft.choice}
        onChange={(v) => set({ choice: v as AccessChoice })}
      >
        <RadioListItem
          value="all"
          label="All projects"
          description="Including any project created later."
        />
        <RadioListItem
          value="projects"
          label="Specific projects"
          description="Pick exactly which projects they can see."
        />
        {currentProjectName && (
          <RadioListItem
            value="single"
            label={`${currentProjectName} only`}
            description="The project you’re working in right now."
          />
        )}
      </RadioList>

      {draft.choice === 'projects' && (
        <MultiSelector
          label="Projects"
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          value={draft.selectedProjectIds}
          onChange={(v) => set({ selectedProjectIds: v })}
          placeholder="Select projects…"
          triggerDisplay="badges"
          hasSearch
          hasSelectAll
          status={
            isAccessEmpty(access) ? { type: 'error', message: 'Pick at least one project.' } : undefined
          }
        />
      )}

      <Divider />

      <VStack gap={1}>
        {valid.length === 0 ? (
          <Text type="body" size="sm" color="disabled">
            Add at least one email address to send an invite.
          </Text>
        ) : (
          <Text type="body" size="sm">
            <strong>{valid.length}</strong> {valid.length === 1 ? 'person' : 'people'} will get{' '}
            <strong>{ROLE_LABELS[draft.role]}</strong> access to{' '}
            <strong>
              {draft.choice === 'all'
                ? 'every project in the organization'
                : draft.choice === 'single'
                  ? currentProjectName
                  : describeAccess(access, projects)}
            </strong>
            .
          </Text>
        )}
        <Text type="body" size="xsm" color="secondary">
          Invites expire in 7 days and can be revoked at any time before they’re accepted.
        </Text>
      </VStack>
    </VStack>
  )
}

/** True when a draft is complete enough to send. */
export function canSendInvite(draft: InviteDraft): boolean {
  const { valid } = parseEmails(draft.emailsRaw)
  if (valid.length === 0) return false
  if (draft.choice === 'projects' && draft.selectedProjectIds.length === 0) return false
  return true
}

export function buildInviteAccess(draft: InviteDraft, currentProjectId?: string): ProjectAccess {
  return buildAccess(draft.choice, draft.selectedProjectIds, currentProjectId)
}

interface DialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  draft: InviteDraft
  onDraftChange: (draft: InviteDraft) => void
  currentProjectId?: string
  onInvited?: (count: number) => void
}

export function InviteDialog({
  isOpen,
  onOpenChange,
  draft,
  onDraftChange,
  currentProjectId,
  onInvited,
}: DialogProps) {
  const { inviteMembers, getProject } = useOrg()
  const currentProjectName = currentProjectId ? getProject(currentProjectId)?.name : undefined

  const send = () => {
    const { valid } = parseEmails(draft.emailsRaw)
    inviteMembers(valid, draft.role, buildInviteAccess(draft, currentProjectId))
    onInvited?.(valid.length)
    onDraftChange(emptyInviteDraft(currentProjectId ? 'single' : 'all'))
    onOpenChange(false)
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={520}>
      <Layout
        header={
          <DialogHeader
            title="Invite people"
            subtitle="They’ll get an email with a link to join your organization."
            onOpenChange={onOpenChange}
            hasDivider
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <InviteForm draft={draft} onChange={onDraftChange} currentProjectName={currentProjectName} />
              <Banner
                status="info"
                title="Prototype"
                description="No email is actually sent. The invite appears under Pending invites, where you can copy its link."
              />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="ghost" onClick={() => onOpenChange(false)} />
              <Button
                label="Send invites"
                variant="primary"
                isDisabled={!canSendInvite(draft)}
                tooltip="Add at least one valid email and pick the projects they can access."
                onClick={send}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
