import { Clock, ExternalLink, TriangleAlert } from 'lucide-react'
import { Card } from '@astryxdesign/core/Card'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import type { ProviderSpec, SetupStep } from '../data/providers'

/**
 * What an admin has to do *in the provider* before a connection can work.
 *
 * Presented as a numbered checklist rather than prose because these are
 * sequential actions taken in another tab, and people follow them with the
 * dialog open beside them. Three deliberate choices:
 *
 *  - Links go straight to the exact settings page, opening in a new tab, so
 *    nobody loses a half-filled form hunting through provider menus.
 *  - Warnings sit inside the step they apply to, not in a footnote, because
 *    each one is a silent failure — skip the Zulip subscription step and the
 *    credential still validates, it just returns nothing.
 *  - Sub-points are indented under their step so a step with five conditions
 *    (Notion sharing) doesn't read as five separate steps.
 */
function Step({ index, step }: { index: number; step: SetupStep }) {
  return (
    <HStack gap={3} vAlign="start">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700 dark:bg-neutral-700 dark:text-neutral-200">
        {index}
      </div>
      <VStack gap={1}>
        <Text type="body" size="sm" weight="semibold">
          {step.title}
        </Text>

        {step.detail && (
          <Text type="body" size="xsm" color="secondary">
            {step.detail}
          </Text>
        )}

        {step.bullets && step.bullets.length > 0 && (
          <ul className="ml-4 list-disc space-y-1 pt-0.5 marker:text-slate-400 dark:marker:text-neutral-600">
            {step.bullets.map((b) => (
              <li key={b}>
                <Text type="body" size="xsm" color="secondary">
                  {b}
                </Text>
              </li>
            ))}
          </ul>
        )}

        {step.warning && (
          <div className="mt-1 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-900/60 dark:bg-amber-950/40">
            <div className="mt-0.5 shrink-0">
              <Icon icon={TriangleAlert} size="xsm" color="warning" />
            </div>
            <Text type="body" size="xsm" color="secondary">
              {step.warning}
            </Text>
          </div>
        )}

        {step.link && (
          <a
            href={step.link.href}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1 font-medium text-brand-navy underline underline-offset-2 hover:text-brand-navy-dark dark:text-brand-orange dark:hover:text-brand-orange-dark"
          >
            {/* Sized through Astryx's Text rather than a utility class: this
                app remaps the Tailwind text scale, so `text-sm` here would not
                match the `size="xsm"` copy it sits under. */}
            <Text type="body" size="xsm" color="inherit">
              {step.link.label}
            </Text>
            <ExternalLink size={11} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </VStack>
    </HStack>
  )
}

export function SetupGuide({
  provider,
  title,
}: {
  provider: ProviderSpec
  /** Overrides the default heading, e.g. on the credential step. */
  title?: string
}) {
  if (provider.setupSteps.length === 0) return null

  return (
    <Card padding={3} variant="muted">
      <VStack gap={3}>
        <HStack gap={2} vAlign="center">
          <Text type="label" weight="semibold">
            {title ?? `Set up ${provider.name}`}
          </Text>
          {provider.setupMinutes && (
            <HStack gap={1} vAlign="center">
              <Icon icon={Clock} size="xsm" color="secondary" />
              <Text type="body" size="xsm" color="secondary">
                ~{provider.setupMinutes} min
              </Text>
            </HStack>
          )}
        </HStack>

        <VStack gap={3}>
          {provider.setupSteps.map((step, i) => (
            <Step key={step.title} index={i + 1} step={step} />
          ))}
        </VStack>
      </VStack>
    </Card>
  )
}
