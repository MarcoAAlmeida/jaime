import { nextCycleBoundary } from '#shared/transportMath'
import { getOffset } from '~/plugins/websocket.client'

/**
 * A stable beforeStart callback shared by every track's scheduler
 * (passed once per repl at construction — see audioEngine.ts). Reads
 * live clock state each time it's actually called by Strudel, not a
 * snapshot from whenever the repl was constructed, so it stays correct
 * across re-evaluations and tempo changes.
 *
 * Waits for the *next* bar boundary on the room's tempo grid, not
 * literally `cycleStartTimestamp` — that's a fixed reference phase for
 * the grid, almost always already in the past by the time anyone plays
 * anything, so using it directly as the target time means the delay is
 * always ~0 and starts are never actually phase-locked. Using
 * nextCycleBoundary() is what makes broadcast play/stop (jam.vue) land
 * in phase across clients instead of firing whenever each one's network
 * message happens to arrive.
 *
 * cycleStartTimestamp/bpm are in the Durable Object's clock; getOffset()
 * converts between that and this client's local clock (see the comment
 * on estimateOffset in websocket.client.ts for the sign convention).
 */
export async function waitForSynchronizedStart(): Promise<void> {
  const { cycleStartTimestamp, bpm } = useJamSession()
  const offset = getOffset()
  const serverNow = Date.now() + offset
  const targetServerTime = nextCycleBoundary(cycleStartTimestamp.value, bpm.value, serverNow)
  const targetLocalTime = targetServerTime - offset
  const delay = targetLocalTime - Date.now()
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}
