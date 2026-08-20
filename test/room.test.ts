import { SELF } from 'cloudflare:test'
import { afterEach, describe, expect, it } from 'vitest'

let openSockets: WebSocket[] = []

function nextMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    ws.addEventListener('message', (event) => resolve(JSON.parse(event.data as string)), { once: true })
  })
}

/**
 * Returns a `next()` that resolves with messages in arrival order, one
 * call per message — unlike calling nextMessage() twice back-to-back,
 * which attaches two independent `once` listeners that both fire on the
 * very next single message (each dispatched event runs every currently
 * registered listener), not one each on two separate messages. Needed
 * whenever a handler synchronously sends more than one message (e.g.
 * releaseAndStop's ownership_update followed by playback_update).
 */
function messageQueue(ws: WebSocket): () => Promise<any> {
  const buffered: any[] = []
  const waiters: Array<(message: any) => void> = []
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data as string)
    const waiter = waiters.shift()
    if (waiter) {
      waiter(message)
    }
    else {
      buffered.push(message)
    }
  })
  return () => {
    const message = buffered.shift()
    if (message !== undefined) {
      return Promise.resolve(message)
    }
    return new Promise(resolve => waiters.push(resolve))
  }
}

/**
 * Connects and returns both the socket and a promise for its initial
 * room_state message. The listener for that first message is attached
 * before accept() is called, so there's no window where the server's
 * open-handler send could arrive before anything is listening — a
 * WebSocket message sent before a listener is attached is dropped, not
 * buffered.
 */
async function connect(): Promise<{ ws: WebSocket, initial: Promise<any> }> {
  const response = await SELF.fetch('http://example.com/room', {
    headers: { Upgrade: 'websocket' },
  })
  const ws = response.webSocket
  if (!ws) {
    throw new Error('Expected a WebSocket in the response')
  }
  const initial = nextMessage(ws)
  ws.accept()
  openSockets.push(ws)
  return { ws, initial }
}

afterEach(() => {
  for (const ws of openSockets) {
    ws.close()
  }
  openSockets = []
})

describe('realtime-room', () => {
  it('relays a pattern update from the owner to other connected clients', async () => {
    const a = await connect()
    const b = await connect()
    await a.initial
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'drums' }))
    await nextMessage(a.ws) // ownership_update to self
    await nextMessage(b.ws) // ownership_update broadcast to b

    const received = nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'drums', code: 's("bd sd")' }))

    await expect(received).resolves.toEqual({ type: 'pattern_update', track: 'drums', code: 's("bd sd")' })
  })

  it('does not echo a pattern update back to the sender', async () => {
    const a = await connect()
    await a.initial
    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'drums' }))
    await nextMessage(a.ws)

    let echoed = false
    a.ws.addEventListener('message', () => {
      echoed = true
    })
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'drums', code: 'note("c")' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(echoed).toBe(false)
  })

  it('sends a newly connecting client the current room state, including a distinct clientId', async () => {
    const a = await connect()
    const aState = await a.initial
    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'drums' }))
    await nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'drums', code: 'n(0)' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    const b = await connect()
    const bState = await b.initial

    expect(bState.clientId).not.toBe(aState.clientId)
    expect(bState.tracks.drums).toEqual({ owner: aState.clientId, code: 'n(0)', isPlaying: false })
  })
})

describe('track-ownership', () => {
  it('lets a client claim an unowned track', async () => {
    const a = await connect()
    const state = await a.initial
    expect(state.tracks.bass.owner).toBeNull()

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'bass' }))
    const update = await nextMessage(a.ws)

    expect(update).toEqual({ type: 'ownership_update', track: 'bass', owner: state.clientId })
  })

  it('rejects claiming an already-owned track', async () => {
    const a = await connect()
    await a.initial
    const b = await connect()
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'lead' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws) // broadcast of a's claim

    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    b.ws.send(JSON.stringify({ type: 'claim_track', track: 'lead' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(bReceived).toBe(false)
  })

  it('lets the owner release a track, and rejects release from a non-owner', async () => {
    const a = await connect()
    await a.initial
    const b = await connect()
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'pad' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    // non-owner release attempt: no response
    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    b.ws.send(JSON.stringify({ type: 'release_track', track: 'pad' }))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(bReceived).toBe(false)

    // owner release: succeeds
    const released = nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'release_track', track: 'pad' }))
    await expect(released).resolves.toEqual({ type: 'ownership_update', track: 'pad', owner: null })
  })

  it('rejects a pattern update for a track the sender does not own', async () => {
    const a = await connect()
    await a.initial
    const b = await connect()
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'drums' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    // b does not own drums
    b.ws.send(JSON.stringify({ type: 'pattern_update', track: 'drums', code: 's("hh*8")' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(bReceived).toBe(false)
  })
})

describe('playback', () => {
  it('broadcasts a play_track update to the owner and other clients, including the sender', async () => {
    const a = await connect()
    await a.initial
    const b = await connect()
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'drums' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    const aReceived = nextMessage(a.ws)
    const bReceived = nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'play_track', track: 'drums' }))

    const expected = { type: 'playback_update', track: 'drums', isPlaying: true }
    await expect(aReceived).resolves.toEqual(expected)
    await expect(bReceived).resolves.toEqual(expected)
  })

  it('broadcasts a stop_track update the same way', async () => {
    const a = await connect()
    await a.initial
    const b = await connect()
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'bass' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'play_track', track: 'bass' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    const aReceived = nextMessage(a.ws)
    const bReceived = nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'stop_track', track: 'bass' }))

    const expected = { type: 'playback_update', track: 'bass', isPlaying: false }
    await expect(aReceived).resolves.toEqual(expected)
    await expect(bReceived).resolves.toEqual(expected)
  })

  it('rejects play_track and stop_track from a non-owner', async () => {
    const a = await connect()
    await a.initial
    const b = await connect()
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'lead' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    b.ws.send(JSON.stringify({ type: 'play_track', track: 'lead' }))
    b.ws.send(JSON.stringify({ type: 'stop_track', track: 'lead' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(bReceived).toBe(false)
  })

  it('stops a playing track when its owner releases it', async () => {
    const a = await connect()
    await a.initial
    const b = await connect()
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'pad' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'play_track', track: 'pad' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    const nextB = messageQueue(b.ws)
    a.ws.send(JSON.stringify({ type: 'release_track', track: 'pad' }))

    await expect(nextB()).resolves.toEqual({ type: 'ownership_update', track: 'pad', owner: null })
    await expect(nextB()).resolves.toEqual({ type: 'playback_update', track: 'pad', isPlaying: false })
  })

  // Owner-disconnect-releases-and-stops (the close() handler in room.ts,
  // via releaseAndStop) isn't covered here: SELF.fetch()'s simulated
  // WebSocket close handshake doesn't propagate on any timescale a unit
  // test can wait for (observed 10s+, not a quick frame exchange), so
  // this is left to manual/e2e verification instead. It exercises the
  // same releaseAndStop() path already covered by the release_track test
  // above.
})

describe('transport-clock', () => {
  it('echoes a clock_ping as a clock_pong with a server timestamp', async () => {
    const a = await connect()
    await a.initial

    const before = Date.now()
    const pong = nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'clock_ping', clientSendTime: 12345 }))
    const result = await pong
    const after = Date.now()

    expect(result.type).toBe('clock_pong')
    expect(result.clientSendTime).toBe(12345)
    expect(result.serverTime).toBeGreaterThanOrEqual(before)
    expect(result.serverTime).toBeLessThanOrEqual(after)
  })

  it('re-locks tempo changes at the next bar boundary, not immediately', async () => {
    const a = await connect()
    const state = await a.initial

    const update = nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'set_tempo', bpm: 140 }))
    const result = await update

    expect(result.type).toBe('tempo_update')
    expect(result.bpm).toBe(140)
    // the new cycleStartTimestamp must be a whole number of the OLD
    // tempo's bar durations after the original cycleStartTimestamp
    const oldCycleDurationMs = (60000 / state.bpm) * 4
    const diff = result.cycleStartTimestamp - state.cycleStartTimestamp
    expect(diff % oldCycleDurationMs).toBeCloseTo(0, 0)
    expect(diff).toBeGreaterThan(0)
  })
})
