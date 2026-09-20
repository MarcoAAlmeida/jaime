<script setup lang="ts">
import type { PatternListResult } from '#shared/catalog'
import { nanoid } from 'nanoid'

definePageMeta({ layout: 'landing' })

const TAGLINE = 'Your dev hangout — live-code, chat, and let @jah keep watch.'

useSeoMeta({
  title: 'jaime — your dev hangout',
  description:
    'jaime is a browser-based hangout for developers: chat with each other and with @jah, an AI lion in the room, and live-code Strudel patterns together.'
})

// game-icons.net icons on this page, with the author of each — one list
// feeds both the icon names and the credit line at the foot of the page,
// so an icon cannot be used without being credited. Each name must also
// be in GAME_ICONS_IN_USE (nuxt.config.ts) and content/credits/game-icons.md.
const ICON_AUTHORS = {
  'lion': 'Lorc',
  'chat-bubble': 'Delapouite',
  'musical-notes': 'Delapouite',
  'rune-stone': 'Lorc',
  'scroll-unfurled': 'Lorc',
  'laptop': 'Delapouite',
  'campfire': 'Lorc',
  'sound-waves': 'Skoll',
  'console-controller': 'Skoll'
} as const
type GameIcon = keyof typeof ICON_AUTHORS
const gi = (name: GameIcon) => `game-icons:${name}`
const iconCredits = Object.entries(ICON_AUTHORS).map(([name, author]) => ({ name, author }))

// Returning-visitor fast path: anyone who has already set a display
// name (a room's per-session identity) has used a room before — surface
// a direct link straight to the Composition Room so they skip the pitch.
const { displayName } = useDisplayName()

// A fresh room, straight in — the Chat tab is the room's default tab.
function startRoom() {
  return navigateTo(`/app/composition/${nanoid(10)}`)
}

// A fresh room seeded with a starter pattern (the room reads ?load=).
function openStarter(patternId: string) {
  return navigateTo(`/app/composition/${nanoid(10)}?load=${encodeURIComponent(patternId)}`)
}

// The starter patterns are the favorited catalog rows. A failed fetch
// leaves `starters` empty, which hides the section — a secondary section
// never shows an error.
const { data: starterData } = await useFetch<PatternListResult>('/api/patterns', {
  query: { favorite: 'true' },
  key: 'home-starters',
  default: () => ({ patterns: [], page: 1, pageSize: 0, total: 0 }),
})
const starters = computed(() => starterData.value?.patterns ?? [])

// add-articles — a handful of teasers here, the full list at /articles.
const ARTICLE_TEASER_COUNT = 3
const { data: articles } = await useAsyncData('home-articles', () =>
  queryCollection('articles').order('publishedAt', 'DESC').limit(ARTICLE_TEASER_COUNT).all(),
)

const features = [
  {
    icon: gi('chat-bubble'),
    title: 'Chat, with @jah in the room',
    description: 'Every room opens on its chat. Ask @jah about Strudel, patterns, or whatever you are stuck on — right where the conversation is.'
  },
  {
    icon: gi('musical-notes'),
    title: 'Live-code together',
    description: 'One shared Strudel document with live cursors and playback that stays in sync for everyone in the room.'
  },
  {
    icon: gi('rune-stone'),
    title: 'An ASCII art panel',
    description: 'Art that swaps on the beat, next to the code. Decoration for the room, in the room.'
  },
  {
    icon: gi('scroll-unfurled'),
    title: 'A pattern library',
    description: 'Curated Strudel patterns to read, play, and send straight into a room.',
    to: '/app/patterns'
  }
]
</script>

<template>
  <UPageHero
    :title="TAGLINE"
    description="jaime is a browser-based place for developers to hang out and chat — with @jah, an AI lion in the room, and live Strudel coding together. Nothing to install."
    :links="[
      { label: 'Start a room', icon: gi('campfire'), size: 'lg', onClick: startRoom },
      { label: 'Pattern library', to: '/app/patterns', icon: 'i-lucide-library', color: 'neutral', variant: 'subtle', size: 'lg' },
      { label: 'Read the docs', to: '/docs', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right', size: 'lg' }
    ]"
    :ui="{ links: 'gap-3' }"
  >
    <ClientOnly>
      <UAlert
        v-if="displayName"
        class="mx-auto mt-4 max-w-md"
        color="neutral"
        variant="subtle"
        icon="i-lucide-arrow-right"
        :title="`Welcome back, ${displayName}`"
        :actions="[{ label: 'Go to the Composition Room', to: '/app/composition', color: 'neutral' }]"
      />
    </ClientOnly>
  </UPageHero>

  <UPageSection
    id="jah"
    data-testid="jah-section"
    headline="Meet @jah"
    title="A lion in the room"
    :icon="gi('lion')"
    description="@jah is the AI in every Composition Room's chat. Mention it at the start of a message and it answers — Strudel questions, pattern ideas, explanations."
  >
    <div class="mx-auto flex max-w-3xl flex-col items-center gap-8 md:flex-row md:items-start">
      <img
        src="/jah-avatar.svg"
        alt="@jah, a red lion"
        title="Lion icon by Lorc (game-icons.net, CC BY 3.0), recoloured"
        class="size-32 shrink-0 md:size-40"
        data-testid="jah-lion"
      >
      <div class="flex w-full flex-col gap-4">
        <p class="text-muted text-sm font-medium uppercase tracking-wide">
          Example
        </p>
        <div class="flex flex-col gap-2 text-sm">
          <div class="bg-elevated self-start rounded-lg px-3 py-2">
            <code>@jah how does .fast work?</code>
          </div>
          <div class="border-primary/25 bg-primary/5 self-end rounded-lg border px-3 py-2">
            <strong>@jah</strong> — <code>.fast(n)</code> speeds a pattern up by a factor of n, so
            <code>s("bd sn").fast(2)</code> plays it twice per cycle.
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UBadge color="neutral" variant="subtle" icon="i-lucide-lock">
            Invite-only for now
          </UBadge>
          <UButton
            label="Start a room"
            color="neutral"
            variant="outline"
            :icon="gi('chat-bubble')"
            data-testid="jah-start-room"
            @click="startRoom"
          />
        </div>
      </div>
    </div>
  </UPageSection>

  <UPageSection
    id="features"
    headline="Features"
    title="What's in a room"
    :icon="gi('sound-waves')"
    description="A room is a chat first, with the rest a tab away."
  >
    <UPageGrid class="lg:grid-cols-4">
      <UPageCard
        v-for="feature in features"
        :key="feature.title"
        :title="feature.title"
        :description="feature.description"
        :icon="feature.icon"
        :to="feature.to"
        :ui="{ container: 'lg:flex-col' }"
      />
    </UPageGrid>
  </UPageSection>

  <UPageSection
    v-if="starters.length"
    id="starters"
    data-testid="starters-section"
    headline="Starter patterns"
    title="Start from a pattern"
    :icon="gi('laptop')"
    description="Open any of these in a fresh Composition Room, with the pattern already in the shared editor."
  >
    <UPageGrid>
      <UPageCard
        v-for="pattern in starters"
        :key="pattern.id"
        :title="pattern.title"
        :description="pattern.source.author ? `by ${pattern.source.author}` : undefined"
        :ui="{ container: 'lg:flex-col' }"
        data-testid="starter-card"
      >
        <div v-if="pattern.tags.length" class="flex flex-wrap gap-1">
          <UBadge
            v-for="tag in pattern.tags"
            :key="tag"
            color="neutral"
            variant="subtle"
          >
            {{ tag }}
          </UBadge>
        </div>
        <template #footer>
          <UButton
            label="Open in Composition Room"
            color="neutral"
            variant="subtle"
            trailing-icon="i-lucide-arrow-right"
            data-testid="starter-open"
            @click="openStarter(pattern.id)"
          />
        </template>
      </UPageCard>
    </UPageGrid>
  </UPageSection>

  <div class="mx-auto max-w-xl px-4 py-4">
    <UAlert
      color="neutral"
      variant="subtle"
      :icon="gi('console-controller')"
      title="Games — coming soon"
      data-testid="games-notice"
    />
  </div>

  <UPageSection
    v-if="articles?.length"
    id="articles"
    headline="Articles"
    title="Ideas behind jaime"
    description="Long-form pieces on the research and decisions behind jaime — the why, not just the how."
  >
    <UPageGrid>
      <UPageCard
        v-for="article in articles"
        :key="article.path"
        :title="article.title"
        :description="article.description"
        :to="article.path"
        :ui="{ container: 'lg:flex-col' }"
        data-testid="article-card"
      >
        <template #header>
          <img
            :src="article.coverImage"
            :alt="article.title"
            class="aspect-video w-full rounded-md object-cover"
          >
        </template>
        <template v-if="article.authRequired" #footer>
          <UBadge color="neutral" variant="subtle" icon="i-lucide-lock">
            Sign in to read
          </UBadge>
        </template>
      </UPageCard>
    </UPageGrid>

    <div class="mt-6 text-center">
      <UButton
        label="All articles"
        to="/articles"
        color="neutral"
        variant="subtle"
        trailing-icon="i-lucide-arrow-right"
      />
    </div>
  </UPageSection>

  <UPageCTA
    title="Stay in the loop"
    description="Join the community list. It's the only thing we'll email you about."
    :links="[
      { label: 'Join the community', to: '/signup', icon: 'i-lucide-mail', color: 'neutral', variant: 'solid' },
      { label: 'Start a room', color: 'neutral', variant: 'subtle', onClick: startRoom }
    ]"
  />

  <p
    class="text-muted mx-auto max-w-3xl px-4 pb-8 text-center text-xs"
    data-testid="icon-credits"
  >
    Icons from
    <ULink to="https://game-icons.net" target="_blank" class="underline">
      game-icons.net
    </ULink>
    (CC BY 3.0):
    <template v-for="(credit, i) in iconCredits" :key="credit.name">
      {{ credit.name }} by {{ credit.author }}<template v-if="i < iconCredits.length - 1">, </template>
    </template>.
  </p>
</template>
