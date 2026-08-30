export const TRACK_NAMES = ['a', 'b'] as const

export type TrackName = typeof TRACK_NAMES[number]

export function isTrackName(value: unknown): value is TrackName {
  return typeof value === 'string' && (TRACK_NAMES as readonly string[]).includes(value)
}

// Display labels, kept separate from the track ID itself: "a"/"b" are
// deliberately bare (protocol keys, object property names, URL-safe),
// but text-transform: capitalize on a bare "a" reads as just "A" with
// no context. Two open decks, not instrument-typed slots — see
// DEFAULT_CODE below.
export const TRACK_LABELS: Record<TrackName, string> = {
  a: 'Track A',
  b: 'Track B',
}

// Starter patterns so a fresh room isn't silent/empty. Kept to synth
// waveforms so a fresh room makes sound immediately, before the default
// sample bank finishes loading (see app/lib/audioEngine.ts). Deliberately
// generic, not instrument-themed: each track is an open deck, not a fixed
// role — the owner decides what to script.
export const DEFAULT_CODE: Record<TrackName, string> = {
  a: 'note("c3 e3 g3 c4").s("triangle")',
  b: 'note("c2").s("square").slow(2)',
}
