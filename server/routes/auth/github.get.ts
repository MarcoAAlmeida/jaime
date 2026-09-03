import type { H3Event } from 'h3'
import { createSession } from '../../auth/sessions'
import { findOrCreateUserFromGitHub } from '../../auth/users'

// GET /auth/github — starts the GitHub OAuth flow and, on the same
// route, handles the callback (nuxt-auth-utils does both in one
// handler; GitHub's registered callback URL is this route itself).
// A successful sign-in produces a *confirmed* jaime account and a
// normal jaime session — nuxt-auth-utils' own session is not used.

function env(event: H3Event) {
  return (event.context.cloudflare as { env?: Env & { GITHUB_CLIENT_ID?: string, GITHUB_CLIENT_SECRET?: string, OAUTH_E2E?: string } } | undefined)?.env
}

function safeNext(v: unknown): string {
  return typeof v === 'string' && v.startsWith('/') ? v : '/account'
}

async function landSignedIn(event: H3Event, profile: Parameters<typeof findOrCreateUserFromGitHub>[1], next: string) {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)
  const user = await findOrCreateUserFromGitHub(db, profile)
  const sessionId = await createSession(db, user.id)
  setSessionCookie(event, sessionId)
  return sendRedirect(event, next, 302)
}

const oauthHandler = defineOAuthGitHubEventHandler({
  config: { emailRequired: true, scope: ['user:email'] },
  async onSuccess(event, { user: gh }) {
    return landSignedIn(event, {
      githubId: Number(gh.id),
      login: String(gh.login),
      name: gh.name ?? null,
      email: String(gh.email),
      avatarUrl: gh.avatar_url ?? null,
    }, safeNext(getQuery(event).next))
  },
  onError(event) {
    return sendRedirect(event, '/signup?error=oauth', 302)
  },
})

export default defineEventHandler(async (event) => {
  const e = env(event)
  const query = getQuery(event)

  // Populate clientId/clientSecret from the CF env (not the NUXT_OAUTH_*
  // convention, which doesn't reach the Worker runtime the same way).
  const rc = useRuntimeConfig(event)
  rc.oauth = rc.oauth || {}
  rc.oauth.github = {
    ...(rc.oauth.github || {}),
    clientId: e?.GITHUB_CLIENT_ID ?? '',
    clientSecret: e?.GITHUB_CLIENT_SECRET ?? '',
  }

  // E2E: skip GitHub entirely — a canned (parameterisable) profile.
  if (e?.OAUTH_E2E) {
    const next = safeNext(query.next)
    if (!query.e2e) {
      return sendRedirect(event, `/auth/github?e2e=1&next=${encodeURIComponent(next)}`, 302)
    }
    return landSignedIn(event, {
      githubId: Number(query.e2e_id ?? 424242),
      login: String(query.e2e_login ?? 'e2e-octocat'),
      name: query.e2e_name ? String(query.e2e_name) : 'E2E Octocat',
      email: String(query.e2e_email ?? 'e2e-octocat@example.com'),
      avatarUrl: String(query.e2e_avatar ?? 'https://avatars.githubusercontent.com/u/424242?v=4'),
    }, next)
  }

  return oauthHandler(event)
})
