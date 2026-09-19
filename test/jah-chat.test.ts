import { SELF } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { fromBase64, toBase64 } from '../shared/compositionProtocol'
import { findOrCreateUser, setAiAccess } from '../server/auth/users'
import { issueToken } from '../server/auth/tokens'

// add-jah-chat — the full @jah gating pipeline over a real WebSocket
// connection: access, caps, the busy lock, fix/edit declines, and a
// real (JAH_E2E-stubbed) discussion reply with its usage record.
//
// NOT covered here: the kill switch being off. `.dev.vars`' JAH_E2E=1
// is loaded into every pool-workers test in this project (there is no
// per-test binding override), so `JAH_ENABLED` is always effectively
// "on" in this environment — see `isJahEnabled`'s own unit tests
// (test/jah-route.test.ts) for that one-line branch's only coverage.

const db = env.PATTERNS_DB
let roomCounter = 0
function freshRoomId(): string {
  roomCounter += 1
  return `jah-test-${roomCounter}-${Date.now()}`
}

let openSockets: WebSocket[] = []

function messageQueue(ws: WebSocket): () => Promise<any> {
  const buffered: any[] = []
  const waiters: Array<(m: any) => void> = []
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data as string)
    const w = waiters.shift()
    if (w) w(m)
    else buffered.push(m)
  })
  return () => {
    const m = buffered.shift()
    return m !== undefined ? Promise.resolve(m) : new Promise(resolve => waiters.push(resolve))
  }
}

async function connect(roomId: string, name: string, cookie?: string): Promise<{ ws: WebSocket, next: () => Promise<any> }> {
  const res = await SELF.fetch(
    `http://example.com/composition?id=${encodeURIComponent(roomId)}&name=${encodeURIComponent(name)}`,
    { headers: { Upgrade: 'websocket', ...(cookie ? { cookie } : {}) } },
  )
  const ws = res.webSocket
  if (!ws) throw new Error('expected a WebSocket')
  const next = messageQueue(ws)
  ws.accept()
  openSockets.push(ws)
  return { ws, next }
}

async function join(roomId: string, name: string, cookie?: string): Promise<{ ws: WebSocket, next: () => Promise<any> }> {
  const { ws, next } = await connect(roomId, name, cookie)
  ws.send(JSON.stringify({ t: 'join', role: 'editor', name, color: '#f00', sv: toBase64(Y.encodeStateVector(new Y.Doc())) }))
  const welcome = await next()
  expect(welcome.t).toBe('welcome')
  return { ws, next }
}

/** Signs a fresh account in and returns its `jaime_session` cookie + id. */
async function signIn(email: string): Promise<{ cookie: string, userId: string }> {
  const user = await findOrCreateUser(db, email)
  const raw = await issueToken(db, user.id)
  const res = await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}`, { redirect: 'manual' })
  expect(res.status).toBe(302)
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!
  return { cookie, userId: user.id }
}

async function usageCount(userId: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ?').bind(userId).first<{ n: number }>()
  return row?.n ?? 0
}

async function fillCap(userId: string, count: number) {
  const now = new Date().toISOString()
  for (let i = 0; i < count; i++) {
    await db
      .prepare(
        `INSERT INTO ai_usage (id, user_id, github_login, room_id, model, prompt_tokens, completion_tokens, cost_estimate_usd, created_at)
         VALUES (?, ?, NULL, NULL, 'test-model', 1, 1, 0, ?)`,
      )
      .bind(`${userId}-fill-${i}`, userId, now)
      .run()
  }
}

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM ai_usage'),
    db.prepare('DELETE FROM sessions'),
    db.prepare('DELETE FROM auth_tokens'),
    db.prepare('DELETE FROM users'),
  ])
  openSockets = []
})

describe('@jah', () => {
  it('stays silent for an anonymous sender', async () => {
    const roomId = freshRoomId()
    const { ws, next } = await join(roomId, 'Anon')
    ws.send(JSON.stringify({ t: 'chat', text: '@jah are you there?' }))
    await next() // the human's own message, echoed back as usual

    const raced = await Promise.race([
      next().then(m => ({ arrived: true, m })),
      new Promise(resolve => setTimeout(() => resolve({ arrived: false }), 800)),
    ])
    expect((raced as { arrived: boolean }).arrived).toBe(false)
  })

  it('tells a signed-in, non-allowlisted user it\'s invite-only, and writes no usage row', async () => {
    const roomId = freshRoomId()
    const { cookie, userId } = await signIn('no-access@example.com')
    const { ws, next } = await join(roomId, 'Nobody', cookie)
    ws.send(JSON.stringify({ t: 'chat', text: '@jah hello?' }))
    await next() // echo
    const reply = await next()
    expect(reply).toMatchObject({ t: 'chat', message: { name: '@jah' } })
    expect(reply.message.text).toMatch(/invite-only/i)
    expect(await usageCount(userId)).toBe(0)
  })

  it('declines once the per-user daily cap is reached, and writes no usage row', async () => {
    const roomId = freshRoomId()
    const { cookie, userId } = await signIn('capped@example.com')
    await setAiAccess(db, userId, true)
    await fillCap(userId, 25)

    const { ws, next } = await join(roomId, 'Capped', cookie)
    ws.send(JSON.stringify({ t: 'chat', text: '@jah hello?' }))
    await next() // echo
    const reply = await next()
    expect(reply.message.text).toMatch(/limit/i)
    expect(await usageCount(userId)).toBe(25)
  })

  it('declines fix and edit as not-yet-supported, without recording usage', async () => {
    const roomId = freshRoomId()
    const { cookie, userId } = await signIn('access@example.com')
    await setAiAccess(db, userId, true)
    const { ws, next } = await join(roomId, 'Ally', cookie)

    ws.send(JSON.stringify({ t: 'chat', text: '@jah fix my kick' }))
    await next() // echo
    const fixReply = await next()
    expect(fixReply.message.text).toMatch(/fixing.*isn't something i can do yet/i)

    ws.send(JSON.stringify({ t: 'chat', text: '@jah edit the bassline' }))
    await next() // echo
    const editReply = await next()
    expect(editReply.message.text).toMatch(/editing.*isn't something i can do yet/i)

    expect(await usageCount(userId)).toBe(0)
  })

  it('answers a discussion request, attributed to @jah with its avatar, and records one usage row', async () => {
    const roomId = freshRoomId()
    const { cookie, userId } = await signIn('discuss@example.com')
    await setAiAccess(db, userId, true)
    const { ws, next } = await join(roomId, 'Ally', cookie)

    ws.send(JSON.stringify({ t: 'chat', text: '@jah what does .fast do?' }))
    await next() // echo
    const typingOn = await next()
    expect(typingOn).toEqual({ t: 'jah_typing', typing: true })
    const reply = await next()
    expect(reply).toMatchObject({ t: 'chat', message: { name: '@jah', avatarUrl: '/jah-avatar.svg' } })
    expect(reply.message.text).toMatch(/canned/i) // JAH_E2E's stub
    const typingOff = await next()
    expect(typingOff).toEqual({ t: 'jah_typing', typing: false })

    expect(await usageCount(userId)).toBe(1)
  })

  it('declines a second request in the same room while one is in flight, without interleaving', async () => {
    const roomId = freshRoomId()
    const { cookie, userId } = await signIn('busy@example.com')
    await setAiAccess(db, userId, true)
    const { ws, next } = await join(roomId, 'Ally', cookie)

    ws.send(JSON.stringify({ t: 'chat', text: '@jah first question' }))
    await next() // echo of the first message
    expect(await next()).toEqual({ t: 'jah_typing', typing: true })

    // Now genuinely mid-flight — a second request lands before the first resolves.
    ws.send(JSON.stringify({ t: 'chat', text: '@jah second question' }))
    const secondEcho = await next()
    expect(secondEcho.message.text).toBe('@jah second question')
    const busyReply = await next()
    expect(busyReply.message.text).toMatch(/still working on the last one/i)

    const firstReply = await next()
    expect(firstReply).toMatchObject({ t: 'chat', message: { name: '@jah' } })
    expect(firstReply.message.text).toMatch(/canned/i)
    expect(await next()).toEqual({ t: 'jah_typing', typing: false })

    // Only the first request ever reached the model.
    expect(await usageCount(userId)).toBe(1)
  })

  it('does not let one room\'s in-flight request block a different room', async () => {
    const { cookie, userId } = await signIn('tworooms@example.com')
    await setAiAccess(db, userId, true)

    const roomA = await join(freshRoomId(), 'Ally', cookie)
    roomA.ws.send(JSON.stringify({ t: 'chat', text: '@jah question in room A' }))
    await roomA.next() // echo
    expect(await roomA.next()).toEqual({ t: 'jah_typing', typing: true })

    const roomB = await join(freshRoomId(), 'Ally', cookie)
    roomB.ws.send(JSON.stringify({ t: 'chat', text: '@jah question in room B' }))
    await roomB.next() // echo
    const roomBTypingOrReply = await roomB.next()
    // Room B is handled independently — it also gets a real reply
    // (typing signal first), never a "busy" decline from room A's lock.
    expect(roomBTypingOrReply).toEqual({ t: 'jah_typing', typing: true })
    const roomBReply = await roomB.next()
    expect(roomBReply.message.text).toMatch(/canned/i)
  })
})
