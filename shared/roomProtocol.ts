import type { TrackName } from './tracks'

export interface TrackState {
  owner: string | null
  code: string
  isPlaying: boolean
}

export type ClientMessage =
  | { type: 'claim_track', track: TrackName }
  | { type: 'release_track', track: TrackName }
  | { type: 'pattern_update', track: TrackName, code: string }
  | { type: 'play_track', track: TrackName }
  | { type: 'stop_track', track: TrackName }
  | { type: 'clock_ping', clientSendTime: number }
  | { type: 'set_tempo', bpm: number }

export interface PresenceEntry {
  clientId: string
  name: string
}

export type ServerMessage =
  | { type: 'room_state', clientId: string, tracks: Record<TrackName, TrackState>, bpm: number, cycleStartTimestamp: number, presence: PresenceEntry[] }
  | { type: 'pattern_update', track: TrackName, code: string }
  | { type: 'ownership_update', track: TrackName, owner: string | null }
  | { type: 'playback_update', track: TrackName, isPlaying: boolean }
  | { type: 'clock_pong', clientSendTime: number, serverTime: number }
  | { type: 'tempo_update', bpm: number, cycleStartTimestamp: number }
  | { type: 'presence_update', clientId: string, joined: true, name: string }
  | { type: 'presence_update', clientId: string, joined: false }
