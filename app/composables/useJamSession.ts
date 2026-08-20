import type { TrackState } from '#shared/roomProtocol'
import type { TrackName } from '#shared/tracks'
import { DEFAULT_CODE, TRACK_NAMES } from '#shared/tracks'

// Matches the server's starter patterns so there's no flash of empty
// content before room_state arrives; the server's value is what's
// actually authoritative once it does.
function initialTracks(): Record<TrackName, TrackState> {
  return Object.fromEntries(
    TRACK_NAMES.map(name => [name, { owner: null, code: DEFAULT_CODE[name] }]),
  ) as Record<TrackName, TrackState>
}

export function useJamSession() {
  const clientId = useState<string | null>('jam-session-client-id', () => null)
  const tracks = useState<Record<TrackName, TrackState>>('jam-session-tracks', initialTracks)
  const bpm = useState('jam-session-bpm', () => 120)
  const cycleStartTimestamp = useState('jam-session-cycle-start', () => Date.now())

  return {
    clientId,
    tracks,
    bpm,
    cycleStartTimestamp,
  }
}
