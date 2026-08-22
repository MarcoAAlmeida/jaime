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

export function sendPlayTrack(track: TrackName) {
  send({ type: 'play_track', track })
}

export function sendStopTrack(track: TrackName) {
  send({ type: 'stop_track', track })
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
  const { clientId, tracks, bpm, cycleStartTimestamp, playRequestSeq, presence } = useJamSession()
  const route = useRoute()

  // Read-only test hook: exposes the computed offset for the Playwright
  // clock-drift assertion (04-roadmap.md Phase 3) to read from each
  // browser context. Not sensitive — just a millisecond timestamp delta.
  // hasEstimatedOnce lets a test wait for a real (non-default) value
  // instead of racing estimateOffset()'s async ping/pong round trip.
  ;(window as unknown as {
    __jaimeClock: { getOffset: () => number, hasEstimatedOnce: () => boolean }
  }).__jaimeClock = { getOffset, hasEstimatedOnce: hasEstimatedOffsetOnce }

  function handleMessage(event: MessageEvent) {
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
        presence.value = data.presence
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
      case 'playback_update': {
        const track = tracks.value[data.track]
        if (track) {
          track.isPlaying = data.isPlaying
          if (data.isPlaying) {
            // Bump even if isPlaying was already true — see the comment
            // on playRequestSeq in useJamSession.ts.
            playRequestSeq.value[data.track]++
          }
        }
        break
      }
      case 'tempo_update':
        bpm.value = data.bpm
        cycleStartTimestamp.value = data.cycleStartTimestamp
        break
      case 'presence_update':
        if (data.joined) {
          if (!presence.value.includes(data.clientId)) {
            presence.value = [...presence.value, data.clientId]
          }
        }
        else {
          presence.value = presence.value.filter(id => id !== data.clientId)
        }
        break
      case 'clock_pong':
        pendingPong?.(data)
        pendingPong = undefined
        break
    }
  }

  // Rooms are dynamic (Phase 4): the plugin connects only once a room ID
  // is present in the route, and reconnects if that ID changes — e.g.
  // navigating client-side from the landing page straight into a room,
  // with no full page reload in between.
  watch(
    () => route.params.id,
    (id) => {
      ws?.close()
      hasEstimatedOffset = false
      offset = 0
      if (typeof id !== 'string' || !id) {
        ws = undefined
        return
      }
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${protocol}://${location.host}/room?id=${encodeURIComponent(id)}`)
      ws.addEventListener('message', handleMessage)
    },
    { immediate: true },
  )
})
