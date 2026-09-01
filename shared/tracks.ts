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

// Starter patterns so a fresh room isn't silent/empty — and, played
// together, an actual house loop: A a four-on-the-floor kit off the
// sample bank with a punchcard visual, B an offbeat filtered synth bass
// in Cm. Deliberately generic — each track is an open deck.
export const DEFAULT_CODE: Record<TrackName, string> = {
  a: 's("bd*4, [~ cp]*2, hh*8").gain("1 .8 .9 .8").punchcard()',
  b: 'note("<c2 c2 eb2 g2>").struct("~ x").fast(4).s("sawtooth").lpf(sine.range(500, 1600).slow(8)).lpq(8).decay(.14).sustain(0).gain(.8)',
}
