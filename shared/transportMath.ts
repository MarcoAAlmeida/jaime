// 1 Strudel cycle = 1 bar of 4 beats. Not specified in any project doc —
// an assumption, standard for 4/4 time but worth revisiting if patterns
// turn out to use a different cycle/beat relationship.
export const BEATS_PER_CYCLE = 4

export function cycleDurationMs(bpm: number, beatsPerCycle = BEATS_PER_CYCLE): number {
  return (60000 / bpm) * beatsPerCycle
}

/**
 * The next bar boundary in the room's tempo grid at or after `from`.
 * cycleStartTimestamp is a fixed reference phase for that grid (not
 * literally "when playback began") — boundaries are
 * cycleStartTimestamp + n * cycleDuration for every integer n, including
 * ones before cycleStartTimestamp itself. Shared by the server (tempo
 * changes) and the client (synchronized playback start) so both compute
 * the same grid the same way.
 */
export function nextCycleBoundary(cycleStartTimestamp: number, bpm: number, from: number, beatsPerCycle = BEATS_PER_CYCLE): number {
  const duration = cycleDurationMs(bpm, beatsPerCycle)
  const elapsed = from - cycleStartTimestamp
  const cyclesElapsed = Math.floor(elapsed / duration) + 1
  return cycleStartTimestamp + cyclesElapsed * duration
}
