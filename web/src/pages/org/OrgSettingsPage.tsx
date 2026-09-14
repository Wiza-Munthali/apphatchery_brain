import { useState } from 'react'
import { Settings } from 'lucide-react'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Divider } from '@astryxdesign/core/Divider'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import type { SyncCadence } from '../../types'
import { slugify, useOrg } from '../../context/OrgContext'
import { AvatarPicker } from '../../components/AvatarPicker'

const CADENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
]

export function OrgSettingsPage() {
  const { org, projects, connections, members, updateOrg, resetOrg } = useOrg()
  const showToast = useToast()

  const [name, setName] = useState(org.name)
  const [slug, setSlug] = useState(org.slug)
  const [initial, setInitial] = useState(org.initial)
  const [color, setColor] = useState(org.color)
  const [avatarUrl, setAvatarUrl] = useState(org.avatarUrl)
  const [cadence, setCadence] = useState<SyncCadence>(org.defaultCadence)
  const [confirmReset, setConfirmReset] = useState(false)

  const dirty =
    name !== org.name ||
    slug !== org.slug ||
    initial !== org.initial ||
    color !== org.color ||
    avatarUrl !== org.avatarUrl ||
    cadence !== org.defaultCadence

  const save = () => {
    updateOrg({
      name: name.trim(),
      slug: slugify(slug),
      initial: initial.slice(0, 1).toUpperCase(),
      color,
      avatarUrl,
      defaultCadence: cadence,
    })
    showToast({ body: 'Organization settings saved.' })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <VStack gap={5}>
        <VStack gap={1}>
          <HStack gap={1.5} vAlign="center">
            <Icon icon={Settings} size="sm" />
            <Text type="body" size="lg" weight="semibold">
              Organization settings
            </Text>
          </HStack>
          <Text type="body" size="sm" color="secondary">
            {projects.length} projects · {members.length} members · {connections.length} connections
          </Text>
        </VStack>

        <Card padding={4}>
          <VStack gap={4}>
            <Text type="body" weight="semibold">
              Identity
            </Text>
            <TextInput label="Organization name" value={name} onChange={setName} isRequired />
            <TextInput
              label="URL slug"
              description="Used in links to your organization. Lowercase letters, numbers and dashes."
              value={slug}
              onChange={setSlug}
              status={
                slugify(slug) !== slug ? { type: 'warning', message: `Will be saved as “${slugify(slug)}”.` } : undefined
              }
            />
            <AvatarPicker
              label="Organization avatar"
              description="Upload your organization’s logo, or use a letter on a coloured tile."
              imageUrl={avatarUrl}
              initial={initial}
              color={color}
              onImageChange={setAvatarUrl}
              onInitialChange={setInitial}
              onColorChange={setColor}
            />
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={4}>
            <Text type="body" weight="semibold">
              Sync defaults
            </Text>
            <Selector
              label="Default sync frequency"
              description="Pre-selected when a new connection is set up. Existing connections keep their own setting."
              options={CADENCE_OPTIONS}
              value={cadence}
              onChange={(v) => setCadence(v as SyncCadence)}
            />
          </VStack>
        </Card>

        <HStack gap={2} hAlign="end">
          <Button
            label="Save changes"
            variant="primary"
            isDisabled={!dirty || name.trim().length === 0}
            tooltip={dirty ? 'Give the organization a name.' : 'Nothing to save.'}
            onClick={save}
          />
        </HStack>

        <Divider />

        <Card padding={4} variant="red">
          <VStack gap={3}>
            <Text type="body" weight="semibold">
              Danger zone
            </Text>
            <Text type="body" size="sm" color="secondary">
              Removes every project, connection and member except you. Connections are dropped here
              only — grants on GitHub, Notion, Slack and Zulip must be revoked in those tools
              separately.
            </Text>
            <HStack>
              <Button
                label="Reset organization"
                variant="destructive"
                onClick={() => setConfirmReset(true)}
              />
            </HStack>
          </VStack>
        </Card>
      </VStack>

      <AlertDialog
        isOpen={confirmReset}
        onOpenChange={setConfirmReset}
        title={`Reset ${org.name}?`}
        description={`This deletes ${projects.length} projects, ${connections.length} connections and removes ${Math.max(members.length - 1, 0)} members. Indexed content becomes unsearchable. This cannot be undone.`}
        actionLabel="Reset organization"
        actionVariant="destructive"
        onAction={() => {
          resetOrg()
          setConfirmReset(false)
          showToast({ body: 'Organization reset.' })
        }}
      />
    </div>
  )
}
