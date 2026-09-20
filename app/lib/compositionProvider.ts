// Client-side realtime for a Composition Room (add-composition-room).
// A thin Yjs provider over the /composition WebSocket: relays document
// updates + awareness, tracks presence / playback / tempo, and keeps a
// clock offset for phase-locked playback. See design.md decisions 3, 5.

import type {
  ChatMessage,
  CompositionPresenceEntry,
  CompositionServerMessage,
  JahAvailability,
  Role,
} from '#shared/compositionProtocol'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { fromBase64, toBase64 } from '#shared/compositionProtocol'
import { computeOffset } from '~/lib/clockOffset'

export const DOC_TEXT = 'strudel'

const RECONNECT_MS = 1500
const CLOCK_PING_MS = 15_000

// Cursor / presence palette. A participant's colour is hashed from their
// Yjs client id so it is stable for the session and spread across the
// palette without coordination.
const CURSOR_COLORS = [
  '#f97316', '#22c55e', '#3b82f6', '#e11d48',
  '#a855f7', '#14b8a6', '#eab308', '#ec4899',
]
export function cursorColor(clientId: number): string {
  return CURSOR_COLORS[Math.abs(clientId) % CURSOR_COLORS.length]!
}

export interface CompositionClock {
  bpm: number
  cycleStartTimestamp: number
}

interface Events {
  ready: () => void
  presence: (roster: CompositionPresenceEntry[]) => void
  playing: (playing: boolean, atCycle: number | null) => void
  eval: (atCycle: number) => void
  stop: () => void
  chat: (message: ChatMessage) => void
  tempo: (clock: CompositionClock) => void
  status: (connected: boolean) => void
  /** `@jah` is preparing a reply (add-jah-chat) — see `jah_typing`. */
  jahTyping: (typing: boolean) => void
  /** `@jah`'s availability to this participant, from every `welcome`. */
  jah: (availability: JahAvailability) => void
  /**
   * This connection's id, fired at the start of EVERY `welcome` — a
   * reconnect gets a new one, and the `welcome` that carries it also
   * replays the whole chat log, so it doubles as "the log is about to be
   * re-sent, start it over".
   */
  clientId: (clientId: string) => void
}

export interface CompositionProvider {
  readonly ydoc: Y.Doc
  readonly text: Y.Text
  readonly awareness: Awareness
  readonly ready: Promise<void>
  getClock: () => CompositionClock
  getOffset: () => number
  on: <K extends keyof Events>(event: K, cb: Events[K]) => void
  sendEval: (atCycle: number) => void
  sendStop: () => void
  sendChat: (text: string) => void
  destroy: () => void
}

export interface CompositionProviderOptions {
  roomId: string
  name: string
  role: Role
  /** Cursor colour; defaults to one hashed from the Yjs client id. */
  color?: string
}

export function createCompositionProvider(opts: CompositionProviderOptions): CompositionProvider {
  const ydoc = new Y.Doc()
  const text = ydoc.getText(DOC_TEXT)
  const awareness = new Awareness(ydoc)
  const color = opts.color ?? cursorColor(ydoc.clientID)
  awareness.setLocalStateField('user', { name: opts.name, color })

  const listeners: { [K in keyof Events]?: Events[K][] } = {}
  const emit = <K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) => {
    for (const cb of listeners[event] ?? []) (cb as (...a: unknown[]) => void)(...args)
  }

  const clock: CompositionClock = { bpm: 120, cycleStartTimestamp: Date.now() }
  let offset = 0
  const role: Role = opts.role
  let ws: WebSocket | undefined
  let closed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let clockTimer: ReturnType<typeof setInterval> | undefined
  let pingSentAt = 0

  let resolveReady!: () => void
  let readyDone = false
  const ready = new Promise<void>((r) => { resolveReady = r })

  function wsUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const q = new URLSearchParams({ id: opts.roomId, name: opts.name })
    return `${proto}//${location.host}/composition?${q}`
  }

  function sendRaw(obj: unknown) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
  }

  // Local doc edits → server (skip echoes of applied remote updates).
  function onDocUpdate(update: Uint8Array, origin: unknown) {
    if (origin === 'remote') return
    sendRaw({ t: 'y-update', u: toBase64(update) })
  }
  function onAwarenessUpdate(
    { added, updated, removed }: { added: number[], updated: number[], removed: number[] },
    origin: unknown,
  ) {
    if (origin === 'remote') return
    const changed = [...added, ...updated, ...removed]
    sendRaw({ t: 'awareness', a: toBase64(encodeAwarenessUpdate(awareness, changed)) })
  }
  ydoc.on('update', onDocUpdate)
  awareness.on('update', onAwarenessUpdate)

  function connect() {
    ws = new WebSocket(wsUrl())
    ws.addEventListener('open', () => {
      emit('status', true)
      sendRaw({
        t: 'join',
        role,
        name: opts.name,
        color,
        awarenessId: awareness.clientID,
        sv: toBase64(Y.encodeStateVector(ydoc)),
      })
      // Any local state the server doesn't have yet (reconnect / offline
      // edits).
      const local = Y.encodeStateAsUpdate(ydoc)
      if (local.length > 2) sendRaw({ t: 'y-update', u: toBase64(local) })
      pingSentAt = Date.now()
      sendRaw({ t: 'clock_ping', clientSendTime: pingSentAt })
      clockTimer = setInterval(() => {
        pingSentAt = Date.now()
        sendRaw({ t: 'clock_ping', clientSendTime: pingSentAt })
      }, CLOCK_PING_MS)
    })
    ws.addEventListener('message', (ev) => {
      let msg: CompositionServerMessage
      try {
        msg = JSON.parse(ev.data as string)
      }
      catch {
        return
      }
      handle(msg)
    })
    ws.addEventListener('close', () => {
      emit('status', false)
      if (clockTimer) clearInterval(clockTimer)
      if (!closed) reconnectTimer = setTimeout(connect, RECONNECT_MS)
    })
    ws.addEventListener('error', () => ws?.close())
  }

  function handle(msg: CompositionServerMessage) {
    switch (msg.t) {
      case 'welcome': {
        Y.applyUpdate(ydoc, fromBase64(msg.update), 'remote')
        clock.bpm = msg.bpm
        clock.cycleStartTimestamp = msg.cycleStartTimestamp
        emit('presence', msg.presence)
        emit('tempo', { ...clock })
        emit('playing', msg.playing, msg.atCycle)
        emit('clientId', msg.clientId)
        for (const c of msg.chat) emit('chat', c)
        // An older server won't send it; stay on the safe default.
        emit('jah', msg.jah ?? 'signed-out')
        if (!readyDone) {
          readyDone = true
          resolveReady()
          emit('ready')
        }
        break
      }
      case 'y-update':
        Y.applyUpdate(ydoc, fromBase64(msg.u), 'remote')
        break
      case 'awareness':
        applyAwarenessUpdate(awareness, fromBase64(msg.a), 'remote')
        break
      case 'peer_left':
        // The server has no Yjs awareness of its own — it just tells us
        // which peer dropped so y-codemirror.next removes their cursor
        // now instead of waiting for the 30s outdated-state sweep.
        removeAwarenessStates(awareness, [msg.awarenessId], 'remote')
        break
      case 'presence':
        emit('presence', msg.roster)
        break
      case 'eval':
        emit('eval', msg.atCycle)
        break
      case 'stop':
        emit('stop')
        break
      case 'chat':
        emit('chat', msg.message)
        break
      case 'tempo':
        clock.bpm = msg.bpm
        clock.cycleStartTimestamp = msg.cycleStartTimestamp
        emit('tempo', { ...clock })
        break
      case 'clock_pong': {
        const roundTrip = Date.now() - msg.clientSendTime
        offset = computeOffset(msg.clientSendTime, msg.serverTime, roundTrip)
        break
      }
      case 'jah_typing':
        emit('jahTyping', msg.typing)
        break
    }
  }

  connect()

  return {
    ydoc,
    text,
    awareness,
    ready,
    getClock: () => ({ ...clock }),
    getOffset: () => offset,
    on(event, cb) {
      ((listeners[event] ??= []) as unknown[]).push(cb)
    },
    sendEval(atCycle) {
      sendRaw({ t: 'eval', atCycle })
    },
    sendStop() {
      sendRaw({ t: 'stop' })
    },
    sendChat(text) {
      const t = text.trim()
      if (t) sendRaw({ t: 'chat', text: t })
    },
    destroy() {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (clockTimer) clearInterval(clockTimer)
      ydoc.off('update', onDocUpdate)
      awareness.off('update', onAwarenessUpdate)
      ws?.close()
      ydoc.destroy()
    },
  }
}
