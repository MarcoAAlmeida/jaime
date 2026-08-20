export const TRACK_NAMES = ['drums', 'bass', 'lead', 'pad'] as const

export type TrackName = typeof TRACK_NAMES[number]

export function isTrackName(value: unknown): value is TrackName {
  return typeof value === 'string' && (TRACK_NAMES as readonly string[]).includes(value)
}

// Starter patterns so a fresh room isn't silent/empty. Only built-in
// synth waveforms are registered (sawtooth/sine/square/triangle) — no
// sample bank yet — so these are synth patterns, not literal drum hits,
// even for the "drums" track.
export const DEFAULT_CODE: Record<TrackName, string> = {
  drums: 'note("c2").s("square").fast(4)',
  bass: 'note("c2 eb2 f2 g2").s("sawtooth").slow(2)',
  lead: 'note("c4 e4 g4 c5").s("triangle")',
  pad: 'note("c3,e3,g3").s("sine").slow(4)',
}
