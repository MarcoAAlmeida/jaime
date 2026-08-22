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
