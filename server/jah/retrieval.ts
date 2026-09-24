// Resolves a `@jah` mention to relevant knowledge before the model is
// called (add-jah-knowledge-retrieval; capability `jah-grounding`): exact
// lookup for any function explicitly referenced, always also a semantic
// search over the mention's own text, merged and bounded. See design.md
// decisions 2-3.

import type { KnowledgeChunk } from '../catalog/knowledge'
import { findChunkByName, searchChunks } from '../catalog/knowledge'

export interface RetrievedSource {
  id: string
  title: string
  sourceUrl: string | null
}

export interface RetrievalResult {
  contextBlocks: string[]
  sources: RetrievedSource[]
}

// Small, deliberately: the corpus is ~1,400 chunks today and the
// developer intends to grow it considerably, so prompt size must stay
// bounded independent of corpus size (jah-grounding spec: "The number of
// context items is bounded"). Named constants, not inlined, so a later
// eval run can be re-tried against different values without touching
// the logic.
const SEMANTIC_TOP_K = 3
const MAX_CONTEXT_CHUNKS = 5

// A name written the way a person actually writes a function reference
// in chat — backtick-quoted (`` `lpf` ``) or dot-prefixed (`.lpf`) —
// not general keyword extraction. Deliberately narrow: a broader
// heuristic risks false hits on ordinary English words that happen to
// match real short function names (`n`, `s`).
const BACKTICK_NAME = /`([a-zA-Z][\w.]*)`/g
const DOT_PREFIXED_NAME = /\.([a-zA-Z]\w*)\b/g

/** Every distinct name in `text` that looks like an explicit function reference, lowercased. */
export function extractCandidateNames(text: string): string[] {
  const names = new Set<string>()
  for (const m of text.matchAll(BACKTICK_NAME)) names.add(m[1]!.toLowerCase())
  for (const m of text.matchAll(DOT_PREFIXED_NAME)) names.add(m[1]!.toLowerCase())
  return [...names]
}

/** One reference-material block for a chunk — its title/category/text, and a function's params/examples. */
export function chunkToContextBlock(chunk: KnowledgeChunk): string {
  const lines = [`${chunk.title} (${chunk.category})`, chunk.text]
  if (chunk.kind === 'function') {
    if (chunk.params.length > 0) {
      lines.push(`Parameters: ${chunk.params.map(p => `${p.name}${p.types.length > 0 ? ` (${p.types.join('|')})` : ''}${p.description ? ` — ${p.description}` : ''}`).join('; ')}`)
    }
    if (chunk.examples.length > 0) {
      lines.push(`Examples:\n${chunk.examples.map(e => `\`\`\`strudel\n${e}\n\`\`\``).join('\n')}`)
    }
  }
  return lines.join('\n\n')
}

/** Injectable so retrieveContext's merge/cap logic is testable with fakes, and 2.4's test can mix a real findChunkByName with a fake searchChunks. */
export interface RetrievalDeps {
  findChunkByName: (name: string) => Promise<KnowledgeChunk | null>
  searchChunks: (query: string, topK: number) => Promise<KnowledgeChunk[]>
}

/**
 * Resolves `mentionText` to context blocks and their sources: exact
 * lookup for every explicitly-referenced candidate name, always also a
 * semantic search over the raw text, exact-first, deduplicated by chunk
 * id, capped at `MAX_CONTEXT_CHUNKS`. Nothing found returns `{
 * contextBlocks: [], sources: [] }` — `buildSystemPrompt([])` then
 * produces today's exact prompt, unchanged.
 */
export async function retrieveContext(deps: RetrievalDeps, mentionText: string): Promise<RetrievalResult> {
  const candidates = extractCandidateNames(mentionText)
  const exactHits: KnowledgeChunk[] = []
  for (const name of candidates) {
    // Sequential on purpose: typically 0-2 candidates, and this keeps exact-hit ordering simple.
    const chunk = await deps.findChunkByName(name)
    if (chunk) exactHits.push(chunk)
  }

  const semanticHits = await deps.searchChunks(mentionText, SEMANTIC_TOP_K)

  const seen = new Set<string>()
  const merged: KnowledgeChunk[] = []
  for (const chunk of [...exactHits, ...semanticHits]) {
    if (seen.has(chunk.id)) continue
    seen.add(chunk.id)
    merged.push(chunk)
    if (merged.length >= MAX_CONTEXT_CHUNKS) break
  }

  return {
    contextBlocks: merged.map(chunkToContextBlock),
    sources: merged.map(c => ({ id: c.id, title: c.title, sourceUrl: c.sourceUrl })),
  }
}

/** The real bindings, wired for the real call site (server/routes/composition.ts). */
export function realRetrievalDeps(env: Env): RetrievalDeps {
  return {
    findChunkByName: name => findChunkByName(env.PATTERNS_DB, name),
    searchChunks: (query, topK) => searchChunks(env.AI, env.VECTORIZE, env.PATTERNS_DB, query, topK),
  }
}
