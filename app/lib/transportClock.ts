import { getOffset } from '~/plugins/websocket.client'

/**
 * A stable beforeStart callback shared by every track's scheduler
 * (passed once per repl at construction — see audioEngine.ts). Reads
 * live clock state each time it's actually called by Strudel, not a
 * snapshot from whenever the repl was constructed, so it stays correct
 * across re-evaluations and tempo changes.
 *
 * cycleStartTimestamp is in the Durable Object's clock; getOffset()
 * converts it to this client's local equivalent (see the comment on
 * estimateOffset in websocket.client.ts for the sign convention).
 */
export async function waitForSynchronizedStart(): Promise<void> {
  const { cycleStartTimestamp } = useJamSession()
  const targetLocalTime = cycleStartTimestamp.value - getOffset()
  const delay = targetLocalTime - Date.now()
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}
