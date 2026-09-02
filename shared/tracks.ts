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
// together, a loop with some movement: A a Linn-drum kick figure that
// doubles up every other bar, B a syncopated GM-sawtooth lead line in
// D minor with an alternating high-pass. Both lean on sounds prebake
// fetches in the background (the tidal-drum-machines bank + the
// gm_lead_2_sawtooth soundfont), so the very first Play in a brand-new
// room can be a beat or two late while those land. Deliberately
// generic — each track is an open deck.
export const DEFAULT_CODE: Record<TrackName, string> = {
  a: 'sound("<[bd bd [bd*4] [bd*4]] [bd*4]>").bank("linn").decay(0.15)',
  b: 'stack(\n  n("<[[2 ~] [2 ~] 2 3] [[3 ~] [3 ~] 3 3]>@4 [-1 ~] -1 -1 [0 ~] 0 0 [0 ~] 0 0 [0 ~] 0 0"),\n).sound("<gm_lead_2_sawtooth>").slow(2).scale("d4:minor").attack(.05).hpf("<1000 2000>*12").gain(".4")',
}
