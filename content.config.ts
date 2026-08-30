import { defineContentConfig, defineCollection, z } from '@nuxt/content'

// The docs shell (Phase 1) — one collection, one file per technology
// section under content/docs/. Real Strudel / Hydra / TidalCycles
// content is Phase 5; for now these pages are placeholders whose job is
// to prove the nav-tree and page conventions before anyone authors into
// them.
export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: 'docs/**/*.md',
      schema: z.object({
        // Marks a section whose real content still has to be written —
        // the page renders a "coming in a later phase" notice.
        placeholder: z.boolean().optional()
      })
    })
  }
})
