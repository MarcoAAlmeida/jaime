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

const DEFAULT_BPM = 120
const SNAPSHOT_DEBOUNCE_MS = 2000
const EVICT_AFTER_MS = 60_000
const CHAT_KEEP = 200
// The Y.Text field name the client editor binds to.
export const DOC_TEXT = 'strudel'

interface CompositionRoom {
  ydoc: Y.Doc
  bpm: number
  cycleStartTimestamp: number
  playing: boolean
  evalAtCycle: number | null
  // clientId -> { name, role }. Never persisted (rebuilt from live peers).
  presence: Map<string, { name: string, role: Role }>
  chat: ChatMessage[]
  snapshotTimer: ReturnType<typeof setTimeout> | null
  evictTimer: ReturnType<typeof setTimeout> | null
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

function roster(room: CompositionRoom): CompositionPresenceEntry[] {
  return [...room.presence].map(([clientId, p]) => ({ clientId, name: p.name, role: p.role }))
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

function roomIdOf(peer: Peer): string | null {
  return new URL(peer.request.url).searchParams.get('id')
}

function nameOf(peer: Peer): string | null {
  return new URL(peer.request.url).searchParams.get('name')?.trim() || null
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
      const role: Role = data.role === 'viewer' ? 'viewer' : 'editor'
      room.presence.set(peer.id, { name, role })
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

    if (data.t === 'role') {
      me.role = data.role === 'viewer' ? 'viewer' : 'editor'
      toAll(peer, roomId, { t: 'presence', roster: roster(room) })
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
      const msg: ChatMessage = {
        clientId: peer.id,
        name,
        text: data.text.slice(0, 2000),
        at: Date.now(),
      }
      room.chat.push(msg)
      if (room.chat.length > CHAT_KEEP) room.chat.splice(0, room.chat.length - CHAT_KEEP)
      toAll(peer, roomId, { t: 'chat', message: msg })
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
    room.presence.delete(peer.id)
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
