import { SELF } from 'cloudflare:test'
import { afterEach, describe, expect, it } from 'vitest'

let openSockets: WebSocket[] = []

function nextMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.addEventListener('message', (event) => resolve(JSON.parse(event.data as string)), { once: true })
  })
}

/**
 * Connects and returns both the socket and a promise for its initial
 * room_state message. The listener for that first message is attached
 * before accept() is called, so there's no window where the server's
 * open-handler send could arrive before anything is listening — a
 * WebSocket message sent before a listener is attached is dropped, not
 * buffered.
 */
async function connect(): Promise<{ ws: WebSocket, initial: Promise<unknown> }> {
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
  it('relays a pattern update to other connected clients', async () => {
    const a = await connect()
    const b = await connect()
    await a.initial
    await b.initial

    const received = nextMessage(b.ws)
    a.ws.send(JSON.stringify({ type: 'pattern_update', code: 's("bd sd")' }))

    await expect(received).resolves.toEqual({ type: 'pattern_update', code: 's("bd sd")' })
  })

  it('does not echo an update back to the sender', async () => {
    const a = await connect()
    await a.initial

    let echoed = false
    a.ws.addEventListener('message', () => {
      echoed = true
    })
    a.ws.send(JSON.stringify({ type: 'pattern_update', code: 'note("c")' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(echoed).toBe(false)
  })

  it('sends a newly connecting client the current room state', async () => {
    const a = await connect()
    await a.initial

    a.ws.send(JSON.stringify({ type: 'pattern_update', code: 'n(0)' }))
    await new Promise(resolve => setTimeout(resolve, 50))

    const b = await connect()
    const state = await b.initial

    expect(state).toEqual({ type: 'room_state', code: 'n(0)' })
  })
})
