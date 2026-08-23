import { evictDurableObject, runInDurableObject, SELF } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_CODE } from '../shared/tracks'

// The Nitro cloudflare-durable preset always addresses one hardcoded
// instance name ("server") for the whole Worker — see design.md in
// add-multi-room-presence. Tests that need to reach the Durable
// Object's storage directly (bypassing the app's own in-memory cache)
// use this same stub.
function getDurableObjectStub() {
  const id = env.$DurableObject.idFromName('server')
  return env.$DurableObject.get(id)
}

let openSockets: WebSocket[] = []
let roomCounter = 0

// Each test gets its own room (rooms are fully isolated by ID now — see
// server/routes/room.ts), so tests never share state and no longer need
// to pick different track names from each other just to avoid collision.
function freshRoomId(): string {
  roomCounter += 1
  return `test-room-${roomCounter}`
}

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
 * Connects to a given room and returns both the socket and a promise for
 * its initial room_state message. The listener for that first message is
 * attached before accept() is called, so there's no window where the
 * server's open-handler send could arrive before anything is listening —
 * a WebSocket message sent before a listener is attached is dropped, not
 * buffered.
 */
async function connect(roomId: string, name = 'Test User'): Promise<{ ws: WebSocket, initial: Promise<any> }> {
  const response = await SELF.fetch(`http://example.com/room?id=${encodeURIComponent(roomId)}&name=${encodeURIComponent(name)}`, {
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

describe('multi-room', () => {
  it('rejects a connection with no room id', async () => {
    const response = await SELF.fetch('http://example.com/room', {
      headers: { Upgrade: 'websocket' },
    })
    const ws = response.webSocket
    if (!ws) {
      throw new Error('Expected a WebSocket in the response')
    }
    let received: any
    ws.addEventListener('message', (event) => {
      received = JSON.parse(event.data as string)
    })
    ws.accept()
    openSockets.push(ws)
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(received).toBeUndefined()
  })

  it('rejects a connection with no display name', async () => {
    const roomId = freshRoomId()
    const response = await SELF.fetch(`http://example.com/room?id=${encodeURIComponent(roomId)}`, {
      headers: { Upgrade: 'websocket' },
    })
    const ws = response.webSocket
    if (!ws) {
      throw new Error('Expected a WebSocket in the response')
    }
    let received: any
    ws.addEventListener('message', (event) => {
      received = JSON.parse(event.data as string)
    })
    ws.accept()
    openSockets.push(ws)
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(received).toBeUndefined()
  })

  it('rejects a connection with an empty (whitespace-only) display name', async () => {
    const roomId = freshRoomId()
    const response = await SELF.fetch(`http://example.com/room?id=${encodeURIComponent(roomId)}&name=${encodeURIComponent('   ')}`, {
      headers: { Upgrade: 'websocket' },
    })
    const ws = response.webSocket
    if (!ws) {
      throw new Error('Expected a WebSocket in the response')
    }
    let received: any
    ws.addEventListener('message', (event) => {
      received = JSON.parse(event.data as string)
    })
    ws.accept()
    openSockets.push(ws)
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(received).toBeUndefined()
  })

  it('isolates rooms: a client in one room never receives another room\'s broadcasts', async () => {
    const roomA = freshRoomId()
    const roomB = freshRoomId()
    const a = await connect(roomA)
    await a.initial
    const b = await connect(roomB)
    await b.initial

    let aReceived = false
    a.ws.addEventListener('message', () => {
      aReceived = true
    })

    b.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(aReceived).toBe(false)
  })
})

describe('presence', () => {
  it('shows an existing peer to a newly joining peer, and notifies the existing peer of the join', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId, 'Alice')
    const aState = await a.initial

    const aReceived = nextMessage(a.ws)
    const b = await connect(roomId, 'Bob')
    const bState = await b.initial

    const sortByClientId = (entries: any[]) => [...entries].sort((x, y) => x.clientId.localeCompare(y.clientId))
    expect(sortByClientId(bState.presence)).toEqual(sortByClientId([
      { clientId: aState.clientId, name: 'Alice' },
      { clientId: bState.clientId, name: 'Bob' },
    ]))
    await expect(aReceived).resolves.toEqual({ type: 'presence_update', clientId: bState.clientId, joined: true, name: 'Bob' })
  })

  it('carries the correct display name for each connected client', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId, 'Alice')
    const aState = await a.initial
    const b = await connect(roomId, 'Bob')
    const bState = await b.initial

    expect(aState.presence).toEqual([{ clientId: aState.clientId, name: 'Alice' }])
    const names = bState.presence.map((entry: any) => entry.name).sort()
    expect(names).toEqual(['Alice', 'Bob'])
  })
})

describe('realtime-room', () => {
  it('relays a pattern update from the owner to other connected clients', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    const b = await connect(roomId)
    await a.initial
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws) // ownership_update to self
    await nextMessage(b.ws) // ownership_update broadcast to b

    const received = nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'a', code: 's("bd sd")' }))

    await expect(received).resolves.toEqual({ type: 'pattern_update', track: 'a', code: 's("bd sd")' })
  })

  it('does not echo a pattern update back to the sender', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)

    let echoed = false
    a.ws.addEventListener('message', () => {
      echoed = true
    })
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'a', code: 'note("c")' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(echoed).toBe(false)
  })

  it('sends a newly connecting client the current room state, including a distinct clientId', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    const aState = await a.initial
    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'a', code: 'n(0)' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    const b = await connect(roomId)
    const bState = await b.initial

    expect(bState.clientId).not.toBe(aState.clientId)
    expect(bState.tracks.a).toEqual({ owner: aState.clientId, code: 'n(0)', isPlaying: false })
  })
})

describe('track-ownership', () => {
  it('lets a client claim an unowned track', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    const state = await a.initial
    expect(state.tracks.b.owner).toBeNull()

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'b' }))
    const update = await nextMessage(a.ws)

    expect(update).toEqual({ type: 'ownership_update', track: 'b', owner: state.clientId })
  })

  it('rejects claiming an already-owned track', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    const b = await connect(roomId)
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws) // broadcast of a's claim

    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    b.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(bReceived).toBe(false)
  })

  it('lets the owner release a track, and rejects release from a non-owner', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    const b = await connect(roomId)
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'b' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    // non-owner release attempt: no response
    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    b.ws.send(JSON.stringify({ type: 'release_track', track: 'b' }))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(bReceived).toBe(false)

    // owner release: succeeds
    const released = nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'release_track', track: 'b' }))
    await expect(released).resolves.toEqual({ type: 'ownership_update', track: 'b', owner: null })
  })

  it('rejects a pattern update for a track the sender does not own', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    const b = await connect(roomId)
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    // b does not own 'a'
    b.ws.send(JSON.stringify({ type: 'pattern_update', track: 'a', code: 's("hh*8")' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(bReceived).toBe(false)
  })
})

describe('playback', () => {
  it('broadcasts a play_track update to the owner and other clients, including the sender', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    const b = await connect(roomId)
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    const aReceived = nextMessage(a.ws)
    const bReceived = nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'play_track', track: 'a' }))

    const expected = { type: 'playback_update', track: 'a', isPlaying: true }
    await expect(aReceived).resolves.toEqual(expected)
    await expect(bReceived).resolves.toEqual(expected)
  })

  it('broadcasts a stop_track update the same way', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    const b = await connect(roomId)
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'b' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'play_track', track: 'b' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    const aReceived = nextMessage(a.ws)
    const bReceived = nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'stop_track', track: 'b' }))

    const expected = { type: 'playback_update', track: 'b', isPlaying: false }
    await expect(aReceived).resolves.toEqual(expected)
    await expect(bReceived).resolves.toEqual(expected)
  })

  it('rejects play_track and stop_track from a non-owner', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    const b = await connect(roomId)
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    let bReceived = false
    b.ws.addEventListener('message', () => {
      bReceived = true
    })
    b.ws.send(JSON.stringify({ type: 'play_track', track: 'a' }))
    b.ws.send(JSON.stringify({ type: 'stop_track', track: 'a' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(bReceived).toBe(false)
  })

  it('stops a playing track when its owner releases it', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    await a.initial
    const b = await connect(roomId)
    await b.initial

    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'b' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'play_track', track: 'b' }))
    await nextMessage(a.ws)
    await nextMessage(b.ws)

    const nextB = messageQueue(b.ws)
    a.ws.send(JSON.stringify({ type: 'release_track', track: 'b' }))

    await expect(nextB()).resolves.toEqual({ type: 'ownership_update', track: 'b', owner: null })
    await expect(nextB()).resolves.toEqual({ type: 'playback_update', track: 'b', isPlaying: false })
  })

  // Owner-disconnect-releases-and-stops (the close() handler in room.ts,
  // via releaseAndStop) isn't covered here: SELF.fetch()'s simulated
  // WebSocket close handshake doesn't propagate on any timescale a unit
  // test can wait for (observed 10s+, not a quick frame exchange), so
  // this is left to manual/e2e verification instead. It exercises the
  // same releaseAndStop() path already covered by the release_track test
  // above. The same limitation applies to presence's leave notification
  // on close — covered by Playwright instead (04-roadmap.md).
})

describe('transport-clock', () => {
  it('echoes a clock_ping as a clock_pong with a server timestamp', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
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
    const roomId = freshRoomId()
    const a = await connect(roomId)
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

describe('persistence', () => {
  it('persists a mutation to storage as a whole-room snapshot, excluding presence', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    const aState = await a.initial
    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'a', code: 's("bd sd")' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    const stub = getDurableObjectStub()
    const stored = await runInDurableObject(stub, (_instance, state) =>
      state.storage.get(`room:${roomId}`))

    expect(stored).toEqual({
      tracks: {
        a: { owner: aState.clientId, code: 's("bd sd")', isPlaying: false },
        b: { owner: null, code: DEFAULT_CODE.b, isPlaying: false },
      },
      bpm: 120,
      cycleStartTimestamp: expect.any(Number),
    })
    // The persisted shape has no `presence` key at all — not an empty
    // array, absent entirely (see design.md's "never persisted" decision).
    expect(stored).not.toHaveProperty('presence')
  })

  it('survives a Durable Object eviction: reconnecting after eviction sees the prior state, not a fresh room', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId)
    const aState = await a.initial
    a.ws.send(JSON.stringify({ type: 'claim_track', track: 'a' }))
    await nextMessage(a.ws)
    a.ws.send(JSON.stringify({ type: 'pattern_update', track: 'a', code: 'note("e")' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    // Tears down the Durable Object's in-memory state (including our
    // module-level `rooms`/`loading` caches, which live inside its own
    // isolate) while preserving durable storage — genuinely exercising
    // the rehydrate-from-storage path, not just a stand-in for it.
    const stub = getDurableObjectStub()
    await evictDurableObject(stub)

    const b = await connect(roomId)
    const bState = await b.initial

    expect(bState.tracks.a).toEqual({ owner: aState.clientId, code: 'note("e")', isPlaying: false })
    expect(bState.bpm).toBe(120)
  })
})
