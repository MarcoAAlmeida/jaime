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

// Starter patterns so a fresh room isn't silent/empty. Now that the
// engine loads the full strudel.cc sample map + visuals (add-strudel-
// parity), the defaults show it off: A is a `$:` two-line drum groove
// with a punchcard visual, B a moving synth bass. Deliberately generic
// — each track is an open deck, not a fixed role.
export const DEFAULT_CODE: Record<TrackName, string> = {
  a: '$: s("bd(3,8), ~ cp, hh*8").punchcard()\n$: s("~ ~ ~ oh").gain(0.5)',
  b: 'note("<c2 eb2 g2 f2>").s("sawtooth").lpf(sine.range(400, 1800).slow(4)).lpq(8).room(0.2)',
}
