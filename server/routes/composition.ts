import type { ModelMessage } from 'ai'
import type { Peer } from 'crossws'
import type {
  ChatMessage,
  CompositionClientMessage,
  CompositionPresenceEntry,
  CompositionServerMessage,
  Role,
} from '#shared/compositionProtocol'
import { defineWebSocketHandler } from 'h3'
import * as Y from 'yjs'
import { fromBase64, toBase64 } from '#shared/compositionProtocol'
import { nextCycleBoundary } from '#shared/transportMath'
import { hasAiAccess, parseAllowlist } from '../auth/aiAccess'
import { recordUsage } from '../auth/aiUsage'
import { getSessionUser } from '../auth/sessions'
import { underCaps } from '../jah/caps'
import { generateJahReply } from '../jah/reply'
import { realRetrievalDeps, retrieveContext } from '../jah/retrieval'
import { classifyMention, isJahEnabled, jahAvailability } from '../jah/route'
import { getDurableEnv } from '../utils/durableStorage'

const DEFAULT_BPM = 120
const SNAPSHOT_DEBOUNCE_MS = 2000
const EVICT_AFTER_MS = 60_000
const CHAT_KEEP = 200
// The Y.Text field name the client editor binds to.
export const DOC_TEXT = 'strudel'

// `@jah` (add-jah-chat) — sender identity for its chat messages, daily
// spend caps (proposal.md), and the fixed decline replies for every
// gate a request can fail. Kill-switch-off and anonymous-sender are
// NOT here: both mean total silence, no reply at all (see jah-chat
// spec's "A Kill Switch Can Disable @jah Entirely" and "@jah Requires
// A Signed-In, Access-Granted Account").
const JAH_NAME = '@jah'
const JAH_AVATAR_URL = '/jah-avatar.svg'
const JAH_CAP_LIMITS = { perUser: 25, global: 150 }
const JAH_REPLY_NO_ACCESS = 'Sorry, I\'m invite-only right now — ask the room operator for access.'
const JAH_REPLY_OVER_CAP = 'I\'ve hit my daily reply limit — try again after it resets (UTC midnight).'
const JAH_REPLY_BUSY = 'Still working on the last one in this room, one sec.'
// Posted once as a room's chat starts (design decision 10) — free,
// static text, shown regardless of sign-in/access/kill-switch state,
// so it never calls the model or touches ai_usage.
const JAH_WELCOME_TEXT = 'Hi, I\'m @jah! Mention me — "@jah " followed by a question — '
  + 'and I\'ll join the discussion. Strudel questions are my specialty.'

interface CompositionRoom {
  ydoc: Y.Doc
  bpm: number
  cycleStartTimestamp: number
  playing: boolean
  evalAtCycle: number | null
  // clientId -> presence entry. Never persisted (rebuilt from live
  // peers). awarenessId is the peer's Yjs awareness id, used to tell
  // the others to drop its cursor on disconnect; avatarUrl is
  // server-resolved from the connection's session. userId/aiAccess/
  // githubLogin are resolved once at join (add-jah-chat design
  // decision 1) — the chat handler reads them to decide whether the
  // sender could even get an `@jah` reply, without re-querying D1 per
  // message.
  presence: Map<string, {
    name: string
    role: Role
    awarenessId?: number
    avatarUrl?: string
    userId?: string
    aiAccess?: boolean
    githubLogin?: string
  }>
  chat: ChatMessage[]
  snapshotTimer: ReturnType<typeof setTimeout> | null
  evictTimer: ReturnType<typeof setTimeout> | null
  // Whether a real `@jah` model call is currently in flight for this
  // room (add-jah-chat design decision 4) — in-memory only, reset on
  // room reload. A second addressed message while true is declined,
  // never queued.
  jahBusy: boolean
}

const rooms = new Map<string, CompositionRoom>()
const loading = new Map<string, Promise<CompositionRoom>>()

function storageKey(roomId: string): string {
  return `composition:${roomId}`
}

function topic(roomId: string): string {
  return `composition:${roomId}`
}

function createRoom(): CompositionRoom {
  return {
    ydoc: new Y.Doc(),
    bpm: DEFAULT_BPM,
    cycleStartTimestamp: Date.now(),
    playing: false,
    evalAtCycle: null,
    presence: new Map(),
    chat: [],
    snapshotTimer: null,
    evictTimer: null,
    jahBusy: false,
  }
}

async function loadRoom(roomId: string): Promise<CompositionRoom> {
  const room = createRoom()
  const stored = await getDurableStorage().get<string>(storageKey(roomId))
  if (stored) {
    try {
      Y.applyUpdate(room.ydoc, fromBase64(stored))
    }
    catch {
      // Corrupt snapshot — start fresh rather than fail the room.
    }
  }
  return room
}

async function getRoom(roomId: string): Promise<CompositionRoom> {
  const cached = rooms.get(roomId)
  if (cached) {
    if (cached.evictTimer) {
      clearTimeout(cached.evictTimer)
      cached.evictTimer = null
    }
    return cached
  }
  let pending = loading.get(roomId)
  if (!pending) {
    pending = loadRoom(roomId).then((room) => {
      rooms.set(roomId, room)
      loading.delete(roomId)
      return room
    })
    loading.set(roomId, pending)
  }
  return pending
}

function scheduleSnapshot(roomId: string, room: CompositionRoom) {
  if (room.snapshotTimer) clearTimeout(room.snapshotTimer)
  room.snapshotTimer = setTimeout(() => {
    room.snapshotTimer = null
    const update = toBase64(Y.encodeStateAsUpdate(room.ydoc))
    void getDurableStorage().put(storageKey(roomId), update)
  }, SNAPSHOT_DEBOUNCE_MS)
}

function scheduleEviction(roomId: string, room: CompositionRoom) {
  if (room.presence.size > 0) return
  if (room.evictTimer) clearTimeout(room.evictTimer)
  room.evictTimer = setTimeout(() => {
    if (rooms.get(roomId) === room && room.presence.size === 0) {
      // Snapshot is already written (debounced on the last change);
      // drop the in-memory doc so idle rooms don't accumulate.
      rooms.delete(roomId)
    }
  }, EVICT_AFTER_MS)
}

// Cloudflare's Hibernatable WebSocket API has both a `webSocketClose`
// and a `webSocketError` lifecycle hook — a connection that dies
// abruptly (network drop, a redeploy severing it mid-session) without
// a clean close handshake fires only the latter. Nitro's
// cloudflare-durable preset (the generated $DurableObject class) only
// wires up `webSocketClose`, so that path never reaches our own
// `close()` handler below — leaving a stale presence entry forever,
// which in turn blocks `scheduleEviction()` from ever seeing
// `presence.size === 0`, leaking the room's Yjs doc and chat
// indefinitely. `peer.peers` is crossws's own reflection of
// `ctx.getWebSockets()` — Cloudflare's ground truth for which
// connections are actually still open — so cross-checking against it
// catches what our own event bookkeeping misses.
function pruneStalePresence(peer: Peer, room: CompositionRoom): boolean {
  const live = new Set([...peer.peers].map(p => p.id))
  live.add(peer.id)
  let changed = false
  for (const clientId of room.presence.keys()) {
    if (!live.has(clientId)) {
      room.presence.delete(clientId)
      changed = true
    }
  }
  return changed
}

function roster(room: CompositionRoom): CompositionPresenceEntry[] {
  return [...room.presence].map(([clientId, p]) => ({
    clientId,
    name: p.name,
    role: p.role,
    ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}),
  }))
}

function send(peer: Peer, message: CompositionServerMessage) {
  peer.send(JSON.stringify(message))
}

function toAll(peer: Peer, roomId: string, message: CompositionServerMessage) {
  const json = JSON.stringify(message)
  peer.send(json)
  peer.publish(topic(roomId), json)
}

function toOthers(peer: Peer, roomId: string, message: CompositionServerMessage) {
  peer.publish(topic(roomId), JSON.stringify(message))
}

// Appends to the room's (bounded, in-memory) chat log and broadcasts —
// shared by human messages and `@jah`'s own (add-jah-chat).
function postChatMessage(peer: Peer, roomId: string, room: CompositionRoom, msg: ChatMessage) {
  room.chat.push(msg)
  if (room.chat.length > CHAT_KEEP) room.chat.splice(0, room.chat.length - CHAT_KEEP)
  toAll(peer, roomId, { t: 'chat', message: msg })
}

function jahChatMessage(text: string, sources?: ChatMessage['sources']): ChatMessage {
  return { clientId: JAH_NAME, name: JAH_NAME, avatarUrl: JAH_AVATAR_URL, text, at: Date.now(), sources }
}

function roomIdOf(peer: Peer): string | null {
  return new URL(peer.request.url).searchParams.get('id')
}

function nameOf(peer: Peer): string | null {
  return new URL(peer.request.url).searchParams.get('name')?.trim() || null
}

// The signed-in account behind this connection, resolved from the
// `jaime_session` cookie on the WS upgrade request. The avatar and
// `@jah` access are taken from here (server-resolved, not trusted from
// the client); the display name still comes from the client's
// editable screen name. `aiAccess` is *effective* access (the
// per-user flag OR the AI_ACCESS_LOGINS allowlist, add-jah-chat design
// decision 1) — callers never need to re-check the allowlist.
async function accountFor(peer: Peer): Promise<
  { userId: string, avatarUrl?: string, aiAccess: boolean, githubLogin?: string } | null
> {
  const cookie = peer.request?.headers?.get?.('cookie')
  const sid = cookie?.match(/(?:^|;\s*)jaime_session=([^;]+)/)?.[1]
  const env = getDurableEnv()
  const db = env?.PATTERNS_DB
  if (!sid || !db) return null
  try {
    const user = await getSessionUser(db, decodeURIComponent(sid))
    if (!user) return null
    const allowlist = parseAllowlist(env?.AI_ACCESS_LOGINS)
    return {
      userId: user.id,
      avatarUrl: user.avatarUrl,
      aiAccess: hasAiAccess(user, allowlist),
      githubLogin: user.githubLogin,
    }
  }
  catch {
    return null
  }
}

// Handles a `@jah`-addressed chat message, once the human's own
// message has already been broadcast as usual. Every gate that
// declines does so with a fixed chat message from `@jah`, except the
// two that mean total silence — the kill switch being off, and an
// anonymous sender (add-jah-chat jah-chat spec: "A Kill Switch Can
// Disable @jah Entirely", "@jah Requires A Signed-In, Access-Granted
// Account"). Only a real discussion request touches `jahBusy`,
// `env.AI`, and `ai_usage`.
async function handleJahMention(
  peer: Peer,
  roomId: string,
  room: CompositionRoom,
  sender: { userId?: string, aiAccess?: boolean, githubLogin?: string },
  mention: ReturnType<typeof classifyMention>,
): Promise<void> {
  const env = getDurableEnv()
  if (!env) return // no bindings in this context — never crash the room over it
  if (!isJahEnabled(env)) return
  if (!sender.userId) return

  if (!sender.aiAccess) {
    postChatMessage(peer, roomId, room, jahChatMessage(JAH_REPLY_NO_ACCESS))
    return
  }

  const db = env.PATTERNS_DB
  const capCheck = await underCaps(db, sender.userId, JAH_CAP_LIMITS)
  if (!capCheck.ok) {
    postChatMessage(peer, roomId, room, jahChatMessage(JAH_REPLY_OVER_CAP))
    return
  }

  if (room.jahBusy) {
    postChatMessage(peer, roomId, room, jahChatMessage(JAH_REPLY_BUSY))
    return
  }

  room.jahBusy = true
  toAll(peer, roomId, { t: 'jah_typing', typing: true })
  try {
    // JAH_E2E's canned reply never touches the model or the corpus, so
    // there's nothing for retrieval to ground — and no seeded knowledge
    // store to expect in that environment.
    const retrieval = env.JAH_E2E ? { contextBlocks: [], sources: [] } : await retrieveContext(realRetrievalDeps(env), mention.rest || 'Hello!')
    const userMessage: ModelMessage = { role: 'user', content: mention.rest || 'Hello!' }
    const reply = await generateJahReply(env, [userMessage], retrieval.contextBlocks)
    postChatMessage(peer, roomId, room, jahChatMessage(reply.text, retrieval.sources.length > 0 ? retrieval.sources : undefined))
    await recordUsage(db, {
      userId: sender.userId,
      githubLogin: sender.githubLogin ?? null,
      roomId,
      model: reply.model,
      promptTokens: reply.promptTokens,
      completionTokens: reply.completionTokens,
      costEstimateUsd: reply.costEstimateUsd,
      retrievalChunksUsed: retrieval.sources.length,
      // Workers AI's embedding output carries no token-count field — see migration 0011's comment.
      embeddingTokens: 0,
    })
  }
  finally {
    room.jahBusy = false
    toAll(peer, roomId, { t: 'jah_typing', typing: false })
  }
}

export default defineWebSocketHandler({
  async open(peer) {
    const roomId = roomIdOf(peer)
    if (!roomId) {
      peer.close(4000, 'Missing room id')
      return
    }
    if (!nameOf(peer)) {
      peer.close(4000, 'Missing display name')
      return
    }
    peer.subscribe(topic(roomId))
    // Wait for the client's `join` message (role + state vector).
  },

  async message(peer, message) {
    const roomId = roomIdOf(peer)
    const name = nameOf(peer)
    if (!roomId || !name) return
    const room = await getRoom(roomId)

    let data: CompositionClientMessage
    try {
      data = message.json<CompositionClientMessage>()
    }
    catch {
      return
    }

    if (data.t === 'join') {
      pruneStalePresence(peer, room)
      const role: Role = data.role === 'viewer' ? 'viewer' : 'editor'
      const awarenessId = typeof data.awarenessId === 'number' ? data.awarenessId : undefined
      const account = await accountFor(peer)
      room.presence.set(peer.id, {
        name,
        role,
        awarenessId,
        avatarUrl: account?.avatarUrl,
        userId: account?.userId,
        aiAccess: account?.aiAccess,
        githubLogin: account?.githubLogin,
      })
      // A brand-new room (or one whose chat reset after emptying) gets
      // @jah's one-time welcome as its first entry, in place before
      // the `welcome` payload below is built — the joiner sees it
      // immediately, with no extra round trip (add-jah-chat design
      // decision 10).
      if (room.chat.length === 0) {
        room.chat.push(jahChatMessage(JAH_WELCOME_TEXT))
      }
      send(peer, {
        t: 'welcome',
        clientId: peer.id,
        update: toBase64(Y.encodeStateAsUpdate(room.ydoc, fromBase64(data.sv))),
        bpm: room.bpm,
        cycleStartTimestamp: room.cycleStartTimestamp,
        playing: room.playing,
        atCycle: room.evalAtCycle,
        presence: roster(room),
        chat: room.chat,
        jah: jahAvailability(getDurableEnv() ?? {}, account),
      })
      toOthers(peer, roomId, { t: 'presence', roster: roster(room) })
      return
    }

    const me = room.presence.get(peer.id)
    if (!me) return // must `join` first

    if (data.t === 'y-update') {
      if (me.role === 'viewer') return // read-only, server-side backstop
      try {
        Y.applyUpdate(room.ydoc, fromBase64(data.u), peer.id)
      }
      catch {
        return
      }
      toOthers(peer, roomId, { t: 'y-update', u: data.u })
      scheduleSnapshot(roomId, room)
      return
    }

    if (data.t === 'awareness') {
      toOthers(peer, roomId, { t: 'awareness', a: data.a })
      return
    }

    if (data.t === 'eval') {
      room.playing = true
      room.evalAtCycle = typeof data.atCycle === 'number' ? data.atCycle : Date.now()
      toAll(peer, roomId, { t: 'eval', atCycle: room.evalAtCycle })
      return
    }

    if (data.t === 'stop') {
      room.playing = false
      room.evalAtCycle = null
      toAll(peer, roomId, { t: 'stop' })
      return
    }

    if (data.t === 'chat') {
      if (typeof data.text !== 'string' || !data.text.trim()) return
      const text = data.text.slice(0, 2000)
      const msg: ChatMessage = {
        clientId: peer.id,
        name,
        ...(me.avatarUrl ? { avatarUrl: me.avatarUrl } : {}),
        text,
        at: Date.now(),
      }
      postChatMessage(peer, roomId, room, msg)

      const mention = classifyMention(text)
      if (mention.addressed) void handleJahMention(peer, roomId, room, me, mention)
      return
    }

    if (data.t === 'clock_ping') {
      if (typeof data.clientSendTime !== 'number') return
      send(peer, { t: 'clock_pong', clientSendTime: data.clientSendTime, serverTime: Date.now() })
    }
  },

  async close(peer) {
    const roomId = roomIdOf(peer)
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return
    const left = room.presence.get(peer.id)
    room.presence.delete(peer.id)
    pruneStalePresence(peer, room)
    if (left?.awarenessId != null) {
      toOthers(peer, roomId, { t: 'peer_left', awarenessId: left.awarenessId })
    }
    toOthers(peer, roomId, { t: 'presence', roster: roster(room) })
    if (room.presence.size === 0) {
      // Everyone left — chat is ephemeral.
      room.chat = []
      room.playing = false
      room.evalAtCycle = null
      scheduleEviction(roomId, room)
    }
  },
})

// re-export for tests
export { nextCycleBoundary }
