import type { Peer } from 'crossws'
import type { ClientMessage, ServerMessage, TrackState } from '#shared/roomProtocol'
import type { TrackName } from '#shared/tracks'
import { defineWebSocketHandler } from 'h3'
import { nextCycleBoundary } from '#shared/transportMath'
import { DEFAULT_CODE, isTrackName, TRACK_NAMES } from '#shared/tracks'
import { getSessionUser } from '../auth/sessions'
import { getDurableEnv } from '../utils/durableStorage'

const DEFAULT_BPM = 120

interface RoomState {
  tracks: Record<TrackName, TrackState>
  bpm: number
  cycleStartTimestamp: number
  // clientId -> { name, avatarUrl? }. Never persisted — same reasoning
  // as presence itself already documented below: rebuilt from whichever
  // connections are actually live, never restored stale. avatarUrl is
  // server-resolved from the connection's session (never client-sent).
  presence: Map<string, { name: string, avatarUrl?: string }>
}

// What actually gets written to durable storage — deliberately excludes
// presence. A restored presence list would go stale the instant a
// connection that was open before the restart actually drops; presence
// is always rebuilt from whichever WebSockets are still connected (see
// design.md in add-room-persistence).
interface PersistedRoomState {
  tracks: Record<TrackName, TrackState>
  bpm: number
  cycleStartTimestamp: number
}

// One Durable Object instance serves the entire Worker — Nitro's
// cloudflare-durable preset always addresses a single hardcoded
// instance (see design.md in add-multi-room-presence), so there's no
// per-room DO here. Rooms are isolated from each other purely by
// keying this map by room ID and scoping every crossws topic to that
// ID, not by separate DO instances.
const rooms = new Map<string, RoomState>()
// In-flight loads from storage, keyed by room ID — ensures concurrent
// callers for the same not-yet-cached room (e.g. two clients' open()
// calls arriving close together right after a restart) converge on one
// storage read instead of racing to populate `rooms` independently.
const loading = new Map<string, Promise<RoomState>>()

function storageKey(roomId: string): string {
  return `room:${roomId}`
}

function createRoomState(): RoomState {
  return {
    tracks: {
      a: { owner: null, code: DEFAULT_CODE.a, isPlaying: false },
      b: { owner: null, code: DEFAULT_CODE.b, isPlaying: false },
    },
    bpm: DEFAULT_BPM,
    cycleStartTimestamp: Date.now(),
    presence: new Map(),
  }
}

async function loadRoom(roomId: string): Promise<RoomState> {
  const stored = await getDurableStorage().get<PersistedRoomState>(storageKey(roomId))
  if (stored) {
    return { ...stored, presence: new Map() }
  }
  return createRoomState()
}

async function getRoom(roomId: string): Promise<RoomState> {
  const cached = rooms.get(roomId)
  if (cached) {
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

// Writes the room's entire current in-memory state as one snapshot, not
// a per-field diff — see design.md's "Whole-room snapshot writes"
// decision for why that's what makes this safe under Durable Objects'
// interleaved async execution, not just simpler.
async function persistRoom(roomId: string, room: RoomState): Promise<void> {
  const persisted: PersistedRoomState = {
    tracks: room.tracks,
    bpm: room.bpm,
    cycleStartTimestamp: room.cycleStartTimestamp,
  }
  await getDurableStorage().put(storageKey(roomId), persisted)
}

// peer.request.url is part of crossws's public Peer API and persists
// across open/message/close for the same connection (restored from the
// WebSocket's serialized attachment on the Hibernation API's wake-ups,
// not just held in memory) — so the room ID never needs its own
// peer-to-room side table.
function getRoomIdFromPeer(peer: Peer): string | null {
  return new URL(peer.request.url).searchParams.get('id')
}

// The join screen is supposed to guarantee a name always exists before a
// connection is ever attempted (see design.md in
// add-identity-and-transport-ui) — trimmed to a real, non-empty string
// here so the server stays the actual enforcement point rather than
// trusting client UI alone, same posture as room ID and ownership.
function getNameFromPeer(peer: Peer): string | null {
  const name = new URL(peer.request.url).searchParams.get('name')?.trim()
  return name || null
}

// The signed-in account's avatar for this connection, resolved from the
// `jaime_session` cookie on the WS upgrade. Server-resolved on purpose —
// an image URL rendered in every other participant's roster is not
// something to trust from the client. The display name still comes from
// the client's editable screen name (the `name` query param).
async function avatarFromPeer(peer: Peer): Promise<string | undefined> {
  const sid = peer.request?.headers?.get?.('cookie')?.match(/(?:^|;\s*)jaime_session=([^;]+)/)?.[1]
  const db = getDurableEnv()?.PATTERNS_DB
  if (!sid || !db) return undefined
  try {
    return (await getSessionUser(db, decodeURIComponent(sid)))?.avatarUrl
  }
  catch {
    return undefined
  }
}

function roomTopic(roomId: string): string {
  return `room:${roomId}`
}

// All 4 keys are always present (initialized above, never deleted), so
// this indexed access is safe despite noUncheckedIndexedAccess.
function getTrack(room: RoomState, name: TrackName): TrackState {
  return room.tracks[name]!
}

function send(peer: Peer, message: ServerMessage) {
  peer.send(JSON.stringify(message))
}

function broadcastToAll(peer: Peer, roomId: string, message: ServerMessage) {
  const json = JSON.stringify(message)
  peer.send(json)
  peer.publish(roomTopic(roomId), json)
}

function broadcastToOthers(peer: Peer, roomId: string, message: ServerMessage) {
  peer.publish(roomTopic(roomId), JSON.stringify(message))
}

// Cloudflare's Hibernatable WebSocket API has both a `webSocketClose`
// and a `webSocketError` lifecycle hook — an abrupt disconnect (network
// drop, a redeploy severing a connection mid-session) without a clean
// close handshake fires only the latter. Nitro's cloudflare-durable
// preset (the generated $DurableObject class) only wires up
// `webSocketClose`, so that path never reaches close() below — leaving
// a ghost presence entry, and worse, a track permanently locked to a
// dead connection (nobody else could ever claim or stop it again,
// since close()'s ownership release never runs either). `peer.peers`
// is crossws's own reflection of `ctx.getWebSockets()` — Cloudflare's
// ground truth for which connections are actually still open — so
// cross-checking against it catches what our own event bookkeeping
// misses.
async function pruneStalePresence(peer: Peer, roomId: string, room: RoomState): Promise<void> {
  const live = new Set([...peer.peers].map(p => p.id))
  live.add(peer.id)
  for (const clientId of [...room.presence.keys()]) {
    if (!live.has(clientId)) {
      room.presence.delete(clientId)
      broadcastToOthers(peer, roomId, { type: 'presence_update', clientId, joined: false })
    }
  }
  for (const name of TRACK_NAMES) {
    const track = getTrack(room, name)
    if (track.owner && !live.has(track.owner)) {
      await releaseAndStop(peer, roomId, room, name)
    }
  }
}

// Stops a track (playback) and clears ownership, broadcasting both. Used
// by release_track and by close() so a track never ends up ownerless but
// still marked as playing — with no owner left, nothing could ever send
// stop_track for it again. Persists before broadcasting (see design.md)
// so a restart right after can never lose a change others already saw.
async function releaseAndStop(peer: Peer, roomId: string, room: RoomState, name: TrackName): Promise<void> {
  const track = getTrack(room, name)
  track.owner = null
  const wasPlaying = track.isPlaying
  track.isPlaying = false
  await persistRoom(roomId, room)
  broadcastToAll(peer, roomId, { type: 'ownership_update', track: name, owner: null })
  if (wasPlaying) {
    broadcastToAll(peer, roomId, { type: 'playback_update', track: name, isPlaying: false })
  }
}

export default defineWebSocketHandler({
  async open(peer) {
    const roomId = getRoomIdFromPeer(peer)
    if (!roomId) {
      peer.close(4000, 'Missing room id')
      return
    }
    const name = getNameFromPeer(peer)
    if (!name) {
      peer.close(4000, 'Missing display name')
      return
    }
    const room = await getRoom(roomId)

    peer.subscribe(roomTopic(roomId))
    await pruneStalePresence(peer, roomId, room)
    const avatarUrl = await avatarFromPeer(peer)
    room.presence.set(peer.id, { name, avatarUrl })
    broadcastToOthers(peer, roomId, {
      type: 'presence_update',
      clientId: peer.id,
      joined: true,
      name,
      ...(avatarUrl ? { avatarUrl } : {}),
    })

    send(peer, {
      type: 'room_state',
      clientId: peer.id,
      tracks: { ...room.tracks },
      bpm: room.bpm,
      cycleStartTimestamp: room.cycleStartTimestamp,
      presence: [...room.presence].map(([clientId, p]) => ({
        clientId,
        name: p.name,
        ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}),
      })),
    })
  },
  async message(peer, message) {
    const roomId = getRoomIdFromPeer(peer)
    if (!roomId) {
      return
    }
    const room = await getRoom(roomId)

    let data: ClientMessage
    try {
      data = message.json<ClientMessage>()
    }
    catch {
      return
    }

    if (data.type === 'claim_track') {
      if (!isTrackName(data.track)) {
        return
      }
      const track = getTrack(room, data.track)
      if (track.owner !== null) {
        return
      }
      track.owner = peer.id
      await persistRoom(roomId, room)
      broadcastToAll(peer, roomId, { type: 'ownership_update', track: data.track, owner: peer.id })
      return
    }

    if (data.type === 'release_track') {
      if (!isTrackName(data.track)) {
        return
      }
      if (getTrack(room, data.track).owner !== peer.id) {
        return
      }
      await releaseAndStop(peer, roomId, room, data.track)
      return
    }

    if (data.type === 'pattern_update') {
      if (!isTrackName(data.track) || typeof data.code !== 'string') {
        return
      }
      const track = getTrack(room, data.track)
      if (track.owner !== peer.id) {
        return
      }
      track.code = data.code
      await persistRoom(roomId, room)
      broadcastToOthers(peer, roomId, { type: 'pattern_update', track: data.track, code: data.code })
      return
    }

    if (data.type === 'play_track') {
      if (!isTrackName(data.track)) {
        return
      }
      const track = getTrack(room, data.track)
      if (track.owner !== peer.id) {
        return
      }
      track.isPlaying = true
      await persistRoom(roomId, room)
      broadcastToAll(peer, roomId, { type: 'playback_update', track: data.track, isPlaying: true })
      return
    }

    if (data.type === 'stop_track') {
      if (!isTrackName(data.track)) {
        return
      }
      const track = getTrack(room, data.track)
      if (track.owner !== peer.id) {
        return
      }
      track.isPlaying = false
      await persistRoom(roomId, room)
      broadcastToAll(peer, roomId, { type: 'playback_update', track: data.track, isPlaying: false })
      return
    }

    if (data.type === 'clock_ping') {
      if (typeof data.clientSendTime !== 'number') {
        return
      }
      send(peer, { type: 'clock_pong', clientSendTime: data.clientSendTime, serverTime: Date.now() })
      return
    }

    if (data.type === 'set_tempo') {
      if (typeof data.bpm !== 'number' || data.bpm <= 0) {
        return
      }
      room.cycleStartTimestamp = nextCycleBoundary(room.cycleStartTimestamp, room.bpm, Date.now())
      room.bpm = data.bpm
      await persistRoom(roomId, room)
      broadcastToAll(peer, roomId, { type: 'tempo_update', bpm: room.bpm, cycleStartTimestamp: room.cycleStartTimestamp })
    }
  },
  // Releases any tracks this connection owned (and stops them) and
  // removes it from presence, so a closed tab doesn't permanently lock a
  // track or linger in the roster for the rest of the room's session.
  async close(peer) {
    const roomId = getRoomIdFromPeer(peer)
    if (!roomId) {
      return
    }
    const room = rooms.get(roomId)
    if (!room) {
      return
    }

    room.presence.delete(peer.id)
    broadcastToOthers(peer, roomId, { type: 'presence_update', clientId: peer.id, joined: false })

    for (const name of TRACK_NAMES) {
      if (getTrack(room, name).owner === peer.id) {
        await releaseAndStop(peer, roomId, room, name)
      }
    }
    await pruneStalePresence(peer, roomId, room)
  },
})
