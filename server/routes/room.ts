import type { Peer } from 'crossws'
import type { ClientMessage, ServerMessage, TrackState } from '#shared/roomProtocol'
import type { TrackName } from '#shared/tracks'
import { defineWebSocketHandler } from 'h3'
import { nextCycleBoundary } from '#shared/transportMath'
import { DEFAULT_CODE, isTrackName, TRACK_NAMES } from '#shared/tracks'

const DEFAULT_BPM = 120

interface RoomState {
  tracks: Record<TrackName, TrackState>
  bpm: number
  cycleStartTimestamp: number
  presence: Set<string>
}

// One Durable Object instance serves the entire Worker — Nitro's
// cloudflare-durable preset always addresses a single hardcoded
// instance (see design.md in add-multi-room-presence), so there's no
// per-room DO here. Rooms are isolated from each other purely by
// keying this map by room ID and scoping every crossws topic to that
// ID, not by separate DO instances.
const rooms = new Map<string, RoomState>()

function createRoomState(): RoomState {
  return {
    tracks: {
      a: { owner: null, code: DEFAULT_CODE.a, isPlaying: false },
      b: { owner: null, code: DEFAULT_CODE.b, isPlaying: false },
    },
    bpm: DEFAULT_BPM,
    cycleStartTimestamp: Date.now(),
    presence: new Set(),
  }
}

function getRoom(roomId: string): RoomState {
  let room = rooms.get(roomId)
  if (!room) {
    room = createRoomState()
    rooms.set(roomId, room)
  }
  return room
}

// peer.request.url is part of crossws's public Peer API and persists
// across open/message/close for the same connection (restored from the
// WebSocket's serialized attachment on the Hibernation API's wake-ups,
// not just held in memory) — so the room ID never needs its own
// peer-to-room side table.
function getRoomIdFromPeer(peer: Peer): string | null {
  return new URL(peer.request.url).searchParams.get('id')
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

// Stops a track (playback) and clears ownership, broadcasting both. Used
// by release_track and by close() so a track never ends up ownerless but
// still marked as playing — with no owner left, nothing could ever send
// stop_track for it again.
function releaseAndStop(peer: Peer, roomId: string, room: RoomState, name: TrackName) {
  const track = getTrack(room, name)
  track.owner = null
  broadcastToAll(peer, roomId, { type: 'ownership_update', track: name, owner: null })
  if (track.isPlaying) {
    track.isPlaying = false
    broadcastToAll(peer, roomId, { type: 'playback_update', track: name, isPlaying: false })
  }
}

export default defineWebSocketHandler({
  open(peer) {
    const roomId = getRoomIdFromPeer(peer)
    if (!roomId) {
      peer.close(4000, 'Missing room id')
      return
    }
    const room = getRoom(roomId)

    peer.subscribe(roomTopic(roomId))
    room.presence.add(peer.id)
    broadcastToOthers(peer, roomId, { type: 'presence_update', clientId: peer.id, joined: true })

    send(peer, {
      type: 'room_state',
      clientId: peer.id,
      tracks: { ...room.tracks },
      bpm: room.bpm,
      cycleStartTimestamp: room.cycleStartTimestamp,
      presence: [...room.presence],
    })
  },
  message(peer, message) {
    const roomId = getRoomIdFromPeer(peer)
    if (!roomId) {
      return
    }
    const room = getRoom(roomId)

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
      releaseAndStop(peer, roomId, room, data.track)
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
      broadcastToAll(peer, roomId, { type: 'tempo_update', bpm: room.bpm, cycleStartTimestamp: room.cycleStartTimestamp })
    }
  },
  // Releases any tracks this connection owned (and stops them) and
  // removes it from presence, so a closed tab doesn't permanently lock a
  // track or linger in the roster for the rest of the room's session.
  close(peer) {
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
        releaseAndStop(peer, roomId, room, name)
      }
    }
  },
})
