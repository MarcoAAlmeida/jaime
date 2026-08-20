import type { Peer } from 'crossws'
import type { ClientMessage, ServerMessage, TrackState } from '#shared/roomProtocol'
import type { TrackName } from '#shared/tracks'
import { defineWebSocketHandler } from 'h3'
import { DEFAULT_CODE, isTrackName, TRACK_NAMES } from '#shared/tracks'
import { nextCycleBoundary } from '#shared/transportMath'

const DEFAULT_BPM = 120

const tracks: Record<TrackName, TrackState> = {
  drums: { owner: null, code: DEFAULT_CODE.drums, isPlaying: false },
  bass: { owner: null, code: DEFAULT_CODE.bass, isPlaying: false },
  lead: { owner: null, code: DEFAULT_CODE.lead, isPlaying: false },
  pad: { owner: null, code: DEFAULT_CODE.pad, isPlaying: false },
}
let bpm = DEFAULT_BPM
let cycleStartTimestamp = Date.now()

// All 4 keys are always present (initialized above, never deleted), so
// this indexed access is safe despite noUncheckedIndexedAccess.
function getTrack(name: TrackName): TrackState {
  return tracks[name]!
}

function send(peer: Peer, message: ServerMessage) {
  peer.send(JSON.stringify(message))
}

function broadcastToAll(peer: Peer, message: ServerMessage) {
  const json = JSON.stringify(message)
  peer.send(json)
  peer.publish('room', json)
}

function broadcastToOthers(peer: Peer, message: ServerMessage) {
  peer.publish('room', JSON.stringify(message))
}

// Stops a track (playback) and clears ownership, broadcasting both. Used
// by release_track and by close() so a track never ends up ownerless but
// still marked as playing — with no owner left, nothing could ever send
// stop_track for it again.
function releaseAndStop(peer: Peer, name: TrackName) {
  const track = getTrack(name)
  track.owner = null
  broadcastToAll(peer, { type: 'ownership_update', track: name, owner: null })
  if (track.isPlaying) {
    track.isPlaying = false
    broadcastToAll(peer, { type: 'playback_update', track: name, isPlaying: false })
  }
}

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe('room')
    send(peer, {
      type: 'room_state',
      clientId: peer.id,
      tracks: { ...tracks },
      bpm,
      cycleStartTimestamp,
    })
  },
  message(peer, message) {
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
      const track = getTrack(data.track)
      if (track.owner !== null) {
        return
      }
      track.owner = peer.id
      broadcastToAll(peer, { type: 'ownership_update', track: data.track, owner: peer.id })
      return
    }

    if (data.type === 'release_track') {
      if (!isTrackName(data.track)) {
        return
      }
      if (getTrack(data.track).owner !== peer.id) {
        return
      }
      releaseAndStop(peer, data.track)
      return
    }

    if (data.type === 'pattern_update') {
      if (!isTrackName(data.track) || typeof data.code !== 'string') {
        return
      }
      const track = getTrack(data.track)
      if (track.owner !== peer.id) {
        return
      }
      track.code = data.code
      broadcastToOthers(peer, { type: 'pattern_update', track: data.track, code: data.code })
      return
    }

    if (data.type === 'play_track') {
      if (!isTrackName(data.track)) {
        return
      }
      const track = getTrack(data.track)
      if (track.owner !== peer.id) {
        return
      }
      track.isPlaying = true
      broadcastToAll(peer, { type: 'playback_update', track: data.track, isPlaying: true })
      return
    }

    if (data.type === 'stop_track') {
      if (!isTrackName(data.track)) {
        return
      }
      const track = getTrack(data.track)
      if (track.owner !== peer.id) {
        return
      }
      track.isPlaying = false
      broadcastToAll(peer, { type: 'playback_update', track: data.track, isPlaying: false })
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
      cycleStartTimestamp = nextCycleBoundary(cycleStartTimestamp, bpm, Date.now())
      bpm = data.bpm
      broadcastToAll(peer, { type: 'tempo_update', bpm, cycleStartTimestamp })
    }
  },
  // Releases any tracks this connection owned (and stops them), so a
  // closed tab doesn't permanently lock a track for the rest of the
  // session.
  close(peer) {
    for (const name of TRACK_NAMES) {
      if (getTrack(name).owner === peer.id) {
        releaseAndStop(peer, name)
      }
    }
  },
})
