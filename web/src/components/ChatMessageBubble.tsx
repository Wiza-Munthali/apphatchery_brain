import { Sparkles, Search, Brain } from 'lucide-react'
import { Citation } from '@astryxdesign/core/Citation'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Banner } from '@astryxdesign/core/Banner'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Markdown } from '@astryxdesign/core/Markdown'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { getItem } from '../data/mockData'
import { SourceBadge } from './SourceBadge'
import { GatewayResourceBadge } from './GatewayResourceBadge'
import { ItemCard } from '../components/ItemCard'
import type { ChatMessage, GatewayResource, GatewaySearchResult } from '../types'

export const NO_ANSWER_SENTINEL = '__NO_ANSWER__'

function ThinkingTrace({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null
  return (
    <Collapsible
      defaultIsOpen={false}
      trigger={
        <HStack gap={1.5} vAlign="center">
          <Icon icon={Brain} size="sm" color="secondary" />
          <Text type="body" size="sm" color="secondary">
            Thought for {steps.length} step{steps.length > 1 ? 's' : ''}
          </Text>
        </HStack>
      }
    >
      <VStack gap={1.5} className="border-l border-slate-200 pl-3 dark:border-neutral-700">
        {steps.map((step, i) => (
          <Text key={i} type="body" size="xsm" color="secondary">
            {step}
          </Text>
        ))}
      </VStack>
    </Collapsible>
  )
}

function AnswerText({ text, citationIds }: { text: string; citationIds: string[] }) {
  const parts = text.split(/(\[\d+\])/g)
  const citedItems = citationIds.map((id) => getItem(id)).filter(Boolean)

  return (
    <VStack gap={3}>
      <Text type="body" size="sm" as="p">
        {parts.map((part, i) => {
          const m = part.match(/^\[(\d+)\]$/)
          if (m) {
            const idx = Number(m[1]) - 1
            const item = citedItems[idx]
            return (
              <Citation
                key={i}
                variant="number"
                number={Number(m[1])}
                source={{ title: item?.title, url: `#cite-${idx}` }}
              />
            )
          }
          return <span key={i}>{part}</span>
        })}
      </Text>

      {citedItems.length > 0 && (
        <VStack gap={1.5}>
          {citedItems.map((item, i) =>
            item ? (
              <div key={item.id} id={`cite-${i}`} className="scroll-mt-4">
                <ClickableCard label={item.title} href={`/p/${item.projectId}/item/${item.id}`} padding={2}>
                  <HStack gap={3} vAlign="start">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <HStack gap={2} vAlign="center">
                        <SourceBadge source={item.source} />
                        <Text type="body" size="sm" weight="medium" maxLines={1}>
                          {item.title}
                        </Text>
                      </HStack>
                      <Text type="body" size="xsm" color="secondary" maxLines={1}>
                        {item.snippet}
                      </Text>
                    </div>
                  </HStack>
                </ClickableCard>
              </div>
            ) : null,
          )}
        </VStack>
      )}
    </VStack>
  )
}

function GatewaySourceLink({ resource, reason }: { resource: GatewayResource; reason?: string }) {
  const content = (
    <HStack gap={2} vAlign="start">
      <GatewayResourceBadge type={resource.type} />
      <div className="min-w-0 flex-1">
        <Text type="body" size="sm" weight="medium" maxLines={1}>
          {resource.title}
        </Text>
        {reason ? (
          <Text type="body" size="xsm" color="secondary" maxLines={2}>
            {reason}
          </Text>
        ) : (
          <Text type="body" size="xsm" color="disabled" maxLines={1}>
            {resource.path}
          </Text>
        )}
      </div>
    </HStack>
  )

  const className =
    'block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600'

  if (!resource.url) {
    return <div className={className}>{content}</div>
  }
  return (
    <a href={resource.url} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  )
}

function GatewayAnswer({ text, sources }: { text: string; sources: GatewayResource[] }) {
  return (
    <VStack gap={3}>
      <Markdown headingLevelStart={4}>{text}</Markdown>
      {sources.length > 0 && (
        <VStack gap={1.5}>
          <Text type="body" size="xsm" color="secondary" weight="medium">
            Sources
          </Text>
          {sources.map((s, i) => (
            <GatewaySourceLink key={`${s.type}-${s.path}-${i}`} resource={s} />
          ))}
        </VStack>
      )}
    </VStack>
  )
}

function GatewaySearchResults({ results }: { results: GatewaySearchResult[] }) {
  if (results.length === 0) {
    return (
      <Text type="body" size="sm" color="disabled">
        No matches. Try different keywords.
      </Text>
    )
  }
  return (
    <VStack gap={2}>
      {results.map((r, i) => (
        <GatewaySourceLink key={`${r.type}-${r.path}-${i}`} resource={r} reason={r.reason} />
      ))}
    </VStack>
  )
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-bg px-4 py-2.5 text-[13.5px] leading-relaxed text-on-accent">
          {message.text}
        </div>
      </div>
    )
  }

  const searchResults = (message.searchResultIds ?? []).map((id) => getItem(id)).filter(Boolean)

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-bg">
        <Sparkles size={13} className="text-on-accent" />
      </div>
      <div className="min-w-0 max-w-[85%] flex-1">
        <VStack gap={3}>
          <ThinkingTrace steps={message.thinking ?? []} />

          {message.pending ? (
            <HStack gap={2} vAlign="center">
              <Spinner size="sm" />
              <Text type="body" size="sm" color="secondary">
                {message.text}
              </Text>
            </HStack>
          ) : message.error ? (
            <Banner status="error" title="Something went wrong" description={message.error} />
          ) : message.gatewayResults !== undefined ? (
            <VStack gap={2}>
              <HStack gap={1.5} vAlign="center">
                <Search size={12} className="text-slate-500 dark:text-neutral-400" />
                <Text type="body" size="sm" color="secondary">
                  {message.text}
                </Text>
              </HStack>
              <GatewaySearchResults results={message.gatewayResults} />
            </VStack>
          ) : message.gatewaySources !== undefined ? (
            <GatewayAnswer text={message.text} sources={message.gatewaySources} />
          ) : message.text === NO_ANSWER_SENTINEL ? (
            <Banner
              status="warning"
              title="No grounded answer found"
              description="Nothing in the connected sources is clearly related to this question. Try rephrasing, or switch to Search mode to browse loosely related items."
            />
          ) : message.mode === 'search' ? (
            <VStack gap={2}>
              <HStack gap={1.5} vAlign="center">
                <Search size={12} className="text-slate-500 dark:text-neutral-400" />
                <Text type="body" size="sm" color="secondary">
                  {message.text}
                </Text>
              </HStack>
              <VStack gap={2}>
                {searchResults.map((item) => (
                  <ItemCard key={item!.id} item={item!} />
                ))}
                {searchResults.length === 0 && (
                  <Text type="body" size="sm" color="disabled">
                    No matches. Try different keywords.
                  </Text>
                )}
              </VStack>
            </VStack>
          ) : (
            <AnswerText text={message.text} citationIds={message.citationIds ?? []} />
          )}
        </VStack>
      </div>
    </div>
  )
}
