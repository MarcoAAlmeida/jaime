import type { Peer } from 'crossws'
import type { ClientMessage, ServerMessage, TrackState } from '#shared/roomProtocol'
import type { TrackName } from '#shared/tracks'
import { defineWebSocketHandler } from 'h3'
import { DEFAULT_CODE, isTrackName, TRACK_NAMES } from '#shared/tracks'

const DEFAULT_BPM = 120
// 1 Strudel cycle = 1 bar of 4 beats. Not specified in any project doc —
// an assumption, standard for 4/4 time but worth revisiting if patterns
// turn out to use a different cycle/beat relationship.
const BEATS_PER_CYCLE = 4

const tracks: Record<TrackName, TrackState> = {
  drums: { owner: null, code: DEFAULT_CODE.drums },
  bass: { owner: null, code: DEFAULT_CODE.bass },
  lead: { owner: null, code: DEFAULT_CODE.lead },
  pad: { owner: null, code: DEFAULT_CODE.pad },
}
let bpm = DEFAULT_BPM
let cycleStartTimestamp = Date.now()

function cycleDurationMs(currentBpm: number): number {
  return (60000 / currentBpm) * BEATS_PER_CYCLE
}

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
      const track = getTrack(data.track)
      if (track.owner !== peer.id) {
        return
      }
      track.owner = null
      broadcastToAll(peer, { type: 'ownership_update', track: data.track, owner: null })
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
      const now = Date.now()
      const currentCycleDuration = cycleDurationMs(bpm)
      const elapsed = now - cycleStartTimestamp
      const cyclesElapsed = Math.floor(elapsed / currentCycleDuration) + 1
      cycleStartTimestamp = cycleStartTimestamp + cyclesElapsed * currentCycleDuration
      bpm = data.bpm
      broadcastToAll(peer, { type: 'tempo_update', bpm, cycleStartTimestamp })
    }
  },
  // Releases any tracks this connection owned, so a closed tab doesn't
  // permanently lock a track for the rest of the session.
  close(peer) {
    for (const name of TRACK_NAMES) {
      const track = getTrack(name)
      if (track.owner === peer.id) {
        track.owner = null
        broadcastToOthers(peer, { type: 'ownership_update', track: name, owner: null })
      }
    }
  },
})
