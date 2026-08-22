import type { TrackState } from '#shared/roomProtocol'
import type { TrackName } from '#shared/tracks'
import { DEFAULT_CODE, TRACK_NAMES } from '#shared/tracks'

// Matches the server's starter patterns so there's no flash of empty
// content before room_state arrives; the server's value is what's
// actually authoritative once it does.
function initialTracks(): Record<TrackName, TrackState> {
  return Object.fromEntries(
    TRACK_NAMES.map(name => [name, { owner: null, code: DEFAULT_CODE[name], isPlaying: false }]),
  ) as Record<TrackName, TrackState>
}

function zeroPerTrack(): Record<TrackName, number> {
  return Object.fromEntries(TRACK_NAMES.map(name => [name, 0])) as Record<TrackName, number>
}

export function useJamSession() {
  const clientId = useState<string | null>('jam-session-client-id', () => null)
  const tracks = useState<Record<TrackName, TrackState>>('jam-session-tracks', initialTracks)
  const bpm = useState('jam-session-bpm', () => 120)
  const cycleStartTimestamp = useState('jam-session-cycle-start', () => Date.now())
  // Bumped on every play_track broadcast received for a track, even if
  // isPlaying was already true — re-pressing Play on an already-playing
  // track (e.g. after fixing a typo) needs to trigger a fresh evaluate()
  // with the current code, but a plain watch() on the isPlaying boolean
  // wouldn't refire on a true->true "change". Consumed by jam.vue.
  const playRequestSeq = useState<Record<TrackName, number>>('jam-session-play-seq', zeroPerTrack)
  // Connection IDs currently in the room, not people — no display-name
  // system exists yet (Phase 6). See presence_update in websocket.client.ts.
  const presence = useState<string[]>('jam-session-presence', () => [])

  return {
    clientId,
    tracks,
    bpm,
    cycleStartTimestamp,
    playRequestSeq,
    presence,
  }
}
