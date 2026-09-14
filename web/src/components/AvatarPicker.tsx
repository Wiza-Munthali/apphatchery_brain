import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { FieldStatus } from '@astryxdesign/core/FieldStatus'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { PROJECT_COLORS } from '../context/OrgContext'
import { fileToAvatarDataUrl, ImageError } from '../lib/image'
import { EntityAvatar } from './EntityAvatar'

/**
 * Picks an avatar for an org or project: upload a logo, or fall back to a
 * letter on a coloured tile.
 *
 * The letter and colour controls are hidden while a logo is set, because
 * neither is rendered anywhere in that case — leaving them visible would
 * invite people to tune settings that have no effect.
 */
export function AvatarPicker({
  imageUrl,
  initial,
  color,
  onImageChange,
  onInitialChange,
  onColorChange,
  label = 'Avatar',
  description = 'Upload a logo, or use a letter on a coloured tile.',
}: {
  imageUrl?: string
  initial: string
  color: string
  onImageChange: (imageUrl: string | undefined) => void
  onInitialChange: (initial: string) => void
  onColorChange: (color: string) => void
  label?: string
  description?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onImageChange(await fileToAvatarDataUrl(file))
    } catch (e) {
      setError(e instanceof ImageError ? e.message : 'That image couldn’t be used.')
    } finally {
      setBusy(false)
      // Reset so picking the same file again still fires a change event.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <VStack gap={2}>
      <VStack gap={0.5}>
        <Text type="label" color="secondary">
          {label}
        </Text>
        <Text type="body" size="xsm" color="secondary">
          {description}
        </Text>
      </VStack>

      <HStack gap={3} vAlign="center">
        <EntityAvatar imageUrl={imageUrl} initial={initial} color={color} size={56} radius="xl" />
        <VStack gap={1.5}>
          <HStack gap={2}>
            <Button
              label={imageUrl ? 'Replace image' : 'Upload image'}
              size="sm"
              isLoading={busy}
              icon={<Icon icon={ImagePlus} size="xsm" />}
              onClick={() => fileRef.current?.click()}
            />
            {imageUrl && (
              <Button
                label="Remove"
                size="sm"
                variant="ghost"
                icon={<Icon icon={Trash2} size="xsm" />}
                onClick={() => {
                  onImageChange(undefined)
                  setError(null)
                }}
              />
            )}
          </HStack>
          <Text type="body" size="xsm" color="disabled">
            PNG, JPG, SVG or WebP. Cropped to a square and resized to 256px.
          </Text>
        </VStack>
      </HStack>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {error && <FieldStatus type="error" message={error} />}

      {!imageUrl && (
        <HStack gap={3} vAlign="end" wrap="wrap">
          <TextInput
            label="Letter"
            value={initial}
            onChange={(v) => onInitialChange(v.slice(0, 1))}
            width={110}
            size="sm"
          />
          <VStack gap={1.5}>
            <Text type="label" color="secondary">
              Colour
            </Text>
            <HStack gap={1.5} wrap="wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use colour ${c}`}
                  aria-pressed={c === color}
                  onClick={() => onColorChange(c)}
                  className={`h-7 w-7 rounded-lg bg-gradient-to-br ${c} ${
                    c === color
                      ? 'ring-2 ring-slate-400 ring-offset-2 dark:ring-neutral-400 dark:ring-offset-neutral-900'
                      : ''
                  }`}
                />
              ))}
            </HStack>
          </VStack>
        </HStack>
      )}
    </VStack>
  )
}
