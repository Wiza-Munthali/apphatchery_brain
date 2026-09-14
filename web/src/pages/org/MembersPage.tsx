import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link2, UserPlus, Users } from 'lucide-react'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { MultiSelector } from '@astryxdesign/core/MultiSelector'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { Avatar } from '@astryxdesign/core/Avatar'
import { useToast } from '@astryxdesign/core/Toast'
import type { Invite, MemberStatus, OrgMember, ProjectAccess } from '../../types'
import { useOrg } from '../../context/OrgContext'
import { buildAccess, isAccessEmpty, ROLE_LABELS, type AccessChoice } from '../../lib/access'
import { AccessSummary } from '../../components/AccessSummary'
import { InviteDialog, emptyInviteDraft } from '../../components/InviteDialog'

const MEMBER_STATUS_META: Record<
  MemberStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  active: { label: 'Active', variant: 'success' },
  invited: { label: 'Invited', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'neutral' },
}

const INVITE_STATUS_META: Record<
  Invite['status'],
  { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }
> = {
  pending: { label: 'Pending', variant: 'warning' },
  accepted: { label: 'Accepted', variant: 'success' },
  revoked: { label: 'Revoked', variant: 'neutral' },
  expired: { label: 'Expired', variant: 'error' },
}

/** Shared editor for a ProjectAccess grant, used for one member or several. */
function AccessDialog({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  initial,
  onSave,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  initial: ProjectAccess
  onSave: (access: ProjectAccess) => void
}) {
  const { projects } = useOrg()
  const [choice, setChoice] = useState<AccessChoice>(initial.kind === 'all' ? 'all' : 'projects')
  const [ids, setIds] = useState<string[]>(initial.kind === 'projects' ? initial.projectIds : [])

  const access = buildAccess(choice, ids)

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={480}>
      <Layout
        header={<DialogHeader title={title} subtitle={subtitle} onOpenChange={onOpenChange} hasDivider />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              <RadioList label="Project access" value={choice} onChange={(v) => setChoice(v as AccessChoice)}>
                <RadioListItem
                  value="all"
                  label="All projects"
                  description="Including any project created later."
                />
                <RadioListItem value="projects" label="Specific projects" description="Pick exactly which." />
              </RadioList>

              {choice === 'projects' && (
                <MultiSelector
                  label="Projects"
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  value={ids}
                  onChange={setIds}
                  placeholder="Select projects…"
                  triggerDisplay="badges"
                  hasSearch
                  hasSelectAll
                  status={isAccessEmpty(access) ? { type: 'error', message: 'Pick at least one project.' } : undefined}
                />
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="ghost" onClick={() => onOpenChange(false)} />
              <Button
                label="Save access"
                variant="primary"
                isDisabled={isAccessEmpty(access)}
                tooltip="Pick at least one project."
                onClick={() => {
                  onSave(access)
                  onOpenChange(false)
                }}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}

export function MembersPage() {
  const {
    org,
    members,
    invites,
    currentUser,
    updateMemberRole,
    updateMemberAccess,
    removeMember,
    resendInvite,
    revokeInvite,
  } = useOrg()
  const showToast = useToast()

  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'invites' ? 'invites' : 'active'

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteDraft, setInviteDraft] = useState(() => emptyInviteDraft('all'))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingAccessFor, setEditingAccessFor] = useState<OrgMember | null>(null)
  const [bulkAccessOpen, setBulkAccessOpen] = useState(false)
  const [removing, setRemoving] = useState<OrgMember | null>(null)

  const pendingInvites = useMemo(() => invites.filter((i) => i.status !== 'accepted'), [invites])
  const pendingCount = invites.filter((i) => i.status === 'pending').length

  // The owner can't be demoted or removed from the org here — that would leave
  // the organization without an administrator.
  const isProtected = (m: OrgMember) => m.role === 'owner'
  const selectable = members.filter((m) => !isProtected(m))
  const allSelected = selectable.length > 0 && selectedIds.length === selectable.length

  const copyInviteLink = async (invite: Invite) => {
    const url = `${window.location.origin}${window.location.pathname}#/invite/${invite.id}`
    try {
      await navigator.clipboard.writeText(url)
      showToast({ body: `Invite link for ${invite.email} copied.` })
    } catch {
      showToast({ body: 'Couldn’t copy — your browser blocked clipboard access.', type: 'error' })
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <VStack gap={5}>
        <HStack gap={3} vAlign="center">
          <VStack gap={1}>
            <HStack gap={1.5} vAlign="center">
              <Icon icon={Users} size="sm" />
              <Text type="body" size="lg" weight="semibold">
                Members
              </Text>
            </HStack>
            <Text type="body" size="sm" color="secondary">
              Who’s in your organization, and which projects each person can search.
            </Text>
          </VStack>
          <div className="ml-auto">
            <Button
              label="Invite people"
              variant="primary"
              icon={<Icon icon={UserPlus} size="sm" />}
              onClick={() => setInviteOpen(true)}
            />
          </div>
        </HStack>

        <TabList
          value={tab}
          onChange={(v) => setParams(v === 'invites' ? { tab: 'invites' } : {})}
          hasDivider
        >
          <Tab value="active" label={`Active (${members.length})`} />
          <Tab value="invites" label={`Pending invites (${pendingCount})`} />
        </TabList>

        {tab === 'active' ? (
          <VStack gap={3}>
            {selectedIds.length > 0 && (
              <Card padding={3} variant="muted">
                <HStack gap={3} vAlign="center">
                  <Text type="body" size="sm">
                    {selectedIds.length} selected
                  </Text>
                  <div className="ml-auto flex gap-2">
                    <Button label="Change access" size="sm" onClick={() => setBulkAccessOpen(true)} />
                    <Button label="Clear" size="sm" variant="ghost" onClick={() => setSelectedIds([])} />
                  </div>
                </HStack>
              </Card>
            )}

            <Table density="balanced" hasHover>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>
                    <CheckboxInput
                      label="Select all members"
                      isLabelHidden
                      value={allSelected ? true : selectedIds.length > 0 ? 'indeterminate' : false}
                      onChange={(checked) => setSelectedIds(checked ? selectable.map((m) => m.id) : [])}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>Member</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Project access</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Last active</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const statusMeta = MEMBER_STATUS_META[m.status]
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <CheckboxInput
                          label={`Select ${m.name}`}
                          isLabelHidden
                          value={selectedIds.includes(m.id)}
                          isDisabled={isProtected(m)}
                          disabledMessage="The owner’s access can’t be changed in bulk."
                          onChange={(checked) =>
                            setSelectedIds((prev) =>
                              checked ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <HStack gap={2} vAlign="center">
                          <Avatar name={m.name} size="sm" />
                          <VStack gap={0}>
                            <Text type="body" size="sm" weight="medium">
                              {m.name}
                              {m.id === currentUser?.id ? ' (you)' : ''}
                            </Text>
                            <Text type="body" size="xsm" color="secondary">
                              {m.email}
                            </Text>
                          </VStack>
                        </HStack>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.role === 'owner' ? 'purple' : m.role === 'admin' ? 'info' : 'neutral'}
                          label={ROLE_LABELS[m.role]}
                        />
                      </TableCell>
                      <TableCell>
                        <AccessSummary access={m.access} />
                      </TableCell>
                      <TableCell>
                        {/* Badge rather than StatusDot: StatusDot is a bare dot
                            with an aria-label, so the status wouldn't be
                            readable in the table. */}
                        <Badge variant={statusMeta.variant} label={statusMeta.label} />
                      </TableCell>
                      <TableCell>
                        {m.lastActiveAt ? (
                          <Timestamp value={m.lastActiveAt} format="relative" type="body" size="xsm" />
                        ) : (
                          <Text type="body" size="xsm" color="disabled">
                            Never
                          </Text>
                        )}
                      </TableCell>
                      <TableCell>
                        <MoreMenu
                          label={`Actions for ${m.name}`}
                          items={[
                            {
                              label: 'Change project access',
                              onClick: () => setEditingAccessFor(m),
                              isDisabled: isProtected(m),
                            },
                            {
                              label: m.role === 'admin' ? 'Change to Member' : 'Change to Admin',
                              onClick: () => updateMemberRole(m.id, m.role === 'admin' ? 'member' : 'admin'),
                              isDisabled: isProtected(m),
                            },
                            { type: 'divider' },
                            {
                              label: 'Remove from organization',
                              onClick: () => setRemoving(m),
                              isDisabled: isProtected(m),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </VStack>
        ) : pendingInvites.length === 0 ? (
          <EmptyState
            title="No invites"
            description="Invite someone and their pending invite will show up here until they accept it."
            actions={<Button label="Invite people" variant="primary" onClick={() => setInviteOpen(true)} />}
          />
        ) : (
          <Table density="balanced" hasHover>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Project access</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Expires</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvites.map((i) => {
                const meta = INVITE_STATUS_META[i.status]
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Text type="body" size="sm">
                        {i.email}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge variant={i.role === 'admin' ? 'info' : 'neutral'} label={ROLE_LABELS[i.role]} />
                    </TableCell>
                    <TableCell>
                      <AccessSummary access={i.access} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant} label={meta.label} />
                    </TableCell>
                    <TableCell>
                      <Timestamp value={i.expiresAt} format="relative" type="body" size="xsm" />
                    </TableCell>
                    <TableCell>
                      <HStack gap={1} vAlign="center">
                        <Button
                          label="Copy link"
                          size="sm"
                          variant="ghost"
                          icon={<Icon icon={Link2} size="xsm" />}
                          isDisabled={i.status !== 'pending'}
                          tooltip="Only a pending invite has a usable link."
                          onClick={() => copyInviteLink(i)}
                        />
                        <MoreMenu
                          label={`Actions for ${i.email}`}
                          items={[
                            {
                              label: i.status === 'pending' ? 'Resend invite' : 'Send a new invite',
                              onClick: () => {
                                resendInvite(i.id)
                                showToast({ body: `Invite resent to ${i.email}.` })
                              },
                            },
                            {
                              label: 'Revoke invite',
                              onClick: () => revokeInvite(i.id),
                              isDisabled: i.status !== 'pending',
                            },
                          ]}
                        />
                      </HStack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </VStack>

      <InviteDialog
        isOpen={inviteOpen}
        onOpenChange={setInviteOpen}
        draft={inviteDraft}
        onDraftChange={setInviteDraft}
        onInvited={(count) => {
          showToast({ body: `${count} invite${count === 1 ? '' : 's'} sent.` })
          setParams({ tab: 'invites' })
        }}
      />

      {editingAccessFor && (
        <AccessDialog
          key={editingAccessFor.id}
          isOpen
          onOpenChange={(open) => !open && setEditingAccessFor(null)}
          title={`Project access for ${editingAccessFor.name}`}
          subtitle="Takes effect immediately."
          initial={editingAccessFor.access}
          onSave={(access) => {
            updateMemberAccess(editingAccessFor.id, access)
            setEditingAccessFor(null)
          }}
        />
      )}

      {bulkAccessOpen && (
        <AccessDialog
          isOpen
          onOpenChange={setBulkAccessOpen}
          title={`Project access for ${selectedIds.length} members`}
          subtitle="This replaces each selected person’s current access."
          initial={{ kind: 'projects', projectIds: [] }}
          onSave={(access) => {
            selectedIds.forEach((id) => updateMemberAccess(id, access))
            setSelectedIds([])
            setBulkAccessOpen(false)
          }}
        />
      )}

      {removing && (
        <AlertDialog
          isOpen
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Remove ${removing.name}?`}
          description={`They lose access to every project in ${org.name} immediately. Their past questions stay in the activity log, and you can invite them again later.`}
          actionLabel="Remove"
          actionVariant="destructive"
          onAction={() => {
            removeMember(removing.id)
            setRemoving(null)
          }}
        />
      )}
    </div>
  )
}
