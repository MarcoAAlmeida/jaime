// Composition Room realtime protocol (add-composition-room).
//
// One shared Yjs document per room. Yjs payloads are binary; crossws
// carries JSON, so every binary field is base64 (Uint8Array <-> base64).
// Yjs updates for a page of Strudel are tiny, so the ~33% overhead is
// irrelevant and this sidesteps any binary-passthrough / hibernation
// question — see design.md decision 2.

export type Role = 'editor' | 'viewer'

export interface CompositionPresenceEntry {
  clientId: string
  name: string
  role: Role
  /** Profile picture, server-resolved from the session. Absent for anonymous. */
  avatarUrl?: string
}

export interface ChatMessage {
  clientId: string
  name: string
  text: string
  at: number
  /** Profile picture of the sender, server-resolved. Absent for anonymous. */
  avatarUrl?: string
}

// --- client -> server ---
export type CompositionClientMessage =
  // Sent once on connect. `sv` is the client's Yjs state vector
  // (base64); the server replies with the update the client is missing.
  // `awarenessId` is this client's Yjs awareness id, so the server can
  // tell the others to drop its cursor when it disconnects.
  | { t: 'join', role: Role, name: string, color: string, sv: string, awarenessId?: number }
  // A Yjs document update (base64). The server applies + relays it.
  | { t: 'y-update', u: string }
  // A y-protocols/awareness update (base64). Relayed, never persisted.
  | { t: 'awareness', a: string }
  // Evaluate the shared document across the room, aligned to `atCycle`.
  | { t: 'eval', atCycle: number }
  | { t: 'stop' }
  | { t: 'chat', text: string }
  | { t: 'clock_ping', clientSendTime: number }

// --- server -> client ---
export type CompositionServerMessage =
  // Full initial state. `update` is Y.encodeStateAsUpdate(doc, clientSV)
  // — the diff to bring the joiner's doc current.
  | {
    t: 'welcome'
    clientId: string
    update: string
    bpm: number
    cycleStartTimestamp: number
    playing: boolean
    atCycle: number | null
    presence: CompositionPresenceEntry[]
    chat: ChatMessage[]
  }
  | { t: 'y-update', u: string }
  | { t: 'awareness', a: string }
  // A participant disconnected — drop their awareness (cursor) state.
  | { t: 'peer_left', awarenessId: number }
  | { t: 'presence', roster: CompositionPresenceEntry[] }
  | { t: 'eval', atCycle: number }
  | { t: 'stop' }
  | { t: 'chat', message: ChatMessage }
  | { t: 'tempo', bpm: number, cycleStartTimestamp: number }
  | { t: 'clock_pong', clientSendTime: number, serverTime: number }
  // `@jah` is preparing a reply (add-jah-chat) — sent `true` once a
  // request passes every gate and the model call starts, `false` once
  // the reply lands or is declined. Not sent for a decline that never
  // reaches the model (those are synchronous enough not to need it).
  | { t: 'jah_typing', typing: boolean }

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}
