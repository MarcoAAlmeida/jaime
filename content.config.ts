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
        placeholder: z.boolean().optional(),
        // Content served only to signed-in users; the nav entry stays
        // listed with a lock, signed-out visitors get an explainer.
        authRequired: z.boolean().optional()
      })
    }),
    // add-articles — Diátaxis Explanation-type content: long-form,
    // screenshot-rich pieces, flat (no nav tree, unlike docs/). See
    // openspec/changes/add-articles/design.md for why this is a
    // separate collection rather than a flag on `docs`.
    articles: defineCollection({
      type: 'page',
      source: 'articles/*.md',
      schema: z.object({
        // Same contract as docs' authRequired: the article stays
        // listed (locked) for a signed-out visitor; its body is not
        // served to them.
        authRequired: z.boolean().optional(),
        // Every teaser (home section + index) shows this — required,
        // not optional, so a card is never blank.
        coverImage: z.string(),
        // Loose grouping for a future browse-by-tag pass; no filtering
        // UI reads this yet.
        tags: z.array(z.string()).optional(),
        // Drives sort order (newest first) — articles have no nav-tree
        // filename numbering to order them instead.
        publishedAt: z.string()
      })
    })
  }
})
