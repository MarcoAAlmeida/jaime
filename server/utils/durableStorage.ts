let storage: DurableObjectStorage | undefined

// Set once, synchronously, by server/plugins/durable-storage.ts's
// cloudflare:durable:init hook — see design.md in
// openspec/changes/add-room-persistence for why that timing is safe.
export function setDurableStorage(value: DurableObjectStorage) {
  storage = value
}

export function getDurableStorage(): DurableObjectStorage {
  if (!storage) {
    throw new Error('Durable Object storage accessed before cloudflare:durable:init ran')
  }
  return storage
}

// The DO's bindings — captured by the same cloudflare:durable:init hook.
// WebSocket handlers run inside the DO and get a `peer`, not an h3
// event, so `usePatternsDb(event)` isn't available to them; this is how
// they reach `PATTERNS_DB` (e.g. to authenticate a connection).
let durableEnv: Env | undefined

export function setDurableEnv(value: Env) {
  durableEnv = value
}

export function getDurableEnv(): Env | undefined {
  return durableEnv
}
