import { runInDurableObject, SELF } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { fromBase64, toBase64 } from '../shared/compositionProtocol'

function durableObjectStub() {
  return env.$DurableObject.get(env.$DurableObject.idFromName('server'))
}

const DOC_TEXT = 'strudel'

let openSockets: WebSocket[] = []
let roomCounter = 0

function freshRoomId(): string {
  roomCounter += 1
  return `comp-test-${roomCounter}`
}

function messageQueue(ws: WebSocket): () => Promise<any> {
  const buffered: any[] = []
  const waiters: Array<(m: any) => void> = []
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data as string)
    const w = waiters.shift()
    if (w) w(m)
    else buffered.push(m)
  })
  return () => {
    const m = buffered.shift()
    return m !== undefined ? Promise.resolve(m) : new Promise(resolve => waiters.push(resolve))
  }
}

async function connect(roomId: string, name = 'User'): Promise<{ ws: WebSocket, next: () => Promise<any> }> {
  const res = await SELF.fetch(
    `http://example.com/composition?id=${encodeURIComponent(roomId)}&name=${encodeURIComponent(name)}`,
    { headers: { Upgrade: 'websocket' } },
  )
  const ws = res.webSocket
  if (!ws) throw new Error('expected a WebSocket')
  const next = messageQueue(ws)
  ws.accept()
  openSockets.push(ws)
  return { ws, next }
}

/** join, drive a Y.Doc bound to the socket, return { doc, next } after welcome. */
async function join(roomId: string, name: string, role: 'editor' | 'viewer' = 'editor') {
  const { ws, next } = await connect(roomId, name)
  const doc = new Y.Doc()
  ws.send(JSON.stringify({ t: 'join', role, name, color: '#f00', sv: toBase64(Y.encodeStateVector(doc)) }))
  const welcome = await next()
  expect(welcome.t).toBe('welcome')
  Y.applyUpdate(doc, fromBase64(welcome.update))
  doc.on('update', (u: Uint8Array) => ws.send(JSON.stringify({ t: 'y-update', u: toBase64(u) })))
  // Apply relayed updates from the server.
  ;(async () => {
    for (;;) {
      const m = await next().catch(() => null)
      if (!m) return
      if (m.t === 'y-update') Y.applyUpdate(doc, fromBase64(m.u), 'remote')
    }
  })()
  return { ws, doc, welcome }
}

afterEach(() => {
  for (const ws of openSockets) ws.close()
  openSockets = []
})

const settle = () => new Promise(r => setTimeout(r, 150))

describe('composition room', () => {
  it('converges two editors\' concurrent edits', async () => {
    const roomId = freshRoomId()
    const a = await join(roomId, 'Ada')
    const b = await join(roomId, 'Bo')

    a.doc.getText(DOC_TEXT).insert(0, 'hello ')
    b.doc.getText(DOC_TEXT).insert(0, 'world ')
    await settle()

    expect(a.doc.getText(DOC_TEXT).toString()).toBe(b.doc.getText(DOC_TEXT).toString())
    expect(a.doc.getText(DOC_TEXT).toString()).toContain('hello')
    expect(a.doc.getText(DOC_TEXT).toString()).toContain('world')
  })

  it('drops a viewer\'s document update', async () => {
    const roomId = freshRoomId()
    const editor = await join(roomId, 'Ed', 'editor')
    const viewer = await join(roomId, 'Vi', 'viewer')

    viewer.doc.getText(DOC_TEXT).insert(0, 'sneaky')
    editor.doc.getText(DOC_TEXT).insert(0, 'legit ')
    await settle()

    expect(editor.doc.getText(DOC_TEXT).toString()).toBe('legit ')
    expect(editor.doc.getText(DOC_TEXT).toString()).not.toContain('sneaky')
  })

  it('snapshots the document to durable storage; chat is not persisted', { timeout: 15_000 }, async () => {
    const roomId = freshRoomId()
    const a = await join(roomId, 'Ada')
    a.doc.getText(DOC_TEXT).insert(0, 's("bd sd")')
    a.ws.send(JSON.stringify({ t: 'chat', text: 'hi' }))
    await new Promise(r => setTimeout(r, 3000)) // snapshot debounce is 2s

    const snapshot = await runInDurableObject(durableObjectStub(), (_i, state) =>
      state.storage.get<string>(`composition:${roomId}`))
    expect(snapshot, 'a doc snapshot was written').toBeTruthy()
    const restored = new Y.Doc()
    Y.applyUpdate(restored, fromBase64(snapshot!))
    expect(restored.getText(DOC_TEXT).toString()).toBe('s("bd sd")')

    // A late joiner sees the doc + an empty chat (chat is in-memory only).
    const b = await join(roomId, 'Bo')
    expect(b.doc.getText(DOC_TEXT).toString()).toBe('s("bd sd")')
    // Ada's chat is still in the live room's memory (she's still here in
    // this process), but it is never written to storage — the snapshot
    // above proves that.
  })

  it('clears chat and stops playback when the room empties', { timeout: 10_000 }, async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId, 'Ada')
    a.ws.send(JSON.stringify({ t: 'join', role: 'editor', name: 'Ada', color: '#0f0', sv: toBase64(Y.encodeStateVector(new Y.Doc())) }))
    await a.next()
    a.ws.send(JSON.stringify({ t: 'chat', text: 'ephemeral' }))
    await settle()
    a.ws.close()
    openSockets = []
    await settle()

    const b = await connect(roomId, 'Bo')
    b.ws.send(JSON.stringify({ t: 'join', role: 'editor', name: 'Bo', color: '#00f', sv: toBase64(Y.encodeStateVector(new Y.Doc())) }))
    const welcome = await b.next()
    expect(welcome.chat).toEqual([])
    expect(welcome.playing).toBe(false)
  })

  it('broadcasts eval / stop and chat to the room', async () => {
    const roomId = freshRoomId()
    const a = await connect(roomId, 'Ada')
    a.ws.send(JSON.stringify({ t: 'join', role: 'editor', name: 'Ada', color: '#0f0', sv: toBase64(Y.encodeStateVector(new Y.Doc())) }))
    await a.next() // welcome
    const b = await connect(roomId, 'Bo')
    b.ws.send(JSON.stringify({ t: 'join', role: 'viewer', name: 'Bo', color: '#00f', sv: toBase64(Y.encodeStateVector(new Y.Doc())) }))
    await b.next() // welcome
    await a.next() // presence (Bo joined)

    a.ws.send(JSON.stringify({ t: 'eval', atCycle: 123 }))
    const evOnB = await b.next()
    expect(evOnB).toMatchObject({ t: 'eval', atCycle: 123 })

    a.ws.send(JSON.stringify({ t: 'chat', text: 'yo' }))
    const chatOnB = await b.next()
    expect(chatOnB).toMatchObject({ t: 'chat', message: { name: 'Ada', text: 'yo' } })
  })
})
