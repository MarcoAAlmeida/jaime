import type { ClientMessage, ServerMessage } from '#shared/roomProtocol'
import type { TrackName } from '#shared/tracks'
import { computeOffset } from '~/lib/clockOffset'

let ws: WebSocket | undefined
let pendingPong: ((message: Extract<ServerMessage, { type: 'clock_pong' }>) => void) | undefined
let offset = 0
let hasEstimatedOffset = false

function send(message: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

export function sendClaimTrack(track: TrackName) {
  send({ type: 'claim_track', track })
}

export function sendReleaseTrack(track: TrackName) {
  send({ type: 'release_track', track })
}

export function sendPatternUpdate(track: TrackName, code: string) {
  send({ type: 'pattern_update', track, code })
}

export function sendSetTempo(bpm: number) {
  send({ type: 'set_tempo', bpm })
}

/**
 * Sends a clock_ping and resolves with the matching clock_pong. Only one
 * ping is ever in flight at a time in this design, so no correlation ID
 * is needed beyond that.
 */
export function pingClock(): Promise<{ clientSendTime: number, serverTime: number }> {
  return new Promise((resolve) => {
    const clientSendTime = Date.now()
    pendingPong = (message) => resolve({ clientSendTime: message.clientSendTime, serverTime: message.serverTime })
    send({ type: 'clock_ping', clientSendTime })
  })
}

/**
 * Estimates this client's clock offset from the Durable Object via one
 * ping/pong round trip. See computeOffset() for the formula.
 */
export async function estimateOffset(): Promise<number> {
  const sentAt = Date.now()
  const { clientSendTime, serverTime } = await pingClock()
  const roundTrip = Date.now() - sentAt
  offset = computeOffset(clientSendTime, serverTime, roundTrip)
  hasEstimatedOffset = true
  return offset
}

export function getOffset(): number {
  return offset
}

export function hasEstimatedOffsetOnce(): boolean {
  return hasEstimatedOffset
}

export default defineNuxtPlugin(() => {
  const { clientId, tracks, bpm, cycleStartTimestamp } = useJamSession()

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${protocol}://${location.host}/room`)

  // Read-only test hook: exposes the computed offset for the Playwright
  // clock-drift assertion (04-roadmap.md Phase 3) to read from each
  // browser context. Not sensitive — just a millisecond timestamp delta.
  // hasEstimatedOnce lets a test wait for a real (non-default) value
  // instead of racing estimateOffset()'s async ping/pong round trip.
  ;(window as unknown as {
    __jaimeClock: { getOffset: () => number, hasEstimatedOnce: () => boolean }
  }).__jaimeClock = { getOffset, hasEstimatedOnce: hasEstimatedOffsetOnce }

  ws.addEventListener('message', (event) => {
    let data: ServerMessage
    try {
      data = JSON.parse(event.data)
    }
    catch {
      return
    }

    switch (data.type) {
      case 'room_state':
        clientId.value = data.clientId
        tracks.value = data.tracks
        bpm.value = data.bpm
        cycleStartTimestamp.value = data.cycleStartTimestamp
        estimateOffset()
        break
      case 'pattern_update': {
        const track = tracks.value[data.track]
        if (track) {
          track.code = data.code
        }
        break
      }
      case 'ownership_update': {
        const track = tracks.value[data.track]
        if (track) {
          track.owner = data.owner
        }
        break
      }
      case 'tempo_update':
        bpm.value = data.bpm
        cycleStartTimestamp.value = data.cycleStartTimestamp
        break
      case 'clock_pong':
        pendingPong?.(data)
        pendingPong = undefined
        break
    }
  })
})
