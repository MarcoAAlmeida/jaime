import { nextCycleBoundary } from '#shared/transportMath'
import { getOffset } from '~/plugins/websocket.client'

/**
 * Waits until the next bar boundary on a tempo grid, so a broadcast
 * play/stop lands in phase across clients rather than firing whenever
 * each one's network message happens to arrive.
 *
 * Not literally `cycleStartTimestamp` — that's a fixed reference phase
 * for the grid, almost always already in the past, so using it directly
 * means the delay is always ~0. `nextCycleBoundary()` is what makes it
 * phase-locked.
 *
 * `cycleStartTimestamp` / `bpm` are in the Durable Object's clock;
 * `offset` converts between that and this client's local clock (see
 * `estimateOffset` in websocket.client.ts for the sign convention).
 */
export async function waitForCycleBoundary(
  cycleStartTimestamp: number,
  bpm: number,
  offset: number,
): Promise<void> {
  const serverNow = Date.now() + offset
  const targetServerTime = nextCycleBoundary(cycleStartTimestamp, bpm, serverNow)
  const targetLocalTime = targetServerTime - offset
  const delay = targetLocalTime - Date.now()
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}

/**
 * The JAM-bound `beforeStart` callback shared by every track's
 * scheduler (passed once per repl at construction). Reads live JAM
 * session + clock state each time Strudel actually calls it, not a
 * snapshot from construction.
 */
export async function waitForSynchronizedStart(): Promise<void> {
  const { cycleStartTimestamp, bpm } = useJamSession()
  await waitForCycleBoundary(cycleStartTimestamp.value, bpm.value, getOffset())
}
