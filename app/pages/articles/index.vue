<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const { data: articles } = await useAsyncData('articles-index', () =>
  queryCollection('articles').order('publishedAt', 'DESC').all(),
)

useSeoMeta({
  title: 'Articles — jaime',
  description: 'Long-form pieces on the ideas and research behind jaime’s tools.',
})
</script>

<template>
  <UPage>
    <UPageHeader
      title="Articles"
      description="Long-form pieces on the ideas and research behind jaime's tools — the why, not just the how."
    />

    <UPageBody>
      <UPageGrid>
        <UPageCard
          v-for="article in articles"
          :key="article.path"
          :title="article.title"
          :description="article.description"
          :to="article.path"
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
    </UPageBody>
  </UPage>
</template>
