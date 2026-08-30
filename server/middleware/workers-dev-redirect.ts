// jaime.stream is the canonical production domain. The default
// *.workers.dev URL stays deployed (wrangler.jsonc `workers_dev: true`)
// only so anything still pointing at it lands on the real site instead
// of a dead link — permanently redirect every workers.dev request to
// the same path on jaime.stream.
const CANONICAL_HOST = 'jaime.stream'

export default defineEventHandler((event) => {
  // Trust only the real Host header — the Worker sits directly on
  // Cloudflare's edge with no reverse proxy, so x-forwarded-host would
  // only ever be a spoof (or a local dev-proxy artifact).
  const host = getRequestHost(event)
  if (!host || !host.endsWith('.workers.dev')) return

  const url = getRequestURL(event)
  return sendRedirect(event, `https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301)
})
